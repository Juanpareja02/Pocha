import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { InfrastructureHealthService } from './infrastructure/infrastructure-health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly infrastructure: InfrastructureHealthService) {}

  @Get()
  health() {
    return this.infrastructure.live();
  }

  @Get('live')
  live() {
    return this.infrastructure.live();
  }

  @Get('ready')
  async ready() {
    const result = await this.infrastructure.ready();
    if (result.status !== 'ready') {
      throw new ServiceUnavailableException(result);
    }
    return result;
  }
}
