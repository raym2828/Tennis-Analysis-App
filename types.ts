
export interface Player {
  id: number; // In-match ID (0-3)
  profileId: string; // Persistent ID
  name: string;
}

export interface PlayerStats {
  // Point ending stats
  winners: number;
  aces: number;
  unforcedErrors: number;
  forcedErrors: number;
  doubleFaults: number;

  // Serve stats
  firstServesIn: number;
  firstServesTotal: number;
  secondServesWon: number;
  secondServesTotal: number;
  servesUnreturned: number;

  // Return stats
  returnPointsWon: number;
  returnPointsTotal: number;
  returnWinners: number;
  returnUnforcedErrors: number; // New stat

  // Net stats
  netPointsApproached: number;
  netPointsWon: number;
  
  // Overall
  pointsWon: number;
  pointsLost: number;
}

export type StatCategory = keyof PlayerStats;

export interface PlayerProfile {
  id: string; // uuid
  name:string;
  matchesPlayed: number;
  wins: number;
  losses: number;
  stats: PlayerStats; // Aggregated stats
}

export interface MatchRecord {
  id: string; // uuid
  date: string;
  team1: { players: [Player, Player]; score: number[] };
  team2: { players: [Player, Player]; score: number[] };
  winner?: number; // 1 or 2. Optional for in-progress matches.
  playerStats: Record<string, PlayerStats>; // Storing stats by player profileId
  pointHistory: PointLog[];
  videoFileName?: string; // Store the name of the video file used
  lastGameState?: GameState; // The full game state to allow resuming
}

export interface Team {
  players: [Player, Player];
  games: number[]; // Array to hold scores for each set
  points: number;
  isServing: boolean;
}

export interface PointLog {
  id: number;
  score: string;
  description: string;
  set: number;
  timestamp?: number; // Video timestamp in seconds
  // Structured data for recalculation:
  pointWinnerId: 1 | 2; // Team that won the point
  serverStats: {
      playerId: number;
      isFirstServeIn: boolean; 
      isAce: boolean;
      isDoubleFault: boolean;
  };
  rallyStats: {
      endingPlayerId: number; 
      outcome: 'Winner' | 'Forced Error' | 'Unforced Error';
      isAtNet: boolean;
      isReturnEvent: boolean; // Replaces specific return booleans
  } | null; // null for aces/DFs
}

export interface GameState {
  team1: Team;
  team2: Team;
  currentSet: number;
  serverIndex: number; 
  serveOrder: number[];
  serveOrderIndex: number;
  receiverIndex: number; 
  isTieBreak: boolean;
  matchOver: boolean;
  winner?: number; // 1 or 2
  stats: Record<number, PlayerStats>; // In-match stats by player.id
  history: GameState[]; // For undo functionality
  pointHistory: PointLog[]; // For display
  isMatchStarted: boolean;
  pointState: 'scoring' | 'attributingRally' | 'selectingServer' | 'selectingSecondServer';
  isFirstServeFaulted: boolean;
  pointEndReason?: 'Winner' | 'Forced Error' | 'Unforced Error';
  currentPointTimestamp?: number; // Temporary storage for the timestamp of the current point being attributed
}

export interface RallyAttributionPayload {
  pointEndingPlayer: Player;
  wasAtNet: boolean;
  isReturnEvent: boolean; // Simplified payload
}

export type Action =
  | { type: 'START_MATCH'; payload: { team1: [Player, Player]; team2: [Player, Player] } }
  | { type: 'SET_FIRST_SERVER'; payload: { serverId: number } }
  | { type: 'CONFIRM_SECOND_SERVER'; payload: { serverId: number } }
  | { type: 'FIRST_SERVE_FAULT' }
  | { type: 'QUICK_ATTRIBUTE_POINT'; payload: { reason: 'Ace' | 'Double Fault'; timestamp?: number } }
  | { type: 'AWARD_RALLY_START'; payload: { reason: 'Winner' | 'Forced Error' | 'Unforced Error'; timestamp?: number } }
  | { type: 'ATTRIBUTE_RALLY'; payload: RallyAttributionPayload }
  | { type: 'UNDO_LAST_POINT' }
  | { type: 'RESET_STATE' }
  | { type: 'RESUME_MATCH'; payload: { state: GameState } }
  | { type: 'CANCEL_POINT' };
