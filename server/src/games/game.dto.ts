import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreateGameDto {
  @IsString()
  gameId!: string;

  @IsString({ each: true })
  playerIds!: string[];

  @IsString({ each: true })
  playerNames!: string[];
}

export class GameActionDto {
  @IsString()
  gameId!: string;

  @IsString()
  playerId!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  stateVersion?: number;
}

export class BidDto extends GameActionDto {
  @IsInt()
  @Min(0)
  @Max(20)
  bid!: number;
}

export class TrumpDto extends GameActionDto {
  @IsString()
  suit!: string;
}

export class PlayCardDto extends GameActionDto {
  @IsString()
  cardId!: string;
}
