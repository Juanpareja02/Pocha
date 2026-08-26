import { Injectable, NotFoundException } from '@nestjs/common';
import { randomInt } from 'node:crypto';
import {
  buildPlayerView,
  chooseTrump,
  classicRules,
  createGame,
  GameRules,
  GameState,
  makeBid,
  playCard,
  RuleViolationError,
  startNextRound,
  startRound,
  Suit,
} from '../game-engine';

interface StoredGame {
  state: GameState;
  readyPlayers: Set<string>;
}

@Injectable()
export class GameService {
  private readonly games = new Map<string, StoredGame>();

  create(
    gameId: string,
    playerIds: readonly string[],
    playerNames: readonly string[],
    rules?: GameRules,
  ): GameState {
    if (playerIds.length !== playerNames.length) {
      throw new RuleViolationError(
        'Player ids and names must have the same length',
      );
    }
    const game = createGame(
      gameId,
      playerIds.map((id, index) => ({ id, name: playerNames[index] })),
      rules ?? classicRules(playerIds.length),
    );
    this.games.set(gameId, { state: game, readyPlayers: new Set() });
    return game;
  }

  get(gameId: string): GameState {
    const stored = this.games.get(gameId);
    if (!stored) throw new NotFoundException('Game not found');
    return stored.state;
  }

  view(gameId: string, playerId: string): GameState {
    return buildPlayerView(this.get(gameId), playerId);
  }

  ready(gameId: string, playerId: string): GameState {
    const stored = this.requireStored(gameId);
    if (!stored.state.players.some((player) => player.id === playerId)) {
      throw new RuleViolationError('Player does not belong to this game');
    }
    stored.readyPlayers.add(playerId);
    if (
      stored.state.status === 'LOBBY' &&
      stored.readyPlayers.size === stored.state.players.length
    ) {
      stored.state = startRound(stored.state, secureRandom);
    }
    return stored.state;
  }

  bid(
    gameId: string,
    playerId: string,
    bid: number,
    stateVersion?: number,
  ): GameState {
    const stored = this.requireStored(gameId);
    stored.state = makeBid(stored.state, playerId, bid, stateVersion);
    return stored.state;
  }

  trump(
    gameId: string,
    playerId: string,
    suit: string,
    stateVersion?: number,
  ): GameState {
    const stored = this.requireStored(gameId);
    const normalizedSuit = suit === 'none' ? null : (suit as Suit);
    stored.state = chooseTrump(
      stored.state,
      playerId,
      normalizedSuit,
      stateVersion,
    );
    return stored.state;
  }

  card(
    gameId: string,
    playerId: string,
    cardId: string,
    stateVersion?: number,
  ): GameState {
    const stored = this.requireStored(gameId);
    stored.state = playCard(stored.state, playerId, cardId, stateVersion);
    return stored.state;
  }

  nextRound(gameId: string): GameState {
    const stored = this.requireStored(gameId);
    stored.state = startNextRound(stored.state, secureRandom);
    return stored.state;
  }

  private requireStored(gameId: string): StoredGame {
    const stored = this.games.get(gameId);
    if (!stored) throw new NotFoundException('Game not found');
    return stored;
  }
}

function secureRandom(): number {
  return randomInt(0, 1_000_000) / 1_000_000;
}
