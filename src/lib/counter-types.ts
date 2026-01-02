export interface Player {
  id: number;
  name: string;
  score: number;
  history: number[];
}

export interface Variant {
  doubleGold: boolean;
}

export type GameState = 'setup' | 'betting' | 'results' | 'scoreboard' | 'gameover';

export interface Bet {
  [playerId: number]: number;
}

export interface Trick {
  [playerId: number]: number;
}
