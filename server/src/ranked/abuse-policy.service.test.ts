import { describe, expect, it } from 'vitest';
import { RankedAbusePolicyService } from './abuse-policy.service';

describe('RankedAbusePolicyService', () => {
  it('applies the documented progressive cooldown policy', () => {
    const policy = new RankedAbusePolicyService();
    const now = Date.parse('2026-08-25T12:00:00.000Z');
    expect(policy.cooldownAfterAbandonment(1, now)).toBeNull();
    expect(policy.cooldownAfterAbandonment(2, now)).toBe(
      '2026-08-25T12:05:00.000Z',
    );
    expect(policy.cooldownAfterAbandonment(3, now)).toBe(
      '2026-08-25T12:15:00.000Z',
    );
    expect(policy.cooldownAfterAbandonment(8, now)).toBe(
      '2026-08-25T12:15:00.000Z',
    );
  });
});
