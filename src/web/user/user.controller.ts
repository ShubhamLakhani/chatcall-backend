import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  Post,
  UnauthorizedException,
} from "@nestjs/common";
import { UserModelService } from "src/schemas/user/user.service";
import * as jwt from "jsonwebtoken";

const packages: Record<string, number> = {
  pkg_100: 100,
  pkg_500: 500,
  pkg_1200: 1200,
};

@Controller("user")
export class UserController {
  constructor(private readonly userModelService: UserModelService) {}

  private getUserId(headers: any): string {
    const authHeader = headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new UnauthorizedException("Missing or invalid authorization token");
    }
    const token = authHeader.substring(7);
    try {
      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET || "your-secret-key"
      ) as { id: string };
      return decoded.id;
    } catch (err) {
      throw new UnauthorizedException("Invalid token signature or expired");
    }
  }

  @Post("purchase-coins")
  async purchaseCoins(
    @Headers() headers: any,
    @Body("packageId") packageId: string
  ) {
    const userId = this.getUserId(headers);
    const amount = packages[packageId];
    if (!amount) {
      throw new BadRequestException("Invalid package ID");
    }

    const updatedUser = await this.userModelService.addCoins(userId, amount);
    if (!updatedUser) {
      throw new BadRequestException("User not found");
    }

    return {
      success: true,
      message: `${amount} coins purchased successfully`,
      data: {
        coins: updatedUser.coins,
        isVip: updatedUser.isVip,
        vipExpiresAt: updatedUser.vipExpiresAt,
      },
    };
  }

  @Post("subscribe-vip")
  async subscribeVip(
    @Headers() headers: any,
    @Body("durationDays") durationDays: number
  ) {
    const userId = this.getUserId(headers);
    const duration = durationDays || 30;

    const updatedUser = await this.userModelService.subscribeVip(userId, duration);
    if (!updatedUser) {
      throw new BadRequestException("Insufficient coins or user not found");
    }

    return {
      success: true,
      message: `VIP status activated for ${duration} days`,
      data: {
        coins: updatedUser.coins,
        isVip: updatedUser.isVip,
        vipExpiresAt: updatedUser.vipExpiresAt,
      },
    };
  }
}
