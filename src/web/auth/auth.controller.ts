import { Body, Controller, Get, Post, Query, Res } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { Response } from "express";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("signup")
  async signup(
    @Body("email") email: string,
    @Body("password") password: string
  ) {
    return this.authService.signup(email, password);
  }

  @Post("login")
  async login(
    @Body("email") email: string,
    @Body("password") password: string
  ) {
    return this.authService.login(email, password);
  }

  @Get("google")
  googleAuth(@Res() res: Response) {
    const clientId = process.env.GOOGLE_CLIENT_ID || 'GOOGLE_CLIENT_ID';
    const redirectUri = 'http://localhost:3001/api/auth/google/callback';
    const scope = 'email profile';
    const url = `https://accounts.google.com/o/oauth2/v2/auth?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scope)}`;
    return res.redirect(url);
  }

  @Get("google/callback")
  async googleAuthCallback(@Query("code") code: string, @Res() res: Response) {
    if (!code) {
      return res.redirect("http://localhost:3000?error=no_code");
    }

    try {
      const clientId = process.env.GOOGLE_CLIENT_ID || '';
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET || '';
      const redirectUri = 'http://localhost:3001/api/auth/google/callback';

      // 1. Exchange code for access token
      const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: "authorization_code",
        }),
      });

      const tokenData = (await tokenResponse.json()) as any;
      if (!tokenData.access_token) {
        console.error("Google token exchange failed:", tokenData);
        return res.redirect("http://localhost:3000?error=token_failed");
      }

      // 2. Fetch user profile
      const profileResponse = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
        },
      });

      const profile = (await profileResponse.json()) as any;
      if (!profile.email) {
        console.error("Google profile email not found:", profile);
        return res.redirect("http://localhost:3000?error=email_not_found");
      }

      // 3. Upsert user and generate JWT
      const result = await this.authService.googleLogin(profile.email);
      
      // 4. Redirect to frontend with JWT token
      return res.redirect(`http://localhost:3000?token=${result.data.token}`);
    } catch (error) {
      console.error("Google OAuth Error:", error);
      return res.redirect("http://localhost:3000?error=server_error");
    }
  }
}
