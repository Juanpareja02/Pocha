import { classicRules, GameRules } from '../game-engine';
import {
  RANKED_PLAYER_COUNT,
  RANKED_RULESET_ID,
  RANKED_RULESET_VERSION,
} from './ranked.types';

/** Official ranked rules extend the shared classic v1 rules; clients cannot alter them. */
export function rankedRules(): GameRules {
  return {
    ...classicRules(RANKED_PLAYER_COUNT),
    id: RANKED_RULESET_ID,
    version: RANKED_RULESET_VERSION,
  };
}
