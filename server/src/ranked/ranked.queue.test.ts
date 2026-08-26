import { describe, expect, it } from 'vitest';
import { InMemoryRankedQueue } from './ranked.queue';
import { MatchQualityService } from './match-quality.service';
import { RankedQueueEntry } from './ranked.types';

function entry(
  userId: string,
  rating: number,
  queuedAt = new Date().toISOString(),
): RankedQueueEntry {
  return {
    userId,
    seasonId: 'season_1',
    rulesetId: 'ranked_standard',
    rulesetVersion: 1,
    rating,
    gamesPlayed: 0,
    provisional: true,
    queuedAt,
  };
}

describe('RankedQueue', () => {
  it('matches exactly four compatible players and consumes entries once', () => {
    const queue = new InMemoryRankedQueue();
    const players = [
      entry('a', 1000),
      entry('b', 1010),
      entry('c', 990),
      entry('d', 1020),
    ];
    players.forEach((player) => queue.enqueue(player));
    const match = queue.takeMatch(players[0]);
    expect(match.map((player) => player.userId)).toEqual(['a', 'b', 'c', 'd']);
    expect(queue.entries()).toHaveLength(0);
    expect(queue.takeMatch(players[0])).toHaveLength(0);
  });

  it('does not match a wide rating gap until the configured expansion allows it', () => {
    const queue = new InMemoryRankedQueue(new MatchQualityService());
    const old = new Date(Date.now() - 21_000).toISOString();
    const players = [
      entry('a', 1000, old),
      entry('b', 1200, old),
      entry('c', 1240, old),
      entry('d', 1240, old),
    ];
    players.forEach((player) => queue.enqueue(player));
    expect(queue.takeMatch(players[0], Date.now())).toHaveLength(4);
  });

  it('replaces a duplicate user entry instead of creating a second slot', () => {
    const queue = new InMemoryRankedQueue();
    queue.enqueue(entry('a', 1000));
    queue.enqueue(entry('a', 1100));
    expect(queue.entries()).toHaveLength(1);
    expect(queue.findByUser('a')!.rating).toBe(1100);
  });

  it('does not mix regions in a ranked match', () => {
    const queue = new InMemoryRankedQueue();
    const players = [
      { ...entry('a', 1000), region: 'eu' },
      { ...entry('b', 1000), region: 'us' },
      { ...entry('c', 1000), region: 'eu' },
      { ...entry('d', 1000), region: 'eu' },
    ];
    players.forEach((player) => queue.enqueue(player));
    expect(queue.takeMatch(players[0])).toHaveLength(0);
  });
});
