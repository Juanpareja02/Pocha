import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('ranked shared ruleset contract', () => {
  it('is official, fixed to four players, and delegates game rules to classic@1', () => {
    const path = resolve(
      process.cwd(),
      '../shared/game-spec/rulesets/ranked_standard_v1.json',
    );
    const spec = JSON.parse(readFileSync(path, 'utf8')) as Record<
      string,
      unknown
    >;
    expect(spec).toMatchObject({
      id: 'ranked_standard',
      version: 1,
      extends: 'classic@1',
      official: true,
      playerCount: 4,
      players: { fixed: 4 },
      roundSequence: 'from:classic@1',
      trumpRules: 'from:classic@1',
      biddingRules: 'from:classic@1',
      scoring: 'from:classic@1',
      specialRounds: [],
      timeouts: 'server-session-defaults',
    });
  });
});
