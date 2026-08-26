import {
  Body,
  Controller,
  Get,
  Headers,
  Inject,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { AuthService } from './auth.service';
import { UserService } from '../users/user.service';

class GuestAuthDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(20)
  displayName?: string;
}

class DevelopmentAuthDto {
  @IsString()
  @MinLength(3)
  @MaxLength(40)
  userId!: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(20)
  displayName?: string;
}

class UpgradeAuthDto {
  @IsString()
  @MinLength(3)
  @MaxLength(4096)
  externalToken!: string;
}

@Controller('auth')
export class AuthController {
  constructor(
    @Inject(AuthService)
    private readonly auth: AuthService,
    @Inject(UserService)
    private readonly users: UserService,
  ) {}

  @Post('guest')
  guest(@Body() payload: GuestAuthDto) {
    const session = this.auth.createDevelopmentGuest();
    const user = this.users.getOrCreate(session.principal);
    const profile = payload.displayName?.trim()
      ? this.users.rename(session.principal, payload.displayName)
      : user;
    return {
      protocolVersion: 1,
      token: session.token,
      user: {
        id: profile.id,
        username: profile.username,
        displayName: profile.displayName,
        avatarSeed: profile.avatarSeed,
        isGuest: profile.isGuest,
      },
    };
  }

  @Post('development')
  development(@Body() payload: DevelopmentAuthDto) {
    const session = this.auth.createDevelopmentAccount(payload.userId);
    const user = this.users.getOrCreate(session.principal);
    const profile = payload.displayName?.trim()
      ? this.users.rename(session.principal, payload.displayName)
      : user;
    return {
      protocolVersion: 1,
      token: session.token,
      user: {
        id: profile.id,
        username: profile.username,
        displayName: profile.displayName,
        avatarSeed: profile.avatarSeed,
        isGuest: profile.isGuest,
      },
    };
  }

  @Get('me')
  async me(@Headers('authorization') authorization?: string) {
    const token = this.readBearer(authorization);
    const principal = await this.auth.verifyToken(token);
    const user = this.users.getOrCreate(principal);
    return { protocolVersion: 1, user };
  }

  @Post('upgrade')
  async upgrade(
    @Headers('authorization') authorization: string | undefined,
    @Body() payload: UpgradeAuthDto,
  ) {
    const guest = await this.auth.verifyToken(this.readBearer(authorization));
    const permanent = await this.auth.verifyExternalToken(payload.externalToken);
    const user = this.users.upgradeGuest(guest, permanent);
    return {
      protocolVersion: 1,
      token: payload.externalToken,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        avatarSeed: user.avatarSeed,
        isGuest: user.isGuest,
      },
    };
  }

  private readBearer(value?: string): string {
    if (!value?.startsWith('Bearer '))
      throw new UnauthorizedException('Authentication required');
    return value.slice(7);
  }
}
