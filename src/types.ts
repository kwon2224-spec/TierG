// Tier Golf (TierG) Common TypeScript Types and Constants

export type Tier =
  | 'Iron'
  | 'Bronze'
  | 'Silver'
  | 'Gold'
  | 'Platinum'
  | 'Emerald'
  | 'Diamond'
  | 'Master'
  | 'Challenger';

export const TIERS_ORDER: Tier[] = [
  'Iron',
  'Bronze',
  'Silver',
  'Gold',
  'Platinum',
  'Emerald',
  'Diamond',
  'Master',
  'Challenger',
];

// Numeric weight for sorting tiers (Iron starts at 100, Bronze 200, etc.)
export const TIER_WEIGHTS: Record<Tier, number> = {
  Iron: 100,
  Bronze: 200,
  Silver: 300,
  Gold: 400,
  Platinum: 500,
  Emerald: 600,
  Diamond: 700,
  Master: 800,
  Challenger: 900,
};

// Visual themes for tiers
export interface TierTheme {
  name: string;
  gradient: string;
  color: string;
  textColor: string;
  shadow: string;
}

export const TIER_THEMES: Record<Tier, TierTheme> = {
  Iron: {
    name: '아이언',
    gradient: 'linear-gradient(135deg, #7a7a7a, #3a3a3a)',
    color: '#5c5c5c',
    textColor: '#ffffff',
    shadow: 'rgba(92, 92, 92, 0.4)',
  },
  Bronze: {
    name: '브론즈',
    gradient: 'linear-gradient(135deg, #a16207, #78350f)',
    color: '#b45309',
    textColor: '#ffffff',
    shadow: 'rgba(180, 83, 9, 0.4)',
  },
  Silver: {
    name: '실버',
    gradient: 'linear-gradient(135deg, #94a3b8, #475569)',
    color: '#64748b',
    textColor: '#ffffff',
    shadow: 'rgba(100, 116, 139, 0.4)',
  },
  Gold: {
    name: '골드',
    gradient: 'linear-gradient(135deg, #f59e0b, #b45309)',
    color: '#d97706',
    textColor: '#ffffff',
    shadow: 'rgba(217, 119, 6, 0.5)',
  },
  Platinum: {
    name: '플래티넘',
    gradient: 'linear-gradient(135deg, #2dd4bf, #0f766e)',
    color: '#0d9488',
    textColor: '#ffffff',
    shadow: 'rgba(13, 148, 136, 0.4)',
  },
  Emerald: {
    name: '에메랄드',
    gradient: 'linear-gradient(135deg, #4ade80, #15803d)',
    color: '#16a34a',
    textColor: '#ffffff',
    shadow: 'rgba(22, 163, 74, 0.4)',
  },
  Diamond: {
    name: '다이아몬드',
    gradient: 'linear-gradient(135deg, #60a5fa, #1d4ed8)',
    color: '#2563eb',
    textColor: '#ffffff',
    shadow: 'rgba(37, 99, 235, 0.5)',
  },
  Master: {
    name: '마스터',
    gradient: 'linear-gradient(135deg, #c084fc, #6b21a8)',
    color: '#7c3aed',
    textColor: '#ffffff',
    shadow: 'rgba(124, 58, 237, 0.6)',
  },
  Challenger: {
    name: '챌린저',
    gradient: 'linear-gradient(135deg, #f87171, #991b1b)',
    color: '#dc2626',
    textColor: '#ffffff',
    shadow: 'rgba(220, 38, 38, 0.7)',
  },
};

export type PlayerStatus = 'Active' | 'Dormant' | 'Left';
export type MatchMode = 'handicap' | 'scratch' | 'guillotine';

export interface Player {
  id: string;
  name: string;
  tier: Tier;
  points: number; // 0 to 100 (except Challenger which can grow or cap)
  base_handicap: number; // Strokes added/subtracted
  status?: PlayerStatus; // 'Active' | 'Dormant' | 'Left'
  is_admin?: boolean; // 'true' if the player has Admin permissions!
  nickname?: string; // Custom player nickname (e.g. #장타왕)
  created_at?: string;
}

export interface Game {
  id: string;
  played_at: string;
  notes?: string;
  created_at?: string;
}

export interface GameResult {
  id: string;
  game_id: string;
  player_id: string;
  raw_score: number;
  adjusted_score: number;
  rank: number;
  points_changed: number;
  tier_after: Tier;
  points_after: number;
  cost_paid: number;
  bet_amount?: number; // Tracks original bet in Guillotine Mode
  created_at?: string;
}

// Full game result with player details populated
export interface GameWithResults {
  game: Game;
  results: (GameResult & {
    player_name: string;
    player_tier_before: Tier;
    player_points_before: number;
  })[];
}
