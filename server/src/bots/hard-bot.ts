import {
  buildPlayerView,
  createSpanishDeck,
  GameState,
  getLegalCards,
  playCard,
  shuffle,
  Suit,
} from '../game-engine';
import {
  chooseBestTrump,
  chooseCardForTarget,
  estimateBid,
  viewerPlayer,
} from './common';
import { NormalBotStrategy } from './normal-bot';
import {
  BotDecisionConfig,
  BotPlayerView,
  BotRandomSource,
  BotStrategy,
  DEFAULT_BOT_CONFIG,
} from './types';

interface RolloutResult {
  readonly exact: boolean;
  readonly score: number;
}

/**
 * Determinizes only unknown cards. The real opponent hands never enter this
 * class; distributions are sampled from the public card counts.
 */
export class HardBotStrategy implements BotStrategy {
  readonly difficulty = 'hard' as const;

  constructor(
    private readonly random: BotRandomSource,
    private readonly config: BotDecisionConfig = DEFAULT_BOT_CONFIG.hard,
  ) {}

  chooseBid(view: BotPlayerView): number {
    return estimateBid(view, this.random, 0);
  }

  chooseTrump(view: BotPlayerView): Suit | null {
    return chooseBestTrump(view);
  }

  chooseCard(view: BotPlayerView): string {
    const legal = getLegalCards(view.state, view.playerId);
    if (legal.length === 1 || this.config.maxSimulations <= 0) {
      return chooseCardForTarget(view, this.remainingNeed(view) > 0).id;
    }
    const results = legal.map((candidate) => {
      let exact = 0;
      let score = 0;
      for (
        let simulation = 0;
        simulation < this.config.maxSimulations;
        simulation += 1
      ) {
        const hypothetical = determinize(view, this.random);
        const result = rollout(
          hypothetical,
          view.playerId,
          candidate.id,
          this.random,
          this.config,
        );
        exact += Number(result.exact);
        score += result.score;
      }
      return {
        card: candidate,
        exactRate: exact / this.config.maxSimulations,
        averageScore: score / this.config.maxSimulations,
      };
    });
    results.sort(
      (left, right) =>
        right.exactRate - left.exactRate ||
        right.averageScore - left.averageScore,
    );
    return results[0].card.id;
  }

  private remainingNeed(view: BotPlayerView): number {
    const player = viewerPlayer(view);
    return (player.bid ?? 0) - player.tricksWon;
  }
}

function determinize(view: BotPlayerView, random: BotRandomSource): GameState {
  const state = view.state;
  const visibleIds = new Set([
    ...viewerPlayer(view).hand.map((card) => card.id),
    ...state.playedCards.map(({ card }) => card.id),
  ]);
  const hiddenCardsNeeded = state.players
    .filter((player) => player.id !== view.playerId)
    .reduce((total, player) => total + player.cardsRemaining, 0);
  const unknown = shuffle(
    createSpanishDeck(state.rules.ranks).filter(
      (card) => !visibleIds.has(card.id),
    ),
    () => random.next(),
  ).slice(0, hiddenCardsNeeded);
  let offset = 0;
  const players = state.players.map((player) => {
    if (player.id === view.playerId)
      return { ...player, hand: [...player.hand] };
    const hand = unknown.slice(offset, offset + player.cardsRemaining);
    offset += player.cardsRemaining;
    return { ...player, hand };
  });
  if (offset !== unknown.length) {
    throw new Error(
      `Determinization mismatch: assigned ${offset} of ${unknown.length} cards`,
    );
  }
  return { ...state, players };
}

function rollout(
  state: GameState,
  playerId: string,
  firstCardId: string,
  random: BotRandomSource,
  config: BotDecisionConfig,
): RolloutResult {
  let current = playCard(state, playerId, firstCardId, state.stateVersion);
  const normal = new NormalBotStrategy(random);
  let actions = 1;
  while (
    current.status === 'PLAYING_TRICK' &&
    actions < config.maxActionsPerRollout
  ) {
    const currentId = current.players[current.currentPlayerIndex].id;
    const privateView = {
      playerId: currentId,
      state: buildPlayerView(current, currentId),
    };
    const cardId = normal.chooseCard(privateView);
    current = playCard(current, currentId, cardId, current.stateVersion);
    actions += 1;
  }
  if (current.status !== 'ROUND_RESULTS') {
    return { exact: false, score: Number.NEGATIVE_INFINITY };
  }
  const player = current.players.find(
    (candidate) => candidate.id === playerId,
  )!;
  return {
    exact: player.bid === player.tricksWon,
    score: current.lastRoundScores[playerId] ?? 0,
  };
}
