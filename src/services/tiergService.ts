import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { type Player, type Game, type GameResult, type GameWithResults, type Tier, TIERS_ORDER } from '../types';

// 1. Initialize Supabase Client if env variables are available
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

let supabase: SupabaseClient | null = null;
if (supabaseUrl && supabaseAnonKey) {
  try {
    supabase = createClient(supabaseUrl, supabaseAnonKey);
    console.log('Supabase client successfully initialized!');
  } catch (error) {
    console.error('Failed to initialize Supabase client:', error);
  }
} else {
  console.log('Supabase credentials missing. Running in Local Storage (Demo) mode.');
}

// 2. Initial Mock Players for Local Demo Mode
const INITIAL_MOCK_PLAYERS: Player[] = [
  { id: 'p1', name: '김진우', tier: 'Challenger', points: 95, base_handicap: 5 },
  { id: 'p2', name: '이민준', tier: 'Diamond', points: 60, base_handicap: 12 },
  { id: 'p3', name: '박서연', tier: 'Platinum', points: 85, base_handicap: 15 },
  { id: 'p4', name: '최현우', tier: 'Gold', points: 45, base_handicap: 18 },
  { id: 'p5', name: '정다은', tier: 'Gold', points: 10, base_handicap: 20 },
  { id: 'p6', name: '강준서', tier: 'Silver', points: 75, base_handicap: 22 },
  { id: 'p7', name: '윤지아', tier: 'Silver', points: 20, base_handicap: 24 },
  { id: 'p8', name: '임도현', tier: 'Bronze', points: 80, base_handicap: 28 },
  { id: 'p9', name: '한소희', tier: 'Bronze', points: 35, base_handicap: 30 },
  { id: 'p10', name: '오지훈', tier: 'Iron', points: 50, base_handicap: 36 },
];

// Helper to load/save from Local Storage
const getLocalData = <T>(key: string, defaultValue: T): T => {
  const data = localStorage.getItem(key);
  if (!data) {
    localStorage.setItem(key, JSON.stringify(defaultValue));
    return defaultValue;
  }
  return JSON.parse(data);
};

const setLocalData = <T>(key: string, value: T): void => {
  localStorage.setItem(key, JSON.stringify(value));
};

// 3. Tier Calculation Engine (Shared between modes)
export const calculateNewTierAndPoints = (
  currentTier: Tier,
  currentPoints: number,
  pointsChanged: number
): { newTier: Tier; newPoints: number } => {
  let newTier = currentTier;
  let newPoints = currentPoints + pointsChanged;

  // Handling Challenger tier edge case: points can accumulate infinitely (no tier above)
  if (currentTier === 'Challenger') {
    if (newPoints < 0) {
      // Demote to Master
      newTier = 'Master';
      newPoints = 100 + newPoints; // e.g. 100 + (-15) = 85 LP
    } else {
      // Keep Challenger and accumulate points
      return { newTier, newPoints };
    }
  }

  // Handle Promotion for non-Challenger tiers
  while (newPoints >= 100 && newTier !== 'Challenger') {
    const currentIndex = TIERS_ORDER.indexOf(newTier);
    if (currentIndex < TIERS_ORDER.length - 1) {
      newTier = TIERS_ORDER[currentIndex + 1];
      newPoints = newPoints - 100;
    } else {
      // Reach Challenger
      newTier = 'Challenger';
      break;
    }
  }

  // Handle Demotion
  while (newPoints < 0) {
    if (newTier === 'Iron') {
      newPoints = 0; // Iron 0 LP is the floor
      break;
    }
    const currentIndex = TIERS_ORDER.indexOf(newTier);
    if (currentIndex > 0) {
      newTier = TIERS_ORDER[currentIndex - 1];
      newPoints = 100 + newPoints; // e.g. 100 + (-15) = 85 LP
    } else {
      newPoints = 0;
      break;
    }
  }

  return { newTier, newPoints };
};

// 4. Main Service Implementation
class TierGService {
  isSupabaseMode(): boolean {
    return supabase !== null;
  }

  // --- Players API ---
  async getPlayers(): Promise<Player[]> {
    if (supabase) {
      const { data, error } = await supabase
        .from('players')
        .select('*')
        .order('created_at', { ascending: true });
      if (error) {
        console.error('Supabase getPlayers error, falling back:', error);
      } else if (data) {
        return data as Player[];
      }
    }

    // Local Storage fallback
    return getLocalData<Player[]>('tierg_players', INITIAL_MOCK_PLAYERS);
  }

  async addPlayer(name: string, baseHandicap: number): Promise<Player> {
    if (supabase) {
      const { data, error } = await supabase
        .from('players')
        .insert([{ name, base_handicap: baseHandicap, tier: 'Iron', points: 0 }])
        .select();
      if (error) {
        throw new Error(`Supabase addPlayer failed: ${error.message}`);
      }
      return data[0] as Player;
    }

    // Local Storage fallback
    const players = getLocalData<Player[]>('tierg_players', INITIAL_MOCK_PLAYERS);
    const newPlayer: Player = {
      id: `p_${Date.now()}`,
      name,
      tier: 'Iron',
      points: 0,
      base_handicap: baseHandicap,
    };
    players.push(newPlayer);
    setLocalData('tierg_players', players);
    return newPlayer;
  }

  async updatePlayerHandicap(id: string, newHandicap: number): Promise<Player> {
    if (supabase) {
      const { data, error } = await supabase
        .from('players')
        .update({ base_handicap: newHandicap })
        .eq('id', id)
        .select();
      if (error) {
        throw new Error(`Supabase updatePlayerHandicap failed: ${error.message}`);
      }
      return data[0] as Player;
    }

    // Local Storage fallback
    const players = getLocalData<Player[]>('tierg_players', INITIAL_MOCK_PLAYERS);
    const playerIndex = players.findIndex((p) => p.id === id);
    if (playerIndex === -1) throw new Error('Player not found');
    players[playerIndex].base_handicap = newHandicap;
    setLocalData('tierg_players', players);
    return players[playerIndex];
  }

  // --- Games API ---
  async getGames(): Promise<GameWithResults[]> {
    if (supabase) {
      try {
        // Fetch all games
        const { data: gamesData, error: gamesError } = await supabase
          .from('games')
          .select('*')
          .order('played_at', { ascending: false });

        if (gamesError) throw gamesError;

        if (!gamesData || gamesData.length === 0) return [];

        const gamesWithResults: GameWithResults[] = [];

        for (const game of gamesData) {
          // Fetch results for this game, joining with players to get names
          const { data: resultsData, error: resultsError } = await supabase
            .from('game_results')
            .select(`
              *,
              players (
                name,
                tier,
                points
              )
            `)
            .eq('game_id', game.id);

          if (resultsError) throw resultsError;

          const formattedResults = (resultsData || []).map((r: any) => ({
            id: r.id,
            game_id: r.game_id,
            player_id: r.player_id,
            raw_score: r.raw_score,
            adjusted_score: r.adjusted_score,
            rank: r.rank,
            points_changed: r.points_changed,
            tier_after: r.tier_after as Tier,
            points_after: r.points_after,
            cost_paid: r.cost_paid,
            player_name: r.players?.name || 'Unknown',
            // Since db row has tier_after, we reconstruct before values
            player_tier_before: r.tier_after as Tier, // Approximate or just display current
            player_points_before: r.points_after,
          }));

          gamesWithResults.push({
            game: {
              id: game.id,
              played_at: game.played_at,
              notes: game.notes,
            },
            results: formattedResults,
          });
        }

        return gamesWithResults;
      } catch (error) {
        console.error('Supabase getGames error, falling back:', error);
      }
    }

    // Local Storage fallback
    const games = getLocalData<Game[]>('tierg_games', []);
    const results = getLocalData<GameResult[]>('tierg_results', []);
    const players = getLocalData<Player[]>('tierg_players', INITIAL_MOCK_PLAYERS);

    return games
      .map((game) => {
        const gameResults = results
          .filter((r) => r.game_id === game.id)
          .map((r) => {
            const player = players.find((p) => p.id === r.player_id);
            return {
              ...r,
              player_name: player?.name || 'Unknown',
              player_tier_before: player?.tier || 'Iron', // Approximate
              player_points_before: player?.points || 0,
            };
          })
          .sort((a, b) => a.rank - b.rank);

        return { game, results: gameResults };
      })
      .sort((a, b) => new Date(b.game.played_at).getTime() - new Date(a.game.played_at).getTime());
  }

  async addGame(
    notes: string,
    playedAt: string,
    resultsInput: { player_id: string; raw_score: number; cost_paid: number }[]
  ): Promise<GameWithResults> {
    // 1. Fetch current players state to perform accurate mathematical operations
    const players = await this.getPlayers();

    // 2. Map and calculate adjusted scores (raw_score - base_handicap)
    const processedResults = resultsInput.map((input) => {
      const player = players.find((p) => p.id === input.player_id);
      if (!player) throw new Error(`Player ${input.player_id} not found`);

      const adjustedScore = input.raw_score - player.base_handicap;
      return {
        ...input,
        player,
        adjustedScore,
      };
    });

    // 3. Sort by adjusted score ascending (lower score is better in golf) to determine rank
    processedResults.sort((a, b) => a.adjustedScore - b.adjustedScore);

    // Apply ranks (handling ties)
    let currentRank = 1;
    const rankedResults = processedResults.map((item, index) => {
      if (index > 0 && item.adjustedScore > processedResults[index - 1].adjustedScore) {
        currentRank = index + 1;
      }
      return {
        ...item,
        rank: currentRank,
      };
    });

    // 4. Assign LP changes based on rank
    // Assuming 4-player game defaults. If more or fewer, we scale appropriately.
    // 1st: +20 LP, 2nd: +10, 3rd: -10, 4th: -20
    const lpChangeByRank: Record<number, number> = {
      1: 20,
      2: 10,
      3: -10,
      4: -20,
    };

    const finalResults = rankedResults.map((item) => {
      // Fallback for games with size other than 4
      let pointsChanged = 0;
      if (rankedResults.length === 4) {
        pointsChanged = lpChangeByRank[item.rank] || 0;
      } else {
        // Dynamic formula for size != 4
        // E.g., top half gets +, bottom half gets -
        const median = (rankedResults.length + 1) / 2;
        if (item.rank < median) {
          pointsChanged = item.rank === 1 ? 20 : 10;
        } else if (item.rank > median) {
          pointsChanged = item.rank === rankedResults.length ? -20 : -10;
        } else {
          pointsChanged = 0; // Middle gets 0
        }
      }

      // Calculate new Tier and Points
      const { newTier, newPoints } = calculateNewTierAndPoints(
        item.player.tier,
        item.player.points,
        pointsChanged
      );

      return {
        ...item,
        pointsChanged,
        newTier,
        newPoints,
      };
    });

    // 5. Persist to Database or LocalStorage
    if (supabase) {
      try {
        // Insert Game
        const { data: gameData, error: gameError } = await supabase
          .from('games')
          .insert([{ notes, played_at: playedAt }])
          .select();

        if (gameError) throw gameError;
        const newGame = gameData[0] as Game;

        const resultsToInsert = [];

        // Update each player and prepare results rows
        for (const res of finalResults) {
          const { error: playerUpdateError } = await supabase
            .from('players')
            .update({
              tier: res.newTier,
              points: res.newPoints,
            })
            .eq('id', res.player.id);

          if (playerUpdateError) throw playerUpdateError;

          resultsToInsert.push({
            game_id: newGame.id,
            player_id: res.player.id,
            raw_score: res.raw_score,
            adjusted_score: res.adjustedScore,
            rank: res.rank,
            points_changed: res.pointsChanged,
            tier_after: res.newTier,
            points_after: res.newPoints,
            cost_paid: res.cost_paid,
          });
        }

        // Insert Game Results
        const { data: insertedResults, error: resultsInsertError } = await supabase
          .from('game_results')
          .insert(resultsToInsert)
          .select();

        if (resultsInsertError) throw resultsInsertError;

        // Re-fetch populated object to return
        const formattedResults = insertedResults.map((r: any) => {
          const originalRes = finalResults.find((fr) => fr.player.id === r.player_id)!;
          return {
            ...r,
            player_name: originalRes.player.name,
            player_tier_before: originalRes.player.tier,
            player_points_before: originalRes.player.points,
          };
        });

        return {
          game: newGame,
          results: formattedResults.sort((a, b) => a.rank - b.rank),
        };
      } catch (error) {
        console.error('Supabase addGame failed, falling back to local storage:', error);
      }
    }

    // Local Storage Implementation
    const localGames = getLocalData<Game[]>('tierg_games', []);
    const localResults = getLocalData<GameResult[]>('tierg_results', []);
    const localPlayers = getLocalData<Player[]>('tierg_players', INITIAL_MOCK_PLAYERS);

    const newGame: Game = {
      id: `g_${Date.now()}`,
      played_at: playedAt,
      notes,
    };

    localGames.push(newGame);

    const insertedResults: (GameResult & {
      player_name: string;
      player_tier_before: Tier;
      player_points_before: number;
    })[] = [];

    finalResults.forEach((res) => {
      // Update player in local list
      const playerIndex = localPlayers.findIndex((p) => p.id === res.player.id);
      if (playerIndex !== -1) {
        localPlayers[playerIndex].tier = res.newTier;
        localPlayers[playerIndex].points = res.newPoints;
      }

      const newResult: GameResult = {
        id: `r_${Date.now()}_${res.player.id}`,
        game_id: newGame.id,
        player_id: res.player.id,
        raw_score: res.raw_score,
        adjusted_score: res.adjustedScore,
        rank: res.rank,
        points_changed: res.pointsChanged,
        tier_after: res.newTier,
        points_after: res.newPoints,
        cost_paid: res.cost_paid,
      };

      localResults.push(newResult);

      insertedResults.push({
        ...newResult,
        player_name: res.player.name,
        player_tier_before: res.player.tier,
        player_points_before: res.player.points,
      });
    });

    setLocalData('tierg_games', localGames);
    setLocalData('tierg_results', localResults);
    setLocalData('tierg_players', localPlayers);

    return {
      game: newGame,
      results: insertedResults.sort((a, b) => a.rank - b.rank),
    };
  }

  // --- Player Details and History ---
  async getPlayerHistory(playerId: string): Promise<{
    player: Player;
    results: (GameResult & { played_at: string; notes?: string })[];
    stats: {
      totalGames: number;
      averageRawScore: number;
      bestRawScore: number;
      totalCost: number;
      averageCost: number;
      wins: number; // Rank 1
    };
  }> {
    const players = await this.getPlayers();
    const player = players.find((p) => p.id === playerId);
    if (!player) throw new Error('Player not found');

    let history: (GameResult & { played_at: string; notes?: string })[] = [];

    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('game_results')
          .select(`
            *,
            games (
              played_at,
              notes
            )
          `)
          .eq('player_id', playerId)
          .order('created_at', { ascending: false });

        if (error) throw error;

        history = (data || []).map((r: any) => ({
          id: r.id,
          game_id: r.game_id,
          player_id: r.player_id,
          raw_score: r.raw_score,
          adjusted_score: r.adjusted_score,
          rank: r.rank,
          points_changed: r.points_changed,
          tier_after: r.tier_after as Tier,
          points_after: r.points_after,
          cost_paid: r.cost_paid,
          played_at: r.games?.played_at || '',
          notes: r.games?.notes || '',
        }));
      } catch (error) {
        console.error('Supabase getPlayerHistory failed, falling back:', error);
      }
    }

    if (!supabase || history.length === 0) {
      // Local fallback
      const localGames = getLocalData<Game[]>('tierg_games', []);
      const localResults = getLocalData<GameResult[]>('tierg_results', []);

      history = localResults
        .filter((r) => r.player_id === playerId)
        .map((r) => {
          const game = localGames.find((g) => g.id === r.game_id);
          return {
            ...r,
            played_at: game?.played_at || '',
            notes: game?.notes,
          };
        })
        .sort((a, b) => new Date(b.played_at).getTime() - new Date(a.played_at).getTime());
    }

    // Calculate Stats
    const totalGames = history.length;
    const averageRawScore =
      totalGames > 0 ? history.reduce((sum, r) => sum + r.raw_score, 0) / totalGames : 0;
    const bestRawScore =
      totalGames > 0 ? Math.min(...history.map((r) => r.raw_score)) : 0;
    const totalCost = history.reduce((sum, r) => sum + r.cost_paid, 0);
    const averageCost = totalGames > 0 ? totalCost / totalGames : 0;
    const wins = history.filter((r) => r.rank === 1).length;

    return {
      player,
      results: history,
      stats: {
        totalGames,
        averageRawScore,
        bestRawScore,
        totalCost,
        averageCost,
        wins,
      },
    };
  }

  // --- Reset/Demodata Helper (Only in demo mode) ---
  resetDatabase(): void {
    if (this.isSupabaseMode()) {
      console.warn('Cannot reset database in Supabase mode directly.');
      return;
    }
    localStorage.removeItem('tierg_players');
    localStorage.removeItem('tierg_games');
    localStorage.removeItem('tierg_results');
    console.log('Demo database reset to default 10 players.');
  }
}

export const tiergService = new TierGService();
