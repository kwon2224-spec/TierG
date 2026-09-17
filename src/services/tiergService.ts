import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { type Player, type PlayerStatus, type MatchMode, type Game, type GameResult, type GameWithResults, type Tier, TIERS_ORDER } from '../types';

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
  { id: 'p10', name: '이창훈', tier: 'Silver', points: 50, base_handicap: 20, status: 'Active', is_admin: false, nickname: '#슬라이스정복' },
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

  async updatePlayerHandicap(id: string, newHandicap: number, nickname: string = ''): Promise<Player> {
    if (supabase) {
      const { data, error } = await supabase
        .from('players')
        .update({ base_handicap: newHandicap, nickname })
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
    resultsInput: { player_id: string; raw_score: number; cost_paid: number }[],
    matchMode: MatchMode = 'handicap'
  ): Promise<GameWithResults> {
    // 1. Fetch current players state to perform accurate mathematical operations
    const players = await this.getPlayers();

    // 2. Map and calculate adjusted scores depending on MatchMode
    const processedResults = resultsInput.map((input) => {
      const player = players.find((p) => p.id === input.player_id);
      if (!player) throw new Error(`Player ${input.player_id} not found`);

      // If 'scratch' mode, no handicap is applied (adjusted_score = raw_score)
      const adjustedScore = matchMode === 'scratch' ? input.raw_score : input.raw_score - player.base_handicap;
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

    const finalResults = rankedResults.map((item) => {
      let pointsChanged = 0;
      
      if (matchMode === 'scratch') {
        // Scratch mode does NOT change points or tiers!
        pointsChanged = 0;
      } else {
        // Handicap and Guillotine modes calculate normal LP changes
        if (rankedResults.length === 4) {
          pointsChanged = lpChangeByRank[item.rank] || 0;
        } else {
          // Dynamic formula for size != 4
          const median = (rankedResults.length + 1) / 2;
          if (item.rank < median) {
            pointsChanged = item.rank === 1 ? 20 : 10;
          } else if (item.rank > median) {
            pointsChanged = item.rank === rankedResults.length ? -20 : -10;
          } else {
            pointsChanged = 0; // Middle gets 0
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

  // --- Delete Game & Rollback LP/Tier API ---
  async deleteLatestGame(gameId: string): Promise<void> {
    // 1. Fetch all games to verify this is the latest one
    const games = await this.getGames();
    if (games.length === 0) throw new Error('삭제할 게임이 없습니다.');
    
    const latestGame = games[0];
    if (latestGame.game.id !== gameId) {
      throw new Error('가장 최근의 경기만 삭제 및 전적 복구가 가능합니다.');
    }

    // 2. Fetch the results for this game to revert players
    const resultsToRevert = latestGame.results;

    if (supabase) {
      try {
        // Revert each player's tier and points in Supabase
        for (const res of resultsToRevert) {
          // Run mathematical inverse (-points_changed)
          const { newTier: tierBefore, newPoints: pointsBefore } = calculateNewTierAndPoints(
            res.tier_after,
            res.points_after,
            -res.points_changed
          );

          const { error: playerUpdateError } = await supabase
            .from('players')
            .update({
              tier: tierBefore,
              points: pointsBefore,
            })
            .eq('id', res.player_id);

          if (playerUpdateError) {
            throw new Error(`플레이어(${res.player_name}) 전적 롤백 실패: ${playerUpdateError.message}`);
          }
        }

        // Delete the game results first explicitly (to bypass any DB foreign key constraints or lack of ON DELETE CASCADE)
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
        console.error('Verbose deleteLatestGame error:', err);
        throw err;
      }
    } else {
      // Local Storage fallback
      const localGames = getLocalData<Game[]>('tierg_games', []);
      const localResults = getLocalData<GameResult[]>('tierg_results', []);
      const localPlayers = getLocalData<Player[]>('tierg_players', INITIAL_MOCK_PLAYERS);

      // Revert each player
      resultsToRevert.forEach((res) => {
        const playerIndex = localPlayers.findIndex((p) => p.id === res.player_id);
        if (playerIndex !== -1) {
          const { newTier: tierBefore, newPoints: pointsBefore } = calculateNewTierAndPoints(
            res.tier_after,
            res.points_after,
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
