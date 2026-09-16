import React, { useState, useEffect } from 'react';
import { UserPlus, HelpCircle } from 'lucide-react';
import { type Player, type Tier, TIERS_ORDER, TIER_THEMES, TIER_WEIGHTS } from '../types';
import { tiergService } from '../services/tiergService';
import { TierBadge } from './TierBadge';

interface LeaderboardProps {
  onSelectPlayer: (id: string) => void;
  refreshTrigger: number;
}

export const Leaderboard: React.FC<LeaderboardProps> = ({
  onSelectPlayer,
  refreshTrigger,
}) => {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddPlayerModal, setShowAddPlayerModal] = useState(false);

  // New Player Form State
  const [newName, setNewName] = useState('');
  const [newHandicap, setNewNameHandicap] = useState('20');
  const [startTier, setStartTier] = useState<Tier>('Iron');
  const [startPoints, setStartPoints] = useState('50');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadPlayers();
  }, [refreshTrigger]);

  const loadPlayers = async () => {
    setLoading(true);
    try {
      const fetchedPlayers = await tiergService.getPlayers();
      // Sort players by: Tier Weight (desc) -> LP Points (desc) -> Name (asc)
      const sorted = [...fetchedPlayers].sort((a, b) => {
        const weightA = TIER_WEIGHTS[a.tier] + a.points;
        const weightB = TIER_WEIGHTS[b.tier] + b.points;
        if (weightB !== weightA) return weightB - weightA;
        return a.name.localeCompare(b.name, 'ko-KR');
      });
      setPlayers(sorted);
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

  return (
    <div>
      <div className="leaderboard-title">
        <span>🏆 실시간 티어 랭킹</span>
        <span style={{ fontSize: '13px', fontWeight: 'normal', color: 'var(--text-muted)' }}>
          총 {players.length}명 참여 중
        </span>
      </div>

      <div className="leaderboard-list">
        {players.map((player, index) => {
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

              {/* Player Info Details */}
              <div className="player-info">
                <div className="player-name-row">
                  <span className="player-name">
                    {player.name}
                    {isDormant && <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '6px', fontWeight: 'normal' }}>(휴면)</span>}
                  </span>
                  <span className="player-handicap-badge">핸디: {player.base_handicap}개</span>
                </div>

                <div className="player-tier-row">
                  <span className="player-tier-name" style={{ color: isDormant ? 'var(--text-muted)' : theme.color }}>
                    {isDormant ? '휴면 상태' : theme.name}
                  </span>
                  <span className="player-lp">
                    {isDormant ? '전적 비활동' : player.tier === 'Challenger' ? `${player.points} LP` : `${player.points} / 100 LP`}
                  </span>
                </div>

                {/* LP Progress Bar */}
                <div className="lp-bar-container">
                  <div
                    className="lp-bar-fill"
                    style={{
                      width: isDormant ? '0%' : `${lpPercentage}%`,
                      background: isDormant ? '#475569' : theme.gradient,
                    }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Button to add a new player */}
      <button className="add-player-btn" onClick={() => setShowAddPlayerModal(true)}>
        <UserPlus size={18} /> 신규 선수 추가 (회원 등록)
      </button>

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
                  onChange={(e) => setStartTier(e.target.value as Tier)}
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
                  선택하신 티어의 100점 중 몇 점에서 시작할지 포인트를 입력해 주세요. (기본 50LP가 허리 구간으로 가장 안전합니다.)
                </span>
              </div>

              <button type="submit" className="submit-btn" disabled={submitting}>
                {submitting ? '선수 등록 중...' : '🏆 신규 선수 가입 승인'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
