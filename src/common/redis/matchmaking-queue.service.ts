import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from './redis.service';
import Redis from 'ioredis';

export interface AddToQueueOptions {
  moduleType: 'chat' | 'voice-call';
  tags?: string[];
  isShadowbanned?: boolean;
  username?: string;
}

export interface FindMatchFilters {
  moduleType: 'chat' | 'voice-call';
  tags?: string[];
  strictTags?: boolean;
}

export interface QueueUserMetadata {
  userId: string;
  socketId: string;
  moduleType: 'chat' | 'voice-call';
  tags: string[];
  createdAt: number;
  isShadowbanned: boolean;
  username: string;
}

@Injectable()
export class MatchmakingQueueService {
  private readonly logger = new Logger(MatchmakingQueueService.name);

  public get redisClient(): Redis {
    return this.redisService.getClient();
  }

  constructor(private readonly redisService: RedisService) {}

  /**
   * Adds a user to the matchmaking queue (general and tag-specific queues).
   * Separates shadowbanned users into isolated queues.
   */
  async addToQueue(
    userId: string,
    socketId: string,
    options: AddToQueueOptions,
  ): Promise<void> {
    const isShadowbanned = options.isShadowbanned || false;
    const metaKey = `user:meta:${userId}`;
    const metadata: QueueUserMetadata = {
      userId,
      socketId,
      moduleType: options.moduleType,
      tags: options.tags || [],
      createdAt: Date.now(),
      isShadowbanned,
      username: options.username || 'Anonymous',
    };

    // Save user metadata in Redis with a 2-hour TTL to prevent memory leaks
    await this.redisClient.set(metaKey, JSON.stringify(metadata), 'EX', 7200);

    const score = metadata.createdAt;
    const queuePrefix = isShadowbanned
      ? `queue:${options.moduleType}:shadowban`
      : `queue:${options.moduleType}`;

    // Add to general queue (Sorted Set)
    const generalQueueKey = `${queuePrefix}:general`;
    await this.redisClient.zadd(generalQueueKey, score, userId);

    // Add to tag-specific queues if applicable
    if (metadata.tags.length > 0) {
      for (const tag of metadata.tags) {
        const tagQueueKey = `${queuePrefix}:tag:${tag}`;
        await this.redisClient.zadd(tagQueueKey, score, userId);
      }
    }

    this.logger.log(
      `Added user ${userId} to queue [${options.moduleType}] (shadowbanned: ${isShadowbanned}) with tags: ${metadata.tags.join(', ')}`,
    );
  }

  /**
   * Removes a user from all queues and deletes their metadata.
   */
  async removeFromQueue(userId: string): Promise<void> {
    const metaKey = `user:meta:${userId}`;
    const metadataStr = await this.redisClient.get(metaKey);
    if (!metadataStr) {
      // Just in case metadata is missing, try to remove from both normal and shadowbanned queues
      await this.redisClient.zrem('queue:chat:general', userId);
      await this.redisClient.zrem('queue:voice-call:general', userId);
      await this.redisClient.zrem('queue:chat:shadowban:general', userId);
      await this.redisClient.zrem('queue:voice-call:shadowban:general', userId);
      return;
    }

    const metadata = JSON.parse(metadataStr) as QueueUserMetadata;
    const queuePrefix = metadata.isShadowbanned
      ? `queue:${metadata.moduleType}:shadowban`
      : `queue:${metadata.moduleType}`;

    const generalQueueKey = `${queuePrefix}:general`;
    await this.redisClient.zrem(generalQueueKey, userId);

    if (metadata.tags && metadata.tags.length > 0) {
      for (const tag of metadata.tags) {
        const tagQueueKey = `${queuePrefix}:tag:${tag}`;
        await this.redisClient.zrem(tagQueueKey, userId);
      }
    }

    await this.redisClient.del(metaKey);
    this.logger.log(`Removed user ${userId} from all queues.`);
  }

  /**
   * Finds a match for a user based on filters (e.g. moduleType, tags).
   * Returns matched user metadata or null.
   */
  async findMatch(
    userId: string,
    filters: FindMatchFilters,
  ): Promise<QueueUserMetadata | null> {
    const myMetaKey = `user:meta:${userId}`;
    const myMetadataStr = await this.redisClient.get(myMetaKey);
    if (!myMetadataStr) {
      this.logger.warn(`Cannot find match: Metadata for user ${userId} does not exist in Redis.`);
      return null;
    }

    const myMetadata = JSON.parse(myMetadataStr) as QueueUserMetadata;
    const { moduleType } = filters;
    const isShadowbanned = myMetadata.isShadowbanned || false;
    const queuePrefix = isShadowbanned
      ? `queue:${moduleType}:shadowban`
      : `queue:${moduleType}`;

    // Determine the list of tags to try matching
    const tagsToCheck = filters.tags || myMetadata.tags || [];
    let candidateId: string | null = null;

    // 1. Try to find a partner who shares matching tags
    if (tagsToCheck.length > 0) {
      for (const tag of tagsToCheck) {
        const tagQueueKey = `${queuePrefix}:tag:${tag}`;
        // Fetch candidates sorted by oldest entry first
        const candidates = await this.redisClient.zrange(tagQueueKey, '0', '10');
        for (const candId of candidates) {
          if (candId !== userId) {
            candidateId = candId;
            break;
          }
        }
        if (candidateId) {
          this.logger.log(`Found candidate ${candidateId} matching tag "${tag}" for user ${userId} (shadowbanned: ${isShadowbanned})`);
          break;
        }
      }
    }

    // 2. If strictTags is not enabled, fall back to the general queue
    if (!candidateId && !filters.strictTags) {
      const generalQueueKey = `${queuePrefix}:general`;
      const candidates = await this.redisClient.zrange(generalQueueKey, '0', '10');
      for (const candId of candidates) {
        if (candId !== userId) {
          candidateId = candId;
          break;
        }
      }
      if (candidateId) {
        this.logger.log(`Found candidate ${candidateId} from general queue for user ${userId} (shadowbanned: ${isShadowbanned})`);
      }
    }

    // 3. Perform atomic match check and removal using Lua Script
    if (candidateId) {
      const generalQueueKey = `${queuePrefix}:general`;
      const matchLuaScript = `
        local scoreA = redis.call('ZSCORE', KEYS[1], ARGV[1])
        local scoreB = redis.call('ZSCORE', KEYS[1], ARGV[2])
        if scoreA and scoreB then
          redis.call('ZREM', KEYS[1], ARGV[1])
          redis.call('ZREM', KEYS[1], ARGV[2])
          return 1
        else
          return 0
        end
      `;

      const result = await this.redisClient.eval(
        matchLuaScript,
        1,
        generalQueueKey,
        userId,
        candidateId,
      ) as number;

      if (result === 1) {
        // Successful match!
        const candidateMetaKey = `user:meta:${candidateId}`;
        const candidateMetadataStr = await this.redisClient.get(candidateMetaKey);

        // Remove both from any tag queues
        // For User A (current user)
        if (myMetadata.tags && myMetadata.tags.length > 0) {
          for (const tag of myMetadata.tags) {
            const tagQueueKey = `${queuePrefix}:tag:${tag}`;
            await this.redisClient.zrem(tagQueueKey, userId);
          }
        }

        // For User B (candidate)
        let candidateMetadata: QueueUserMetadata | null = null;
        if (candidateMetadataStr) {
          candidateMetadata = JSON.parse(candidateMetadataStr) as QueueUserMetadata;
          if (candidateMetadata.tags && candidateMetadata.tags.length > 0) {
            for (const tag of candidateMetadata.tags) {
              const tagQueueKey = `${queuePrefix}:tag:${tag}`;
              await this.redisClient.zrem(tagQueueKey, candidateId);
            }
          }
        }

        // Delete metadata keys from Redis
        await this.redisClient.del(myMetaKey);
        await this.redisClient.del(candidateMetaKey);

        this.logger.log(`Atomically matched user ${userId} with user ${candidateId} (shadowbanned: ${isShadowbanned})`);
        return candidateMetadata;
      } else {
        this.logger.warn(
          `Match collision detected: ${userId} or ${candidateId} was already popped/removed.`,
        );
      }
    }

    return null;
  }

  /**
   * Helper to pop the oldest user from the general queue using zpopmin.
   */
  async popOldest(moduleType: 'chat' | 'voice-call'): Promise<string | null> {
    const generalQueueKey = `queue:${moduleType}:general`;
    const result = await this.redisClient.zpopmin(generalQueueKey);
    if (!result || result.length === 0) return null;
    return result[0];
  }

  /**
   * Evaluates sliding-window rate limit in Redis for the find-match event.
   * Maximum 5 attempts in 10 seconds. Returns true if limit is exceeded.
   */
  async checkRateLimit(userId: string): Promise<boolean> {
    const key = `rate:find-match:${userId}`;
    const now = Date.now();
    const windowMs = 10000; // 10 seconds
    const maxRequests = 5;

    // Remove expired attempts
    await this.redisClient.zremrangebyscore(key, 0, now - windowMs);

    // Count attempts in current window
    const count = await this.redisClient.zcard(key);

    if (count >= maxRequests) {
      return true; // Exceeded
    }

    // Record the current attempt with a unique member value
    const member = `${now}:${Math.random()}`;
    await this.redisClient.zadd(key, now, member);
    // Auto-expire history key if user goes idle
    await this.redisClient.expire(key, 12);

    return false;
  }

  /**
   * Clears the sliding-window rate limit records (called on CAPTCHA validation success).
   */
  async clearRateLimit(userId: string): Promise<void> {
    const key = `rate:find-match:${userId}`;
    await this.redisClient.del(key);
  }
}
