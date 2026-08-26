import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  calculateScore,
  classicRules,
  compareCards,
  getLegalCards,
  createGame,
  startRound,
  seededRandom,
  Suit,
  Rank,
} from './index';

interface EngineVectors {
  scoreCases: Array<{ bid: number; tricks: number; score: number }>;
  comparisonCases: Array<{
    first: string;
    second: string;
    lead: string;
    trump: string | null;
    winner: string;
  }>;
}

function vectors(): EngineVectors {
  return JSON.parse(
    readFileSync(
      resolve(
        process.cwd(),
        '../shared/game-spec/fixtures/engine_vectors.json',
      ),
      'utf8',
    ),
  ) as EngineVectors;
}

function card(value: string) {
  const [suit, rank] = value.split(':');
  return { id: value, suit: suit as Suit, rank: rank as Rank };
}

describe('shared game specification', () => {
  it('keeps the TypeScript rules aligned with classic_v1.json', () => {
    const spec = JSON.parse(
      readFileSync(
        resolve(process.cwd(), '../shared/game-spec/rulesets/classic_v1.json'),
        'utf8',
      ),
    ) as {
      id: string;
      version: number;
      deck: { suits: string[]; ranks: string[]; strengthHighToLow: string[] };
      roundSequenceByPlayerCount: Record<string, number[]>;
      scoring: Record<string, number | boolean>;
    };
    const rules = classicRules(4);
    expect(rules.id).toBe(spec.id);
    expect(rules.version).toBe(spec.version);
    expect(Object.values(Suit)).toEqual(spec.deck.suits);
    expect(Object.values(Rank)).toEqual(spec.deck.ranks);
    expect(rules.roundSequence).toEqual(spec.roundSequenceByPlayerCount['4']);
    expect(rules.scoring).toEqual(spec.scoring);
  });

  it('matches the scoring golden vectors', () => {
    const rules = classicRules(4);
    for (const testCase of vectors().scoreCases) {
      expect(
        calculateScore(rules.scoring, testCase.bid, testCase.tricks, 8),
      ).toBe(testCase.score);
    }
  });

  it('matches the comparison golden vectors', () => {
    for (const testCase of vectors().comparisonCases) {
      const winner = compareCards(
        card(testCase.first),
        card(testCase.second),
        testCase.lead as Suit,
        testCase.trump as Suit | null,
      );
      expect(winner.id).toBe(testCase.winner);
    }
  });

  it('preserves a private view contract for bot consumers', () => {
    const state = startRound(
      createGame(
        'view-contract',
        [
          { id: 'p1', name: 'Juan' },
          { id: 'p2', name: 'Ana' },
          { id: 'p3', name: 'Pablo' },
          { id: 'p4', name: 'Laura' },
        ],
        { ...classicRules(4), roundSequence: [2] },
      ),
      seededRandom(42),
    );
    expect(state.players.every((player) => player.cardsRemaining === 2)).toBe(
      true,
    );
    const legalBeforePlay = getLegalCards(
      { ...state, status: 'PLAYING_TRICK' },
      'p1',
    );
    expect(legalBeforePlay).toHaveLength(0);
  });
});
