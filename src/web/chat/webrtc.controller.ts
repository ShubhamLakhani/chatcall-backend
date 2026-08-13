import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Controller('webrtc')
export class WebRtcController {
  constructor(private readonly configService: ConfigService) {}

  @Get('ice-servers')
  getIceServers() {
    const stunUrls = this.configService.get<string>('STUN_URLS');
    const turnUrls = this.configService.get<string>('TURN_URLS');
    const turnUsername = this.configService.get<string>('TURN_USERNAME');
    const turnCredential = this.configService.get<string>('TURN_CREDENTIAL');

    const iceServers: any[] = [];

    // Parse STUN servers
    if (stunUrls) {
      const urls = stunUrls.split(',').map((url) => url.trim()).filter(Boolean);
      if (urls.length > 0) {
        iceServers.push({ urls });
      }
    }

    // Parse TURN servers
    if (turnUrls) {
      const urls = turnUrls.split(',').map((url) => url.trim()).filter(Boolean);
      if (urls.length > 0) {
        const serverConfig: any = { urls };
        if (turnUsername) {
          serverConfig.username = turnUsername;
        }
        if (turnCredential) {
          serverConfig.credential = turnCredential;
        }
        iceServers.push(serverConfig);
      }
    }

    // Default fallback to Google's public STUN servers
    if (iceServers.length === 0) {
      iceServers.push({
        urls: [
          'stun:stun.l.google.com:19302',
          'stun:stun1.l.google.com:19302',
          'stun:stun2.l.google.com:19302',
          'stun:stun3.l.google.com:19302',
          'stun:stun4.l.google.com:19302',
        ],
      });
    }

    return { iceServers };
  }
}
