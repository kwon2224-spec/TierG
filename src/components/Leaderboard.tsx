import React, { useState, useEffect } from 'react';
import { UserPlus, HelpCircle, Crown, Trophy, Target, TrendingUp, Coins } from 'lucide-react';
import { type PlayerWithStats, type RankingCategory, type Tier, TIERS_ORDER, TIER_THEMES, TIER_WEIGHTS, TIER_HANDICAPS } from '../types';
import { tiergService } from '../services/tiergService';
import { TierBadge } from './TierBadge';

interface LeaderboardProps {
  onSelectPlayer: (id: string) => void;
  refreshTrigger: number;
  isAdmin?: boolean;
}

export const Leaderboard: React.FC<LeaderboardProps> = ({
  onSelectPlayer,
  refreshTrigger,
  isAdmin = false,
}) => {
  const [players, setPlayers] = useState<PlayerWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [rankingCategory, setRankingCategory] = useState<RankingCategory>('tier');
  const [showAddPlayerModal, setShowAddPlayerModal] = useState(false);

  // New Player Form State
  const [newName, setNewName] = useState('');
  const [newHandicap, setNewNameHandicap] = useState('25'); // Default Iron standard is 25!
  const [startTier, setStartTier] = useState<Tier>('Iron');
  const [startPoints, setStartPoints] = useState('50');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadPlayers();
  }, [refreshTrigger]);

  const loadPlayers = async () => {
    setLoading(true);
    try {
      const fetchedPlayers = await tiergService.getPlayersWithStats();
      setPlayers(fetchedPlayers);
    } catch (error) {
      console.error('Failed to load players:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddPlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    const handicapNum = parseInt(newHandicap, 10);
    if (isNaN(handicapNum) || handicapNum < 0) {
      alert('올바른 핸디캡 숫자를 입력해주세요.');
      return;
    }

    const pointsNum = parseInt(startPoints, 10);
    if (isNaN(pointsNum) || pointsNum < 0 || pointsNum > 100) {
      alert('시작 LP 점수는 0에서 100 사이의 숫자로 입력해주세요.');
      return;
    }

    setSubmitting(true);
    try {
      await tiergService.addPlayer(newName.trim(), handicapNum, startTier, pointsNum);
      setNewName('');
      setNewNameHandicap('20');
      setStartTier('Iron');
      setStartPoints('50');
      setShowAddPlayerModal(false);
      loadPlayers();
    } catch (error) {
      alert('선수 등록에 실패했습니다. 이미 존재하거나 입력값 오류일 수 있습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>랭킹 정보를 불러오는 중...</div>;
  }

  // Calculate the lowest handicap among all active (non-dormant) players to award the Crown!
  const activePlayers = players.filter((p) => p.status === 'Active');
  const minHandicap = activePlayers.length > 0 ? Math.min(...activePlayers.map((p) => p.base_handicap)) : 999;

  // Dynamically sort players based on selected ranking category
  const getSortedPlayers = () => {
    const list = [...players];
    if (rankingCategory === 'tier') {
      return list.sort((a, b) => {
        const weightA = TIER_WEIGHTS[a.tier] + a.points;
        const weightB = TIER_WEIGHTS[b.tier] + b.points;
        if (weightB !== weightA) return weightB - weightA;
        return a.name.localeCompare(b.name, 'ko-KR');
      });
    }
    if (rankingCategory === 'bestScore') {
      return list.sort((a, b) => {
        // Players with recorded 18-hole best score come first
        if (a.bestRawScore > 0 && b.bestRawScore === 0) return -1;
        if (a.bestRawScore === 0 && b.bestRawScore > 0) return 1;
        if (a.bestRawScore !== b.bestRawScore) return a.bestRawScore - b.bestRawScore; // Lower is better!
        return a.name.localeCompare(b.name, 'ko-KR');
      });
    }
    if (rankingCategory === 'winRate') {
      return list.sort((a, b) => {
        if (b.winRate !== a.winRate) return b.winRate - a.winRate; // Higher win rate first!
        if (b.totalGames !== a.totalGames) return b.totalGames - a.totalGames;
        return a.name.localeCompare(b.name, 'ko-KR');
      });
    }
    if (rankingCategory === 'cost') {
      return list.sort((a, b) => {
        if (b.totalCost !== a.totalCost) return b.totalCost - a.totalCost; // Highest spent first!
        if (b.totalGames !== a.totalGames) return b.totalGames - a.totalGames;
        return a.name.localeCompare(b.name, 'ko-KR');
      });
    }
    return list;
  };

  const sortedPlayers = getSortedPlayers();

  const categoryTitles: Record<RankingCategory, string> = {
    tier: '실시간 티어 랭킹',
    bestScore: '18홀 라베(최저타) 랭킹',
    winRate: '종합 리그 승률 랭킹',
    cost: '누적 지출 기부 랭킹',
  };

  return (
    <div>
      <div className="leaderboard-title">
        <span>{categoryTitles[rankingCategory]}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '13px', fontWeight: 'normal', color: 'var(--text-muted)' }}>
            총 {players.length}명
          </span>
          {isAdmin && (
            <button
              type="button"
              onClick={() => setShowAddPlayerModal(true)}
              style={{
                background: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid rgba(16, 185, 129, 0.25)',
                color: '#34d399',
                padding: '3px 8px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '3px',
                transition: 'all 0.2s',
              }}
              title="새로운 골퍼 추가"
            >
              <UserPlus size={12} />
              <span>선수 추가</span>
            </button>
          )}
        </div>
      </div>

      {/* 4-Category Multi-Ranking Pill Bar (Monochrome Precision Lucide Icons - Zero Raw Emojis!) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '6px',
        marginBottom: '16px',
        backgroundColor: 'rgba(0,0,0,0.2)',
        padding: '4px',
        borderRadius: '10px',
        border: '1px solid rgba(255,255,255,0.03)'
      }}>
        {[
          { id: 'tier', label: '티어', icon: Trophy },
          { id: 'bestScore', label: '라베', icon: Target },
          { id: 'winRate', label: '승률', icon: TrendingUp },
          { id: 'cost', label: '지출', icon: Coins },
        ].map((tab) => {
          const isActive = rankingCategory === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setRankingCategory(tab.id as RankingCategory)}
              style={{
                height: '36px',
                borderRadius: '7px',
                border: isActive ? '1px solid var(--accent)' : '1px solid transparent',
                background: isActive ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(4, 120, 87, 0.25))' : 'transparent',
                color: isActive ? '#fff' : 'var(--text-muted)',
                fontWeight: isActive ? '800' : '600',
                fontSize: '12px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '5px',
                transition: 'all 0.2s',
                boxShadow: isActive ? '0 2px 8px rgba(16, 185, 129, 0.2)' : 'none'
              }}
            >
              <Icon size={13} color={isActive ? 'var(--accent)' : 'currentColor'} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      <div className="leaderboard-list">
        {sortedPlayers.map((player, index) => {
          const rank = index + 1;
          const theme = TIER_THEMES[player.tier] || TIER_THEMES.Iron;
          const isDormant = player.status === 'Dormant';
          
          // Determine LP bar fill (Challenger doesn't have 100 ceiling, so cap display percentage at 100)
          const lpPercentage = player.tier === 'Challenger' ? 100 : Math.min(100, Math.max(0, player.points));

          return (
            <div
              key={player.id}
              className={`player-rank-card ${isDormant ? 'dormant' : ''}`}
              onClick={() => onSelectPlayer(player.id)}
              style={{
                '--tier-color': isDormant ? '#64748b' : theme.color,
                '--tier-shadow': isDormant ? 'transparent' : theme.shadow,
              } as React.CSSProperties}
            >
              {/* Rank Badge */}
              <div className={`rank-number ${isDormant ? 'rank-other' : rank === 1 ? 'rank-1' : rank === 2 ? 'rank-2' : rank === 3 ? 'rank-3' : 'rank-other'}`}>
                {rank}
              </div>

              {/* Circular Tier Badge */}
              <TierBadge tier={player.tier} />

              {/* Player Info Details (Locked to exact 60px inner content height!) */}
              <div className="player-info" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <div className="player-name-row" style={{ height: '22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2px' }}>
                  <span className="player-name" style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', flexWrap: 'wrap' }}>
                    {player.name}
                    {!isDormant && player.base_handicap === minHandicap && (
                      <span title="모임 최저 핸디캡 실력왕" style={{ display: 'inline-flex', alignItems: 'center' }}>
                        <Crown size={12} color="#ffd700" style={{ fill: '#ffd700', verticalAlign: 'middle' }} />
                      </span>
                    )}
                    {player.nickname && <span style={{ fontSize: '11px', color: '#fbbf24', marginLeft: '3px', fontWeight: '600' }}>{player.nickname}</span>}
                    {isDormant && <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '3px', fontWeight: 'normal' }}>(휴면)</span>}
                  </span>
                  <span className="player-handicap-badge">핸디: {player.base_handicap}개</span>
                </div>

                {/* 1. TIER RANKING MODE */}
                {rankingCategory === 'tier' && (
                  <>
                    <div className="player-tier-row" style={{ height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span className="player-tier-name" style={{ color: isDormant ? 'var(--text-muted)' : theme.color }}>
                        {isDormant ? '휴면 상태' : theme.name}
                      </span>
                      <span className="player-lp">
                        {isDormant ? '전적 비활동' : player.tier === 'Challenger' ? `${player.points} LP` : `${player.points} / 100 LP`}
                      </span>
                    </div>

                    <div style={{ height: '12px', display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
                      <div className="lp-bar-container" style={{ width: '100%', height: '8px', overflow: 'hidden', position: 'relative', boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.4)' }}>
                        <div
                          className="lp-bar-fill"
                          style={{
                            width: isDormant ? '0%' : `${lpPercentage}%`,
                            background: isDormant ? '#475569' : theme.gradient,
                            position: 'relative'
                          }}
                        >
                          {!isDormant && (
                            <div style={{
                              position: 'absolute',
                              top: 0,
                              left: 0,
                              right: 0,
                              bottom: 0,
                              background: 'linear-gradient(180deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.05) 50%, rgba(0,0,0,0.15) 100%)'
                            }} />
                          )}
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {/* 2. BEST SCORE (라베) RANKING MODE */}
                {rankingCategory === 'bestScore' && (
                  <>
                    <div className="player-tier-row" style={{ height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span className="player-tier-name" style={{ color: theme.color }}>
                        {theme.name}
                      </span>
                      <span style={{ fontSize: '15px', fontWeight: '800', color: rank === 1 && player.bestRawScore > 0 ? '#ffd700' : 'var(--text-primary)' }}>
                        {player.bestRawScore > 0 ? (
                          <>
                            {player.bestRawScore}타
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '4px', fontWeight: 'normal' }}>
                              ({player.bestRawScore - 72 >= 0 ? `+${player.bestRawScore - 72}` : player.bestRawScore - 72})
                            </span>
                          </>
                        ) : (
                          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>기록 없음</span>
                        )}
                      </span>
                    </div>
                    <div style={{ height: '12px', display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: '12px', whiteSpace: 'nowrap' }}>
                        {player.totalGames > 0 ? `총 ${player.totalGames}전 출전 | 18홀 정규 라베` : '공식 18홀 경기 미출전'}
                      </span>
                    </div>
                  </>
                )}

                {/* 3. WIN RATE RANKING MODE */}
                {rankingCategory === 'winRate' && (
                  <>
                    <div className="player-tier-row" style={{ height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span className="player-tier-name" style={{ color: theme.color }}>
                        {theme.name}
                      </span>
                      <span style={{ fontSize: '15px', fontWeight: '800', color: player.winRate >= 60 ? '#10b981' : player.winRate >= 40 ? '#fbbf24' : '#f87171' }}>
                        {player.winRate}%
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '4px', fontWeight: 'normal' }}>
                          ({player.totalGames}전 {player.leagueWins}승 {player.leagueLosses}패)
                        </span>
                      </span>
                    </div>
                    <div style={{ height: '12px', display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
                      <div className="lp-bar-container" style={{ width: '100%', height: '8px', overflow: 'hidden', position: 'relative', boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.4)' }}>
                        <div
                          className="lp-bar-fill"
                          style={{
                            width: `${player.winRate}%`,
                            background: 'linear-gradient(135deg, #10b981, #059669)',
                            position: 'relative'
                          }}
                        >
                          <div style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            background: 'linear-gradient(180deg, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0.05) 50%, rgba(0,0,0,0.15) 100%)'
                          }} />
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {/* 4. TOTAL COST RANKING MODE */}
                {rankingCategory === 'cost' && (
                  <>
                    <div className="player-tier-row" style={{ height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span className="player-tier-name" style={{ color: theme.color }}>
                        {theme.name}
                      </span>
                      <span style={{ fontSize: '15px', fontWeight: '800', color: player.totalCost > 0 ? '#f87171' : '#34d399' }}>
                        {player.totalCost > 0 ? `${player.totalCost.toLocaleString()}원` : '0원 지출'}
                      </span>
                    </div>
                    <div style={{ height: '12px', display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
                      {rank === 1 && player.totalCost > 0 ? (
                        <span style={{ fontSize: '11px', color: '#fbbf24', fontWeight: '700', lineHeight: '12px', display: 'flex', alignItems: 'center', gap: '3px', whiteSpace: 'nowrap' }}>
                          <Crown size={11} color="#fbbf24" style={{ fill: '#fbbf24' }} /> 모임 공식 후원회장 (총 {player.totalCost.toLocaleString()}원)
                        </span>
                      ) : (
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: '12px', whiteSpace: 'nowrap' }}>
                          경기당 평균 {player.totalGames > 0 ? `${Math.round(player.totalCost / player.totalGames).toLocaleString()}원` : '0원'} 지출
                        </span>
                      )}
                    </div>
                  </>
                )}

              </div>
            </div>
          );
        })}
      </div>

      {/* Info Notice card */}
      <div style={{
        marginTop: '25px',
        padding: '12px 16px',
        backgroundColor: 'rgba(255,255,255,0.02)',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius-md)',
        fontSize: '12px',
        color: 'var(--text-muted)',
        lineHeight: '1.6'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '4px' }}>
          <HelpCircle size={14} /> 티어 규칙 안내
        </div>
        경기 결과 순위에 따라 <strong>1등 +20 LP, 2등 +10 LP, 3등 -10 LP, 4등 -20 LP</strong>가 부여됩니다. 
        각 티어에서 100 LP를 도달하면 즉시 승급하고, 0 LP 미만으로 떨어지면 아래 티어로 강등됩니다. (단, 아이언 0 LP 미만으로는 강등되지 않습니다)
      </div>

      {/* Add Player Modal */}
      {showAddPlayerModal && (
        <div className="modal-overlay" onClick={() => setShowAddPlayerModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">신규 선수 등록</h3>
              <button className="modal-close-btn" onClick={() => setShowAddPlayerModal(false)}>
                ✕
              </button>
            </div>
            <form onSubmit={handleAddPlayer} className="modal-body">
              <div className="form-group">
                <label className="form-label">플레이어 이름</label>
                <input
                  type="text"
                  className="form-input"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="예: 홍길동"
                  maxLength={10}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">기본 핸디캡 (스크린골프 기준)</label>
                <input
                  type="number"
                  className="form-input"
                  value={newHandicap}
                  onChange={(e) => setNewNameHandicap(e.target.value)}
                  placeholder="예: 18"
                  min="0"
                  max="72"
                  required
                />
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                  이 핸디캡은 경기 기록 입력 시 원본 타수에서 자동 차감되어 등수를 가르는 기준이 됩니다.
                </span>
              </div>
              
              {/* New Starting Tier Dropdown */}
              <div className="form-group">
                <label className="form-label">시작 티어 지정</label>
                <select
                  className="form-input"
                  value={startTier}
                  onChange={(e) => {
                    const selected = e.target.value as Tier;
                    setStartTier(selected);
                    // Automatically pre-fill the standard starting handicap for this tier to save admin's manual lookups!
                    setNewNameHandicap(String(TIER_HANDICAPS[selected]));
                  }}
                  style={{ backgroundColor: 'var(--bg-hover)' }}
                >
                  {TIERS_ORDER.map((t) => (
                    <option key={t} value={t}>
                      {TIER_THEMES[t].name}
                    </option>
                  ))}
                </select>
              </div>

              {/* New Starting LP input */}
              <div className="form-group">
                <label className="form-label">시작 LP 점수 (0 ~ 100)</label>
                <input
                  type="number"
                  className="form-input"
                  value={startPoints}
                  onChange={(e) => setStartPoints(e.target.value)}
                  placeholder="예: 50"
                  min="0"
                  max="100"
                  required
                />
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                  선택하신 티어의 100점 중 몇 점에서 시작할지 포인트를 입력해 주세요. (초기 정착 지표로 50 LP를 권장합니다.)
                </span>
              </div>

              <button type="submit" className="submit-btn" disabled={submitting}>
                {submitting ? '선수 등록 중...' : '신규 선수 가입 승인'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
