import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CreateGameDto } from './game.dto';
import { GameService } from './game.service';

@Controller('games')
export class GamesController {
  constructor(private readonly games: GameService) {}

  @Post()
  create(@Body() payload: CreateGameDto) {
    return this.games.create(
      payload.gameId,
      payload.playerIds,
      payload.playerNames,
    );
  }

  @Get(':gameId/view/:playerId')
  view(@Param('gameId') gameId: string, @Param('playerId') playerId: string) {
    return this.games.view(gameId, playerId);
  }
}
