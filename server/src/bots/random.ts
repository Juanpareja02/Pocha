import { BotRandomSource } from './types';

export class SeededBotRandom implements BotRandomSource {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  next(): number {
    this.state = (1664525 * this.state + 1013904223) >>> 0;
    return this.state / 0x100000000;
  }
}

export function chooseRandom<T>(
  items: readonly T[],
  random: BotRandomSource,
): T {
  if (items.length === 0)
    throw new Error('Cannot choose from an empty collection');
  return items[Math.floor(random.next() * items.length)];
}
