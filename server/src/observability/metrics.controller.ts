import {
  Controller,
  Get,
  Headers,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Inject } from '@nestjs/common';
import { MetricsService } from './metrics.service';

/** Aggregate metrics endpoint; production access must be restricted at the ingress. */
@Controller('metrics')
export class MetricsController {
  constructor(
    @Inject(MetricsService) private readonly metrics: MetricsService,
    @Inject(ConfigService) private readonly config: ConfigService,
  ) {}

  @Get()
  snapshot(@Headers('authorization') authorization?: string) {
    if (!this.config.get<boolean>('METRICS_ENABLED', false)) {
      throw new NotFoundException();
    }
    const appEnv = this.config.get<string>('APP_ENV', 'development');
    const token = this.config.get<string>('METRICS_TOKEN', '');
    if (
      appEnv !== 'development' &&
      (!token || authorization !== `Bearer ${token}`)
    ) {
      throw new UnauthorizedException();
    }
    return this.metrics.snapshot();
  }
}
