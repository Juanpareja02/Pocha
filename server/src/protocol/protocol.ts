export const PROTOCOL_VERSION = 1 as const;
export const MINIMUM_SUPPORTED_PROTOCOL_VERSION = 1 as const;
export const LATEST_PROTOCOL_VERSION = 1 as const;

export function isSupportedProtocolVersion(
  value: unknown,
  minimum: number = MINIMUM_SUPPORTED_PROTOCOL_VERSION,
  latest: number = LATEST_PROTOCOL_VERSION,
): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= minimum &&
    value <= latest
  );
}

export type RoomStatus = 'LOBBY' | 'STARTED' | 'FINISHED';
export type PresenceStatus =
  | 'ONLINE'
  | 'IN_CASUAL_QUEUE'
  | 'IN_RANKED_QUEUE'
  | 'IN_LOBBY'
  | 'IN_GAME'
  | 'DISCONNECTED';
export type ConnectionStatus = 'CONNECTED' | 'DISCONNECTED' | 'BOT_CONTROLLED';
export type RoomMode = 'private' | 'casual' | 'ranked';

export type BotDifficulty = 'easy' | 'normal' | 'hard';

export interface RoomConfig {
  readonly playerCount: number;
  readonly rulesetId: 'classic' | 'auction' | 'ranked_standard';
  readonly rulesetVersion: number;
  readonly allowBots: boolean;
  readonly botDifficulty: BotDifficulty;
}

export interface RoomPlayerView {
  readonly userId: string;
  readonly displayName: string;
  readonly username: string;
  readonly avatarSeed: number;
  readonly seat: number;
  readonly isHost: boolean;
  readonly isBot: boolean;
  readonly botDifficulty?: BotDifficulty;
  readonly ready: boolean;
  readonly connectionStatus: ConnectionStatus;
}

export interface RoomView {
  readonly protocolVersion: typeof PROTOCOL_VERSION;
  readonly roomId: string;
  readonly code: string;
  readonly hostUserId: string;
  readonly status: RoomStatus;
  readonly config: RoomConfig;
  readonly players: readonly RoomPlayerView[];
  readonly mode?: RoomMode;
  readonly seasonId?: string;
  readonly gameId?: string;
}

export interface CreateRoomPayload {
  readonly playerCount: number;
  readonly rulesetId: string;
  readonly rulesetVersion: number;
  readonly allowBots: boolean;
  readonly botDifficulty: string;
}

export interface JoinRoomPayload {
  readonly code: string;
}

export interface RoomActionPayload {
  readonly roomId?: string;
}

export interface AddBotPayload {
  readonly difficulty?: string;
}

export interface CasualMatchPayload {
  readonly playerCount: number;
  readonly rulesetId: string;
  readonly rulesetVersion: number;
}

export interface RankedMatchPayload {
  readonly rulesetId: string;
  readonly rulesetVersion?: number;
  readonly region?: string;
}

export interface MatchmakingView {
  readonly queued: boolean;
  readonly queueKey: string;
  readonly room?: RoomView;
}

export interface RankedMatchmakingView {
  readonly queued: boolean;
  readonly queueKey: string;
  readonly seasonId: string;
  readonly range: number;
  readonly queuedAt: string;
  readonly room?: RoomView;
}

export interface GameCommandPayload {
  readonly gameId: string;
  readonly expectedStateVersion: number;
  readonly actionId: string;
}

export interface BidCommandPayload extends GameCommandPayload {
  readonly bid: number;
}

export interface ChooseTrumpCommandPayload extends GameCommandPayload {
  readonly suit: string;
}

export interface PlayCardCommandPayload extends GameCommandPayload {
  readonly cardId: string;
}

export type GameCommandType =
  'ready' | 'bid' | 'chooseTrump' | 'playCard' | 'sync' | 'leave';

export type GameErrorCode =
  | 'NOT_AUTHENTICATED'
  | 'NOT_IN_GAME'
  | 'NOT_YOUR_TURN'
  | 'INVALID_PHASE'
  | 'INVALID_CARD'
  | 'ILLEGAL_CARD'
  | 'INVALID_BID'
  | 'STALE_STATE'
  | 'ROOM_NOT_FOUND'
  | 'ROOM_FULL'
  | 'GAME_ALREADY_STARTED'
  | 'RATE_LIMITED'
  | 'INVALID_ACTION'
  | 'INVALID_RULESET'
  | 'USERNAME_INVALID'
  | 'USERNAME_RESERVED'
  | 'ALREADY_IN_GAME'
  | 'NOT_HOST'
  | 'NOT_READY'
  | 'ACCOUNT_REQUIRED'
  | 'RANKED_UNAVAILABLE'
  | 'QUEUE_COOLDOWN'
  | 'SEASON_NOT_AVAILABLE'
  | 'PROTOCOL_UNSUPPORTED'
  | 'SERVER_ERROR';

export interface GameErrorPayload {
  readonly code: GameErrorCode;
  readonly message: string;
  readonly stateVersion?: number;
  readonly snapshot?: unknown;
}

export interface TurnTimerView {
  readonly action: 'BID' | 'CHOOSE_TRUMP' | 'PLAY_CARD';
  readonly deadlineAt: string;
}

export interface PlayerConnectionView {
  readonly userId: string;
  readonly status: ConnectionStatus;
}

export interface GameSnapshot {
  readonly protocolVersion: typeof PROTOCOL_VERSION;
  readonly gameId: string;
  readonly roomId: string;
  readonly stateVersion: number;
  readonly state: import('../game-engine').GameState;
  readonly myPlayerId: string;
  readonly mySeat: number;
  readonly players: readonly PlayerConnectionView[];
  readonly timer: TurnTimerView | null;
  readonly connectionStatus: ConnectionStatus;
}

export type GameEventName =
  | 'GAME_CREATED'
  | 'PLAYER_JOINED'
  | 'GAME_STARTED'
  | 'ROUND_STARTED'
  | 'BID_MADE'
  | 'TRUMP_SELECTED'
  | 'CARD_PLAYED'
  | 'TRICK_FINISHED'
  | 'ROUND_FINISHED'
  | 'PLAYER_DISCONNECTED'
  | 'PLAYER_RECONNECTED'
  | 'TURN_TIMED_OUT'
  | 'GAME_FINISHED'
  | 'PLAYER_ABANDONED';

export interface GameEventRecord {
  readonly gameId: string;
  readonly roomId: string;
  readonly userId?: string;
  readonly event: GameEventName;
  readonly stateVersion: number;
  readonly createdAt: string;
}
