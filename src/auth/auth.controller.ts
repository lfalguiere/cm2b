// src/auth/auth.controller.ts
import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Get,
  Delete,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import {
  LoginDto,
  RegisterDto,
  RefreshDto,
  LogoutDto,
  AuthResponseDto,
  TokenPairDto,
} from './dto/auth.dto';
import { Public } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { Roles } from './decorators/roles.decorator';
import { User, UserRole } from '../entities/user.entity';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * POST /auth/login
   * Route publique, rate-limitée (5 req / minute par IP).
   */
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto): Promise<AuthResponseDto> {
    const { accessToken, refreshToken } = await this.authService.login(
      dto.email,
      dto.password,
      dto.deviceFingerprint,
    );
    // On recharge l'user sans le hash pour la réponse
    // (authService.login ne le renvoie pas)
    return { accessToken, refreshToken } as any;
  }

  /**
   * POST /auth/register
   * Réservé aux ADMIN. Un ADMIN crée les comptes des autres utilisateurs.
   * Le premier ADMIN est créé via le seed de base de données.
   */
  @Post('register')
  @Roles(UserRole.ADMIN)
  async register(@Body() dto: RegisterDto): Promise<{ id: string; email: string }> {
    const user = await this.authService.register(
      dto.email,
      dto.username,
      dto.password,
      dto.role,
    );
    return { id: user.id, email: user.email };
  }

  /**
   * POST /auth/refresh
   * Route publique (le client n'a plus d'accessToken valide).
   */
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() dto: RefreshDto): Promise<TokenPairDto> {
    return this.authService.refresh(dto.refreshToken, dto.deviceFingerprint);
  }

  /**
   * POST /auth/logout
   * Révoque le refresh token fourni.
   */
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Body() dto: LogoutDto): Promise<void> {
    return this.authService.logout(dto.refreshToken);
  }

  /**
   * DELETE /auth/sessions
   * Révoque TOUS les refresh tokens de l'utilisateur (logout global).
   */
  @Delete('sessions')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logoutAll(@CurrentUser() user: User): Promise<void> {
    return this.authService.logoutAll(user.id);
  }

  /**
   * GET /auth/me
   * Renvoie le profil de l'utilisateur courant.
   */
  @Get('me')
  getMe(@CurrentUser() user: User) {
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
    };
  }
}
