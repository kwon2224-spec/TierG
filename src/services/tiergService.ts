import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { type Player, type PlayerStatus, type MatchMode, type Game, type GameResult, type GameWithResults, type Tier, type PlayerWithStats, TIERS_ORDER, TIER_HANDICAPS } from '../types';

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

// 2. Initial Mock Players for Local Demo Mode (Synchronized with Real 11 Friends)
const INITIAL_MOCK_PLAYERS: Player[] = [
  { id: 'p1', name: '부성훈', tier: 'Challenger', points: 50, base_handicap: 0, status: 'Active', is_admin: false, nickname: '#챌린저수호자' },
  { id: 'p2', name: '이평화', tier: 'Challenger', points: 50, base_handicap: 0, status: 'Active', is_admin: false, nickname: '#스크린파괴자' },
  { id: 'p3', name: '최문규', tier: 'Master', points: 50, base_handicap: 5, status: 'Active', is_admin: false, nickname: '#드라이버싱글' },
  { id: 'p4', name: '김창범', tier: 'Emerald', points: 50, base_handicap: 10, status: 'Active', is_admin: false, nickname: '#정교한아이언' },
  { id: 'p5', name: '권기원', tier: 'Emerald', points: 50, base_handicap: 10, status: 'Active', is_admin: true, nickname: '#개발실싱글' }, // 마스터 총무 관리자!
  { id: 'p6', name: '안재민', tier: 'Platinum', points: 50, base_handicap: 12, status: 'Active', is_admin: false, nickname: '#에이밍의마술사' },
  { id: 'p7', name: '이승무', tier: 'Platinum', points: 50, base_handicap: 12, status: 'Active', is_admin: false, nickname: '#인생라베타수' },
  { id: 'p8', name: '황지운', tier: 'Gold', points: 50, base_handicap: 15, status: 'Active', is_admin: false, nickname: '#퍼터의신' },
  { id: 'p9', name: '나용성', tier: 'Gold', points: 50, base_handicap: 15, status: 'Active', is_admin: false, nickname: '#필드버디왕' },
  { id: 'p10', name: '이창훈', tier: 'Bronze', points: 50, base_handicap: 20, status: 'Active', is_admin: false, nickname: '#슬라이스정복' },
  { id: 'p11', name: '박진범', tier: 'Silver', points: 50, base_handicap: 20, status: 'Active', is_admin: false, nickname: '#골프천재새내기' },
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

  async getPlayersWithStats(): Promise<PlayerWithStats[]> {
    const players = await this.getPlayers();
    
    // Fetch all game results in one single high-speed joined query!
    let allResults: any[] = [];
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('game_results')
          .select(`
            player_id,
            raw_score,
            cost_paid,
            points_changed,
            rank,
            bet_amount,
            games ( notes )
          `);
        if (!error && data) {
          allResults = data;
        }
      } catch (err) {
        console.error('Failed to fetch game_results for stats:', err);
      }
    } else {
      const localResults = getLocalData<any[]>('tierg_results', []);
      const localGames = getLocalData<any[]>('tierg_games', []);
      allResults = localResults.map((r) => ({
        ...r,
        games: localGames.find((g) => g.id === r.game_id),
      }));
    }

    // Group results by player_id
    const resultsByPlayer: Record<string, any[]> = {};
    allResults.forEach((r) => {
      if (!resultsByPlayer[r.player_id]) {
        resultsByPlayer[r.player_id] = [];
      }
      resultsByPlayer[r.player_id].push(r);
    });

    // Compute stats for each player in-memory (0ms lag!)
    return players.map((player) => {
      const pResults = resultsByPlayer[player.id] || [];
      const totalGames = pResults.length;

      // 18-hole non-guillotine matches for Best Raw Score (라베)
      const nonGuillotine = pResults.filter((r) => (r.bet_amount || 0) === 0);
      const bestRawScore = nonGuillotine.length > 0
        ? Math.min(...nonGuillotine.map((r) => r.raw_score))
        : 0;

      // Real out-of-pocket cash spent (includes normal match expenses + concentrated Guillotine loser bills!)
      // Survivors pay 0 won, while the Guillotine loser takes the entire concentrated bill, matching real wallet transactions!
      const totalCost = pResults.reduce((sum, r) => sum + (r.cost_paid || 0), 0);

      // Unified League Win/Loss calculation
      let leagueWins = 0;
      let leagueLosses = 0;

      pResults.forEach((r) => {
        const isGuillotine = (r.bet_amount || 0) > 0;
        const isScratch = r.games?.notes?.includes('[스크래치]');

        if (isGuillotine) {
          if (r.cost_paid === 0) leagueWins++;
          else leagueLosses++;
        } else if (isScratch) {
          if (r.rank <= 2) leagueWins++;
          else leagueLosses++;
        } else {
          if (r.points_changed >= 0) leagueWins++;
          else leagueLosses++;
        }
      });

      const winRate = totalGames > 0 ? Math.round((leagueWins / totalGames) * 100) : 0;

      return {
        ...player,
        bestRawScore,
        totalGames,
        leagueWins,
        leagueLosses,
        winRate,
        totalCost,
      };
    });
  }

  async addPlayer(
    name: string,
    baseHandicap: number,
    tier: Tier = 'Iron',
    points: number = 50,
    nickname: string = ''
  ): Promise<Player> {
    if (supabase) {
      const { data, error } = await supabase
        .from('players')
        .insert([{ name, base_handicap: baseHandicap, tier, points, status: 'Active', nickname }])
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
      tier,
      points,
      base_handicap: baseHandicap,
      status: 'Active',
      nickname,
    };
    players.push(newPlayer);
    setLocalData('tierg_players', players);
    return newPlayer;
  }

  async updatePlayerHandicap(id: string, newHandicap: number, nickname: string = '', newTier?: Tier, newPoints?: number): Promise<Player> {
    if (supabase) {
      const updatePayload: any = { base_handicap: newHandicap, nickname };
      if (newTier) {
        updatePayload.tier = newTier;
      }
      if (newPoints !== undefined) {
        updatePayload.points = newPoints;
      }

      const { data, error } = await supabase
        .from('players')
        .update(updatePayload)
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
    players[playerIndex].nickname = nickname;
    if (newTier) {
      players[playerIndex].tier = newTier;
    }
    if (newPoints !== undefined) {
      players[playerIndex].points = newPoints;
    }
    setLocalData('tierg_players', players);
    return players[playerIndex];
  }

  async updatePlayerStatus(id: string, status: PlayerStatus): Promise<Player> {
    if (supabase) {
      const { data, error } = await supabase
        .from('players')
        .update({ status })
        .eq('id', id)
        .select();
      if (error) {
        throw new Error(`Supabase updatePlayerStatus failed: ${error.message}`);
      }
      return data[0] as Player;
    }

    // Local Storage fallback
    const players = getLocalData<Player[]>('tierg_players', INITIAL_MOCK_PLAYERS);
    const playerIndex = players.findIndex((p) => p.id === id);
    if (playerIndex === -1) throw new Error('Player not found');
    players[playerIndex].status = status;
    setLocalData('tierg_players', players);
    return players[playerIndex];
  }

  async updatePlayerAdminStatus(id: string, isAdmin: boolean): Promise<Player> {
    if (supabase) {
      const { data, error } = await supabase
        .from('players')
        .update({ is_admin: isAdmin })
        .eq('id', id)
        .select();
      if (error) {
        throw new Error(`Supabase updatePlayerAdminStatus failed: ${error.message}`);
      }
      return data[0] as Player;
    }

    // Local Storage fallback
    const players = getLocalData<Player[]>('tierg_players', INITIAL_MOCK_PLAYERS);
    const playerIndex = players.findIndex((p) => p.id === id);
    if (playerIndex === -1) throw new Error('Player not found');
    players[playerIndex].is_admin = isAdmin;
    setLocalData('tierg_players', players);
    return players[playerIndex];
  }

  async deletePlayer(id: string): Promise<void> {
    if (supabase) {
      const { error } = await supabase
        .from('players')
        .delete()
        .eq('id', id);
      if (error) {
        throw new Error(`Supabase deletePlayer failed: ${error.message}`);
      }
    } else {
      // Local Storage fallback
      const players = getLocalData<Player[]>('tierg_players', INITIAL_MOCK_PLAYERS);
      const updated = players.filter((p) => p.id !== id);
      setLocalData('tierg_players', updated);
    }
  }

  // --- Games API ---
  async getGames(): Promise<GameWithResults[]> {
    if (supabase) {
      try {
        // 1. Fetch all games in one single query
        const { data: gamesData, error: gamesError } = await supabase
          .from('games')
          .select('*')
          .order('played_at', { ascending: false });

        if (gamesError) throw gamesError;

        if (!gamesData || gamesData.length === 0) return [];

        // 2. Fetch ALL results for ALL games in one single query (Resolves N+1 query bottleneck!)
        const { data: resultsData, error: resultsError } = await supabase
          .from('game_results')
          .select(`
            *,
            players (
              name,
              tier,
              points
            )
          `);

        if (resultsError) throw resultsError;

        // 3. Map and group results by game_id in-memory (Incredibly fast!)
        const resultsByGameId: Record<string, any[]> = {};
        (resultsData || []).forEach((r: any) => {
          if (!resultsByGameId[r.game_id]) {
            resultsByGameId[r.game_id] = [];
          }

          // Accurately reconstruct the true tier before this game using inverse math!
          const { newTier: tierBefore, newPoints: pointsBefore } = calculateNewTierAndPoints(
            r.tier_after as Tier,
            r.points_after,
            -r.points_changed
          );

          resultsByGameId[r.game_id].push({
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
            bet_amount: r.bet_amount || 0,
            player_name: r.players?.name || 'Unknown',
            player_tier_before: tierBefore,
            player_points_before: pointsBefore,
          });
        });

        // 4. Assemble the final GamesWithResults list
        const gamesWithResults = gamesData.map((game) => {
          const formattedResults = resultsByGameId[game.id] || [];
          // Sort results by rank ascending
          formattedResults.sort((a, b) => a.rank - b.rank);
          
          return {
            game: {
              id: game.id,
              played_at: game.played_at,
              notes: game.notes,
            },
            results: formattedResults,
          };
        });

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
    resultsInput: { player_id: string; raw_score: number; cost_paid: number; custom_handicap?: number }[],
    matchMode: MatchMode = 'handicap'
  ): Promise<GameWithResults> {
    // 1. Fetch current players state to perform accurate mathematical operations
    const players = await this.getPlayers();

    // 2. Map and calculate adjusted scores depending on MatchMode and custom_handicap
    const processedResults = resultsInput.map((input) => {
      const player = players.find((p) => p.id === input.player_id);
      if (!player) throw new Error(`Player ${input.player_id} not found`);

      // If 'scratch' mode, no handicap is applied (adjusted_score = raw_score)
      // Otherwise, use custom_handicap if provided, fallback to the player's permanent base_handicap
      const finalHandicap = input.custom_handicap !== undefined ? input.custom_handicap : player.base_handicap;
      const adjustedScore = matchMode === 'scratch' ? input.raw_score : input.raw_score - finalHandicap;
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

    // 4. Assign LP changes based on rank and MatchMode
    // Assuming 4-player game defaults. If more or fewer, we scale appropriately.
    // 1st: +20 LP, 2nd: +10, 3rd: -10, 4th: -20
    const lpChangeByRank: Record<number, number> = {
      1: 20,
      2: 10,
      3: -10,
      4: -20,
    };

    const maxAdjustedScore = Math.max(...rankedResults.map(r => r.adjustedScore));
    const minAdjustedScore = Math.min(...rankedResults.map(r => r.adjustedScore));
    const isAllTied = minAdjustedScore === maxAdjustedScore;

    const hasAnyCost = rankedResults.some(r => r.cost_paid > 0);

    const finalResults = rankedResults.map((item) => {
      let pointsChanged = 0;
      
      if (matchMode === 'scratch' || matchMode === 'guillotine') {
        // Scratch and Guillotine modes do NOT change points or tiers (LP is frozen!)
        pointsChanged = 0;
      } else if (isAllTied) {
        // If everyone has the exact same score, it's a draw (0 LP)
        pointsChanged = 0;
      } else if (hasAnyCost) {
        // 룰 적용: 돈 내면 무조건 마이너스 (-), 안 내면 무조건 플러스 (+)
        // (공동) 1등은 +20, (공동) 꼴찌는 -20 유지!
        const paidMoney = item.cost_paid > 0;
        const isFirst = item.rank === 1;
        const isLast = item.adjustedScore === maxAdjustedScore;

        if (paidMoney) {
          pointsChanged = isLast ? -20 : -10;
        } else {
          pointsChanged = isFirst ? 20 : 10;
        }
      } else if (item.adjustedScore === maxAdjustedScore) {
        // 비용 미입력 친선전 시 기존 랭킹 기반 분배 폴백
        pointsChanged = -20;
      } else {
        if (rankedResults.length === 4) {
          pointsChanged = lpChangeByRank[item.rank] || 0;
        } else {
          const median = (rankedResults.length + 1) / 2;
          if (item.rank < median) {
            pointsChanged = item.rank === 1 ? 20 : 10;
          } else if (item.rank > median) {
            pointsChanged = item.rank === rankedResults.length ? -20 : -10;
          } else {
            pointsChanged = 0;
          }
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

    // Recalculate cost distribution if MatchMode is 'guillotine'
    let finalCosts = finalResults.map(r => ({ player_id: r.player.id, cost: r.cost_paid }));
    if (matchMode === 'guillotine' && finalResults.length > 0) {
      // Calculate total group expense
      const totalCostSum = finalResults.reduce((sum, item) => sum + item.cost_paid, 0);
      
      // Find the absolute last place (maximum rank number, e.g. 4th place)
      const maxRank = Math.max(...finalResults.map(r => r.rank));
      
      // Find how many players are in this last place (to divide the bill in case of ties!)
      const losers = finalResults.filter(r => r.rank === maxRank);
      const loserCostShare = Math.round(totalCostSum / losers.length);

      // Set losers to pay the total/divided share, and winners pay 0!
      finalCosts = finalResults.map(r => {
        if (r.rank === maxRank) {
          return { player_id: r.player.id, cost: loserCostShare };
        }
        return { player_id: r.player.id, cost: 0 };
      });
    }

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

        // Update each player and prepare results rows (with intelligent automatic handicap sync on tier change!)
        for (const res of finalResults) {
          const updatePayload: any = {
            tier: res.newTier,
            points: res.newPoints,
          };
          
          // Only force handicap sync if the player actually promoted or demoted to a different tier!
          // This perfectly preserves any manual custom handicaps adjusted by the admin within the same tier!
          if (res.newTier !== res.player.tier) {
            updatePayload.base_handicap = TIER_HANDICAPS[res.newTier];
          }

          const { error: playerUpdateError } = await supabase
            .from('players')
            .update(updatePayload)
            .eq('id', res.player.id);

          if (playerUpdateError) throw playerUpdateError;

          // Find the calculated cost share for this player (winners get 0, losers get total/divided)
          const computedCost = finalCosts.find(c => c.player_id === res.player.id)?.cost ?? res.cost_paid;

          resultsToInsert.push({
            game_id: newGame.id,
            player_id: res.player.id,
            raw_score: res.raw_score,
            adjusted_score: res.adjustedScore,
            rank: res.rank,
            points_changed: res.pointsChanged,
            tier_after: res.newTier,
            points_after: res.newPoints,
            cost_paid: computedCost,
            bet_amount: matchMode === 'guillotine' ? res.cost_paid : 0, // Save original bet for Guillotine Mode stats!
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
      // Update player in local list (with automatic handicap sync!)
      const playerIndex = localPlayers.findIndex((p) => p.id === res.player.id);
      if (playerIndex !== -1) {
        localPlayers[playerIndex].tier = res.newTier;
        localPlayers[playerIndex].points = res.newPoints;
        localPlayers[playerIndex].base_handicap = TIER_HANDICAPS[res.newTier]; // <--- Sync!
      }

      const computedCost = finalCosts.find(c => c.player_id === res.player.id)?.cost ?? res.cost_paid;

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
        cost_paid: computedCost,
        bet_amount: matchMode === 'guillotine' ? res.cost_paid : 0, // Save original bet for Local fallback stats!
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
      guillotineLost: number;  // Total paid as a Guillotine loser
      guillotineSaved: number; // Total saved/evaded as a Guillotine survivor
      guillotineWins: number;
      guillotineLosses: number;
      leagueWins: number;      // Unified wins across all match types!
      leagueLosses: number;    // Unified losses across all match types!
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
          bet_amount: r.bet_amount || 0, // Parse the custom bet amount column
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
    // Exclude Guillotine (9-hole matches!) from Lifetime Best 18-hole raw score (라베) calculation!
    const nonGuillotineResults = history.filter((r) => (r.bet_amount || 0) === 0);
    const bestRawScore = nonGuillotineResults.length > 0
      ? Math.min(...nonGuillotineResults.map((r) => r.raw_score))
      : 0;

    // Real out-of-pocket cash spent (includes normal match expenses + concentrated Guillotine loser bills!)
    // Survivors pay 0 won, while the Guillotine loser takes the entire concentrated bill!
    const totalCost = history.reduce((sum, r) => sum + (r.cost_paid || 0), 0);
    const averageCost = totalGames > 0 ? totalCost / totalGames : 0;
    
    // Wins count strictly tracks handicap & scratch 1st place victories (excluding Guillotine completely!)
    const wins = history.filter((r) => r.rank === 1 && (r.bet_amount || 0) === 0).length;

    // Calculate dynamic Guillotine stats based on bet_amount column
    // Net Guillotine Loss: Only the extra money paid for other players (Total Paid - Own Bet)
    const guillotineLost = history.reduce((sum, r) => {
      const bet = r.bet_amount || 0;
      if (bet > 0 && r.cost_paid > bet) {
        return sum + (r.cost_paid - bet); // Only add the extra net loss paid on behalf of others!
      }
      return sum;
    }, 0);

    const guillotineSaved = history.reduce((sum, r) => {
      const bet = r.bet_amount || 0;
      return sum + (bet > 0 && r.cost_paid === 0 ? bet : 0);
    }, 0);

    const guillotineWins = history.filter((r) => (r.bet_amount || 0) > 0 && r.cost_paid === 0).length;
    const guillotineLosses = history.filter((r) => (r.bet_amount || 0) > 0 && r.cost_paid > 0).length;

    // Calculate dynamic unified League Wins/Losses (Universal Overall Win Rate!)
    let leagueWins = 0;
    let leagueLosses = 0;

    history.forEach((r) => {
      const isGuillotine = (r.bet_amount || 0) > 0;
      const isScratch = r.notes?.includes('[스크래치]');
      
      if (isGuillotine) {
        // Guillotine: surviving (cost_paid === 0) is a Win!
        if (r.cost_paid === 0) {
          leagueWins++;
        } else {
          leagueLosses++;
        }
      } else if (isScratch) {
        // Scratch: finishing in the top half (rank 1 or 2, i.e. rank <= 2) is a Win!
        if (r.rank <= 2) {
          leagueWins++;
        } else {
          leagueLosses++;
        }
      } else {
        // Handicap: positive or neutral LP change (points_changed >= 0) is a Win!
        if (r.points_changed >= 0) {
          leagueWins++;
        } else {
          leagueLosses++;
        }
      }
    });

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
        guillotineLost,
        guillotineSaved,
        guillotineWins,
        guillotineLosses,
        leagueWins,
        leagueLosses,
      },
    };
  }

  // --- Delete Game & Rollback LP/Tier API ---
  async deleteGame(gameId: string): Promise<void> {
    // 1. Fetch all games to locate the target game
    const games = await this.getGames();
    if (games.length === 0) throw new Error('삭제할 게임이 없습니다.');
    
    const targetGame = games.find(g => g.game.id === gameId);
    if (!targetGame) {
      throw new Error('삭제 및 롤백할 경기를 찾을 수 없습니다.');
    }

    // 2. Fetch results for this specific game to revert players
    const resultsToRevert = targetGame.results;

    // Load current live players state so we can apply the delta directly to their CURRENT scores!
    const livePlayers = await this.getPlayers();

    if (supabase) {
      try {
        // Revert each player's tier and points in Supabase using the live delta formula!
        for (const res of resultsToRevert) {
          const livePlayer = livePlayers.find(p => p.id === res.player_id);
          if (!livePlayer) continue;

          // Run mathematical delta inverse against CURRENT points, preserving subsequent game results!
          const { newTier: tierBefore, newPoints: pointsBefore } = calculateNewTierAndPoints(
            livePlayer.tier,
            livePlayer.points,
            -res.points_changed
          );

          const updatePayload: any = {
            tier: tierBefore,
            points: pointsBefore,
          };
          
          // Only rollback base_handicap if the player's tier actually rolls back to a different one!
          if (tierBefore !== livePlayer.tier) {
            updatePayload.base_handicap = TIER_HANDICAPS[tierBefore];
          }

          const { error: playerUpdateError } = await supabase
            .from('players')
            .update(updatePayload)
            .eq('id', res.player_id);

          if (playerUpdateError) {
            throw new Error(`플레이어(${res.player_name}) 전적 롤백 실패: ${playerUpdateError.message}`);
          }
        }

        // Delete the game results first explicitly (to bypass any DB foreign key constraints)
        const { error: resultsDeleteError } = await supabase
          .from('game_results')
          .delete()
          .eq('game_id', gameId);

        if (resultsDeleteError) {
          throw new Error(`상세 전적 데이터 삭제 실패: ${resultsDeleteError.message}`);
        }

        // Delete the game from games table
        const { error: gameDeleteError } = await supabase
          .from('games')
          .delete()
          .eq('id', gameId);

        if (gameDeleteError) {
          throw new Error(`경기 메인 데이터 삭제 실패: ${gameDeleteError.message}`);
        }
      } catch (err: any) {
        console.error('Verbose deleteGame error:', err);
        throw err;
      }
    } else {
      // Local Storage fallback
      const localGames = getLocalData<Game[]>('tierg_games', []);
      const localResults = getLocalData<GameResult[]>('tierg_results', []);
      const localPlayers = getLocalData<Player[]>('tierg_players', INITIAL_MOCK_PLAYERS);

      // Revert each player using delta inverse on live local states
      resultsToRevert.forEach((res) => {
        const playerIndex = localPlayers.findIndex((p) => p.id === res.player_id);
        if (playerIndex !== -1) {
          const livePlayer = localPlayers[playerIndex];
          const { newTier: tierBefore, newPoints: pointsBefore } = calculateNewTierAndPoints(
            livePlayer.tier,
            livePlayer.points,
            -res.points_changed
          );
          localPlayers[playerIndex].tier = tierBefore;
          localPlayers[playerIndex].points = pointsBefore;
        }
      });

      // Filter out the deleted game and its results
      const updatedGames = localGames.filter((g) => g.id !== gameId);
      const updatedResults = localResults.filter((r) => r.game_id !== gameId);

      setLocalData('tierg_games', updatedGames);
      setLocalData('tierg_results', updatedResults);
      setLocalData('tierg_players', localPlayers);
    }
  }

  // --- Update Game & Re-evaluate LP/Tier API ---
  async updateGame(
    gameId: string,
    notes: string,
    playedAt: string,
    resultsInput: { player_id: string; raw_score: number; cost_paid: number; custom_handicap?: number }[],
    matchMode: MatchMode = 'handicap'
  ): Promise<void> {
    // Prefix notes dynamically depending on selected MatchMode to prevent mode erasure!
    let finalNotes = notes.trim();
    if (matchMode === 'scratch') {
      finalNotes = `[스크래치] ${finalNotes}`;
    } else if (matchMode === 'guillotine') {
      finalNotes = `[단두대] ${finalNotes}`;
    }

    // 1. Fetch current games to locate the target original game
    const games = await this.getGames();
    const targetGame = games.find(g => g.game.id === gameId);
    if (!targetGame) throw new Error('수정할 경기를 찾을 수 없습니다.');

    const resultsToRevert = targetGame.results;

    // Load current live players state so we can apply rollback and recalculation dynamically!
    const livePlayers = await this.getPlayers();

    if (supabase) {
      try {
        // STEP A: Revert old LP and points in Supabase first!
        for (const res of resultsToRevert) {
          const livePlayer = livePlayers.find(p => p.id === res.player_id);
          if (!livePlayer) continue;

          // Inverse LP delta math
          const { newTier: tierBefore, newPoints: pointsBefore } = calculateNewTierAndPoints(
            livePlayer.tier,
            livePlayer.points,
            -res.points_changed
          );

          const { error: playerRollbackError } = await supabase
            .from('players')
            .update({ tier: tierBefore, points: pointsBefore })
            .eq('id', res.player_id);

          if (playerRollbackError) throw playerRollbackError;

          // Update our in-memory livePlayers array to utilize reverted base for subsequent calculation!
          livePlayer.tier = tierBefore;
          livePlayer.points = pointsBefore;
        }

        // STEP B: Update Game Metadata with prefixed finalNotes!
        const { error: gameUpdateError } = await supabase
          .from('games')
          .update({ notes: finalNotes, played_at: playedAt })
          .eq('id', gameId);

        if (gameUpdateError) throw gameUpdateError;

        // STEP C: Recalculate ranks, points, and tiers based on edited inputs!
        const processedResults = resultsInput.map((input) => {
          const player = livePlayers.find((p) => p.id === input.player_id);
          if (!player) throw new Error(`Player ${input.player_id} not found`);

          const finalHandicap = input.custom_handicap !== undefined ? input.custom_handicap : player.base_handicap;
          const adjustedScore = matchMode === 'scratch' ? input.raw_score : input.raw_score - finalHandicap;
          return {
            ...input,
            player,
            adjustedScore,
          };
        });

        processedResults.sort((a, b) => a.adjustedScore - b.adjustedScore);

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

        const lpChangeByRank: Record<number, number> = {
          1: 20,
          2: 10,
          3: -10,
          4: -20,
        };

        const maxAdjustedScore = Math.max(...rankedResults.map(r => r.adjustedScore));
        const minAdjustedScore = Math.min(...rankedResults.map(r => r.adjustedScore));
        const isAllTied = minAdjustedScore === maxAdjustedScore;

        const hasAnyCost = rankedResults.some(r => r.cost_paid > 0);

        const finalResults = rankedResults.map((item) => {
          let pointsChanged = 0;
          
          if (matchMode === 'scratch' || matchMode === 'guillotine') {
            pointsChanged = 0;
          } else if (isAllTied) {
            pointsChanged = 0;
          } else if (hasAnyCost) {
            // 룰 적용: 돈 내면 무조건 마이너스 (-), 안 내면 무조건 플러스 (+)
            // (공동) 1등은 +20, (공동) 꼴찌는 -20 유지!
            const paidMoney = item.cost_paid > 0;
            const isFirst = item.rank === 1;
            const isLast = item.adjustedScore === maxAdjustedScore;

            if (paidMoney) {
              pointsChanged = isLast ? -20 : -10;
            } else {
              pointsChanged = isFirst ? 20 : 10;
            }
          } else if (item.adjustedScore === maxAdjustedScore) {
            pointsChanged = -20;
          } else {
            if (rankedResults.length === 4) {
              pointsChanged = lpChangeByRank[item.rank] || 0;
            } else {
              const median = (rankedResults.length + 1) / 2;
              if (item.rank < median) {
                pointsChanged = item.rank === 1 ? 20 : 10;
              } else if (item.rank > median) {
                pointsChanged = item.rank === rankedResults.length ? -20 : -10;
              } else {
                pointsChanged = 0;
              }
            }
          }

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

        // Recalculate Guillotine cost shares if necessary
        let finalCosts = finalResults.map(r => ({ player_id: r.player.id, cost: r.cost_paid }));
        if (matchMode === 'guillotine' && finalResults.length > 0) {
          const totalCostSum = finalResults.reduce((sum, item) => sum + item.cost_paid, 0);
          const maxRank = Math.max(...finalResults.map(r => r.rank));
          const losers = finalResults.filter(r => r.rank === maxRank);
          const loserCostShare = Math.round(totalCostSum / losers.length);

          finalCosts = finalResults.map(r => {
            if (r.rank === maxRank) {
              return { player_id: r.player.id, cost: loserCostShare };
            }
            return { player_id: r.player.id, cost: 0 };
          });
        }

        // STEP D: Save newly calculated points and tiers to Supabase (with intelligent automatic handicap sync on tier change!)
        for (const res of finalResults) {
          const updatePayload: any = {
            tier: res.newTier,
            points: res.newPoints,
          };
          
          // Only force handicap sync if the player actually promoted or demoted to a different tier!
          // This perfectly preserves any manual custom handicaps adjusted by the admin within the same tier!
          if (res.newTier !== res.player.tier) {
            updatePayload.base_handicap = TIER_HANDICAPS[res.newTier];
          }

          const { error: playerUpdateError } = await supabase
            .from('players')
            .update(updatePayload)
            .eq('id', res.player.id);

          if (playerUpdateError) throw playerUpdateError;
        }

        // Delete old results rows from game_results
        const { error: resultsDeleteError } = await supabase
          .from('game_results')
          .delete()
          .eq('game_id', gameId);

        if (resultsDeleteError) throw resultsDeleteError;

        // Build new results rows to insert
        const resultsToInsert = finalResults.map((res) => {
          const computedCost = finalCosts.find(c => c.player_id === res.player.id)?.cost ?? res.cost_paid;
          return {
            game_id: gameId,
            player_id: res.player.id,
            raw_score: res.raw_score,
            adjusted_score: res.adjustedScore,
            rank: res.rank,
            points_changed: res.pointsChanged,
            tier_after: res.newTier,
            points_after: res.newPoints,
            cost_paid: computedCost,
            bet_amount: matchMode === 'guillotine' ? res.cost_paid : 0,
          };
        });

        // Insert new results rows
        const { error: resultsInsertError } = await supabase
          .from('game_results')
          .insert(resultsToInsert);

        if (resultsInsertError) throw resultsInsertError;

      } catch (err: any) {
        console.error('Verbose updateGame Supabase failed:', err);
        throw err;
      }
    } else {
      // Local Storage fallback
      const localGames = getLocalData<Game[]>('tierg_games', []);
      const localResults = getLocalData<GameResult[]>('tierg_results', []);
      const localPlayers = getLocalData<Player[]>('tierg_players', INITIAL_MOCK_PLAYERS);

      // 1. Rollback locally
      resultsToRevert.forEach((res) => {
        const playerIndex = localPlayers.findIndex((p) => p.id === res.player_id);
        if (playerIndex !== -1) {
          const livePlayer = localPlayers[playerIndex];
          const { newTier: tierBefore, newPoints: pointsBefore } = calculateNewTierAndPoints(
            livePlayer.tier,
            livePlayer.points,
            -res.points_changed
          );
          localPlayers[playerIndex].tier = tierBefore;
          localPlayers[playerIndex].points = pointsBefore;
        }
      });

      // 2. Update metadata with prefixed finalNotes!
      const gameIdx = localGames.findIndex(g => g.id === gameId);
      if (gameIdx !== -1) {
        localGames[gameIdx].notes = finalNotes;
        localGames[gameIdx].played_at = playedAt;
      }

      // 3. Recalculate locally
      const processedResults = resultsInput.map((input) => {
        const player = localPlayers.find((p) => p.id === input.player_id)!;
        const finalHandicap = input.custom_handicap !== undefined ? input.custom_handicap : player.base_handicap;
        const adjustedScore = matchMode === 'scratch' ? input.raw_score : input.raw_score - finalHandicap;
        return {
          ...input,
          player,
          adjustedScore,
        };
      });

      processedResults.sort((a, b) => a.adjustedScore - b.adjustedScore);

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

      const lpChangeByRank: Record<number, number> = {
        1: 20,
        2: 10,
        3: -10,
        4: -20,
      };

      const maxAdjustedScore = Math.max(...rankedResults.map(r => r.adjustedScore));
      const minAdjustedScore = Math.min(...rankedResults.map(r => r.adjustedScore));
      const isAllTied = minAdjustedScore === maxAdjustedScore;

      const hasAnyCost = rankedResults.some(r => r.cost_paid > 0);

      const finalResults = rankedResults.map((item) => {
        let pointsChanged = 0;
        
        if (matchMode === 'scratch' || matchMode === 'guillotine') {
          pointsChanged = 0;
        } else if (isAllTied) {
          pointsChanged = 0;
        } else if (hasAnyCost) {
          // 룰 적용: 돈 내면 무조건 마이너스 (-), 안 내면 무조건 플러스 (+)
          // (공동) 1등은 +20, (공동) 꼴찌는 -20 유지!
          const paidMoney = item.cost_paid > 0;
          const isFirst = item.rank === 1;
          const isLast = item.adjustedScore === maxAdjustedScore;

          if (paidMoney) {
            pointsChanged = isLast ? -20 : -10;
          } else {
            pointsChanged = isFirst ? 20 : 10;
          }
        } else if (item.adjustedScore === maxAdjustedScore) {
          pointsChanged = -20;
        } else {
          if (rankedResults.length === 4) {
            pointsChanged = lpChangeByRank[item.rank] || 0;
          } else {
            const median = (rankedResults.length + 1) / 2;
            if (item.rank < median) {
              pointsChanged = item.rank === 1 ? 20 : 10;
            } else if (item.rank > median) {
              pointsChanged = item.rank === rankedResults.length ? -20 : -10;
            } else {
              pointsChanged = 0;
            }
          }
        }

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

      // Cost shares
      let finalCosts = finalResults.map(r => ({ player_id: r.player.id, cost: r.cost_paid }));
      if (matchMode === 'guillotine' && finalResults.length > 0) {
        const totalCostSum = finalResults.reduce((sum, item) => sum + item.cost_paid, 0);
        const maxRank = Math.max(...finalResults.map(r => r.rank));
        const losers = finalResults.filter(r => r.rank === maxRank);
        const loserCostShare = Math.round(totalCostSum / losers.length);

        finalCosts = finalResults.map(r => {
          if (r.rank === maxRank) {
            return { player_id: r.player.id, cost: loserCostShare };
          }
          return { player_id: r.player.id, cost: 0 };
        });
      }

      // Update local players and write new localResults rows
      finalResults.forEach((res) => {
        const pIdx = localPlayers.findIndex(p => p.id === res.player_id);
        if (pIdx !== -1) {
          localPlayers[pIdx].tier = res.newTier;
          localPlayers[pIdx].points = res.newPoints;
        }
      });

      // Filter out old results rows
      const filteredResults = localResults.filter(r => r.game_id !== gameId);

      // Insert new results rows
      finalResults.forEach((res) => {
        const computedCost = finalCosts.find(c => c.player_id === res.player_id)?.cost ?? res.cost_paid;
        filteredResults.push({
          id: `r_${Date.now()}_${res.player_id}`,
          game_id: gameId,
          player_id: res.player_id,
          raw_score: res.raw_score,
          adjusted_score: res.adjustedScore,
          rank: res.rank,
          points_changed: res.pointsChanged,
          tier_after: res.newTier,
          points_after: res.newPoints,
          cost_paid: computedCost,
          bet_amount: matchMode === 'guillotine' ? res.cost_paid : 0,
        });
      });

      setLocalData('tierg_players', localPlayers);
      setLocalData('tierg_games', localGames);
      setLocalData('tierg_results', filteredResults);
    }
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
