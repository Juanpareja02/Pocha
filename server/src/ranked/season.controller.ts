import { Controller, Get, Param } from '@nestjs/common';
import { SeasonService } from './season.service';

@Controller('seasons')
export class SeasonController {
  constructor(private readonly seasons: SeasonService) {}

  @Get('current')
  current() {
    return this.seasons.requireActive();
  }

  @Get()
  list() {
    return { seasons: this.seasons.list() };
  }

  @Get(':id')
  find(@Param('id') id: string) {
    return this.seasons.find(id);
  }
}
