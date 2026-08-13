import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { IResponse } from "src/common/common.interface";
import { BlockedUserModelService } from "src/schemas/blockedUser/blockedUser.service";
import { UserModelService } from "src/schemas/user/user.service";
import * as bcrypt from "bcrypt";
import * as jwt from "jsonwebtoken";

@Injectable()
export class AuthService {
  constructor(private userModelService: UserModelService) {}

  async signup(
    email: string,
    password: string
  ): Promise<IResponse<{ newUser: any }>> {
    // Check if the user already exists
    const existingUser = await this.userModelService.findByEmail(email);
    if (existingUser) {
      throw new BadRequestException("User already exists");
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create the user
    const newUser = await this.userModelService.create({
      email,
      password: hashedPassword,
    });

    return {
      success: true,
      message: "User registered successfully",
      data: { newUser },
    };
  }

  async login(
    email: string,
    password: string
  ): Promise<IResponse<{ token: string }>> {
    // Find the user by email
    const user = await this.userModelService.findByEmail(email);
    if (!user) {
      throw new NotFoundException("User not found");
    }

    // Check if the password is correct
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException("Invalid credentials");
    }

    // Generate a JWT token
    const token = jwt.sign(
      { id: user._id, email: user.email },
      "your-secret-key",
      {
        expiresIn: "1h",
      }
    );

    return {
      success: true,
      message: "Login successful",
      data: { token },
    };
  }
}
