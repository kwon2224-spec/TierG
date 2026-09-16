import React, { useEffect, useState } from 'react';
import { X, Calendar, Sparkles, Check } from 'lucide-react';
import { type Player, TIER_THEMES, type GameResult } from '../types';
import { tiergService } from '../services/tiergService';
import { TierBadge } from './TierBadge';

interface PlayerProfileProps {
  playerId: string;
  onClose: () => void;
  onHandicapUpdated: () => void;
}

export const PlayerProfile: React.FC<PlayerProfileProps> = ({
  playerId,
  onClose,
  onHandicapUpdated,
}) => {
  const [data, setData] = useState<{
    player: Player;
    results: (GameResult & { played_at: string; notes?: string })[];
    stats: {
      totalGames: number;
      averageRawScore: number;
      bestRawScore: number;
      totalCost: number;
      averageCost: number;
      wins: number;
    };
  } | null>(null);

  const [loading, setLoading] = useState(true);
  const [handicapInput, setHandicapInput] = useState<string>('');
  const [updatingHandicap, setUpdatingHandicap] = useState(false);
  const [updateSuccess, setUpdateSuccess] = useState(false);

  useEffect(() => {
    loadPlayerDetails();
  }, [playerId]);

  const loadPlayerDetails = async () => {
    setLoading(true);
    try {
      const details = await tiergService.getPlayerHistory(playerId);
      setData(details);
      setHandicapInput(details.player.base_handicap.toString());
    } catch (error) {
      console.error('Failed to load player history:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateHandicap = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!data) return;

    const newHandicap = parseInt(handicapInput, 10);
    if (isNaN(newHandicap) || newHandicap < 0) {
      alert('올바른 핸디캡 숫자를 입력해주세요.');
      return;
    }

    setUpdatingHandicap(true);
    try {
      await tiergService.updatePlayerHandicap(data.player.id, newHandicap);
      setUpdateSuccess(true);
      onHandicapUpdated();
      setTimeout(() => setUpdateSuccess(false), 2000);
      loadPlayerDetails();
    } catch (error) {
      console.error('Failed to update handicap:', error);
      alert('핸디캡 업데이트에 실패했습니다.');
    } finally {
      setUpdatingHandicap(false);
    }
  };

  if (loading || !data) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ padding: '40px', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-secondary)' }}>선수 데이터를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  const { player, results, stats } = data;
  const theme = TIER_THEMES[player.tier] || TIER_THEMES.Iron;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{
          '--tier-color': theme.color,
          '--tier-shadow': theme.shadow,
        } as React.CSSProperties}
      >
        <div className="modal-header">
          <h3 className="modal-title">선수 상세 프로필</h3>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          {/* Main Card */}
          <div className="profile-main-card">
            <TierBadge tier={player.tier} size={80} />
            <h2 className="profile-name">{player.name}</h2>
            <div className="profile-tier" style={{ color: theme.color }}>
              {theme.name} (LP {player.points})
            </div>
            <div className="profile-lp">기본 핸디캡: {player.base_handicap}개</div>
          </div>

          {/* Stats Grid */}
          <div className="profile-stats-grid">
            <div className="stat-box highlight">
              <div className="stat-val">{stats.totalGames}회</div>
              <div className="stat-lbl">총 경기수</div>
            </div>
            <div className="stat-box">
              <div className="stat-val" style={{ color: '#ffd700' }}>
                {stats.wins}회
              </div>
              <div className="stat-lbl">우승(1등) 횟수</div>
            </div>
            <div className="stat-box">
              <div className="stat-val">
                {stats.totalGames > 0 ? Math.round(stats.averageRawScore) : '-'}타
              </div>
              <div className="stat-lbl">평균 타수</div>
            </div>
            <div className="stat-box">
              <div className="stat-val" style={{ color: '#60a5fa' }}>
                {stats.totalGames > 0 ? stats.bestRawScore : '-'}타
              </div>
              <div className="stat-lbl">라이프 베스트(라베)</div>
            </div>

            {/* Expenses Cost Stat Box */}
            <div className="stat-box cost-box">
              <div className="stat-val">
                {stats.totalCost.toLocaleString()}원
              </div>
              <div className="stat-lbl">누적 지출 비용 (평균: {Math.round(stats.averageCost).toLocaleString()}원)</div>
            </div>
          </div>

          {/* Admin Handicap Edit Form */}
          <div style={{ backgroundColor: 'rgba(255, 255, 255, 0.02)', padding: '15px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', marginBottom: '20px' }}>
            <h4 style={{ fontSize: '14px', fontWeight: '700', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Sparkles size={16} color="var(--accent)" /> 핸디캡 조정 (관리자용)
            </h4>
            <form onSubmit={handleUpdateHandicap} style={{ display: 'flex', gap: '10px' }}>
              <input
                type="number"
                className="form-input"
                style={{ flex: 1, padding: '8px 12px' }}
                value={handicapInput}
                onChange={(e) => setHandicapInput(e.target.value)}
                placeholder="새 핸디캡 개수"
                min="0"
                max="72"
              />
              <button
                type="submit"
                className="submit-btn"
                style={{ width: 'auto', padding: '0 18px', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '4px', background: updateSuccess ? '#10b981' : undefined }}
                disabled={updatingHandicap}
              >
                {updateSuccess ? <Check size={16} /> : '적용'}
              </button>
            </form>
          </div>

          {/* Recent Games */}
          <h4 className="recent-games-title">최근 전적 ({results.length}전)</h4>
          <div className="profile-history-list">
            {results.length === 0 ? (
              <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px', padding: '20px' }}>
                기록된 게임 전적이 없습니다.
              </p>
            ) : (
              results.map((res) => {
                const lpDiff = res.points_changed;
                const isPlus = lpDiff >= 0;
                return (
                  <div key={res.id} className="profile-history-item">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span
                        style={{
                          fontWeight: '800',
                          color: res.rank === 1 ? '#ffd700' : 'var(--text-secondary)',
                          fontSize: '14px',
                        }}
                      >
                        {res.rank}등
                      </span>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontWeight: '600' }}>{res.raw_score}타 (넷 {res.adjusted_score}타)</span>
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '2px' }}>
                          <Calendar size={10} /> {new Date(res.played_at).toLocaleDateString('ko-KR')}
                        </span>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span
                        className={`history-lp-diff ${isPlus ? 'plus' : 'minus'}`}
                        style={{ fontWeight: '700', fontSize: '14px' }}
                      >
                        {isPlus ? `+${lpDiff}` : lpDiff} LP
                      </span>
                      <div style={{ fontSize: '10px', color: '#10b981' }}>
                        {res.cost_paid > 0 ? `${res.cost_paid.toLocaleString()}원 지출` : ''}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
