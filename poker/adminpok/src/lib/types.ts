export type AdminUser = {
  id: number;
  username: string;
  role: string;
};

export type PlayerUser = {
  id: number;
  username: string;
  display_name?: string | null;
  phone?: string | null;
  email?: string | null;
  account_balance: number | string;
  role: string;
  is_active: string | number | boolean;
  current_game_id?: number | null;
  avatar_url?: string | null;
  createdAt?: string;
};

export type DashboardStats = {
  users: { total: number; active: number; playing?: number };
  withdrawals: { pending: number; totalAmount: number };
  tournaments: { active: number; total: number };
  games: { active: number; total: number };
  rooms?: { live: number; playing: number };
};

export type LivePlayer = {
  playerId: number;
  userId: number;
  username: string;
  connected: boolean;
  isSpectator?: boolean;
};

export type LiveRoom = {
  roomId: string;
  originalRoomId?: string;
  gameId: number | null;
  gameType: string;
  buyIn: number;
  maxPlayers: number;
  tournamentId: number | null;
  gameStarted: boolean;
  gameFinished: boolean;
  playerCount: number;
  spectatorCount: number;
  currentPlayerIndex: number;
  players: LivePlayer[];
  spectators: { userId?: number; username: string; connected: boolean }[];
};

export type GameRecord = {
  game_id: number;
  room_id: number;
  room_key?: string | null;
  status: number;
  players?: unknown;
  player_ids?: number[];
  buy_in: number;
  game_type?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  winner?: number | null;
  winner_username?: string | null;
  createdAt?: string;
};

export type Tournament = {
  tournament_id: number;
  tournament_name: string;
  buy_in: number;
  prize_pool: number;
  max_players: number;
  registered_players?: unknown;
  status: number;
  game_type?: string;
  start_time?: string | null;
  end_time?: string | null;
  createdAt?: string;
};

export type Withdrawal = {
  withdrawal_id: number;
  user_id: number;
  amount: number | string;
  status: string;
  bank_account?: string | null;
  bank_name?: string | null;
  account_holder_name?: string | null;
  phone?: string | null;
  admin_notes?: string | null;
  processed_at?: string | null;
  createdAt?: string;
  user?: { id: number; username: string; phone?: string; email?: string };
};

export type PlatformCharge = {
  charge_id: number;
  game_id: number;
  total_pot: number | string;
  platform_fee: number | string;
  winner_payout: number | string;
  created_at?: string;
  game?: {
    game_id: number;
    room_id: number;
    buy_in: number;
    game_type?: string;
    winner?: number | null;
    winnerUser?: { id: number; username: string; display_name?: string };
  };
};

export type ChargeTotals = {
  totalPot: number;
  totalPlatformFee: number;
  totalWinnerPayout: number;
  count: number;
};
