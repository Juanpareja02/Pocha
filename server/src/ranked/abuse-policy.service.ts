import { Injectable } from '@nestjs/common';

@Injectable()
export class RankedAbusePolicyService {
  cooldownAfterAbandonment(
    abandonsAfterResult: number,
    now = Date.now(),
  ): string | null {
    const duration =
      abandonsAfterResult <= 1
        ? 0
        : abandonsAfterResult === 2
          ? 5 * 60_000
          : 15 * 60_000;
    return duration === 0 ? null : new Date(now + duration).toISOString();
  }
}
