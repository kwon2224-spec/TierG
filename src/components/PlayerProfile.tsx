import React, { useEffect, useState } from 'react';
import { X, Calendar, Sparkles, Check, UserCheck, UserMinus } from 'lucide-react';
import { type Player, type PlayerStatus, TIER_THEMES, type GameResult } from '../types';
import { tiergService } from '../services/tiergService';
import { TierBadge } from './TierBadge';

interface PlayerProfileProps {
  playerId: string;
  onClose: () => void;
  onHandicapUpdated: () => void;
  isAdmin: boolean;
  currentAdminId?: string;
}

export const PlayerProfile: React.FC<PlayerProfileProps> = ({
  playerId,
  onClose,
  onHandicapUpdated,
  isAdmin,
  currentAdminId,
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
  const [nicknameInput, setNicknameInput] = useState<string>('');
  const [playerStatus, setPlayerStatus] = useState<PlayerStatus>('Active');
  const [playerIsAdmin, setPlayerIsAdmin] = useState(false);
  const [updatingHandicap, setUpdatingHandicap] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [updatingAdminStatus, setUpdatingAdminStatus] = useState(false);
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
      setNicknameInput(details.player.nickname || '');
      setPlayerStatus(details.player.status || 'Active');
      setPlayerIsAdmin(details.player.is_admin || false);
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

    // Defensive formatting: prepend '#' to nickname if missing and not empty
    let formattedNickname = nicknameInput.trim();
    if (formattedNickname && !formattedNickname.startsWith('#')) {
      formattedNickname = `#${formattedNickname}`;
    }

    setUpdatingHandicap(true);
    try {
      await tiergService.updatePlayerHandicap(data.player.id, newHandicap, formattedNickname);
      setUpdateSuccess(true);
      onHandicapUpdated();
      setTimeout(() => setUpdateSuccess(false), 2000);
      loadPlayerDetails();
    } catch (error) {
      console.error('Failed to update profile:', error);
      alert('프로필 정보 업데이트에 실패했습니다.');
    } finally {
      setUpdatingHandicap(false);
    }
  };

  const handleUpdateStatus = async (newStatus: PlayerStatus) => {
    if (!data) return;
    setUpdatingStatus(true);
    try {
      await tiergService.updatePlayerStatus(data.player.id, newStatus);
      setPlayerStatus(newStatus);
      onHandicapUpdated();
      alert(`선수 상태가 '${newStatus === 'Active' ? '활동 중' : '휴면'}' 상태로 성공적으로 변경되었습니다.`);
      loadPlayerDetails();
    } catch (error: any) {
      console.error('Failed to update player status:', error);
      alert(`선수 상태 업데이트에 실패했습니다. 이유: ${error.message || error}`);
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleDeletePlayer = async () => {
    if (!data) return;
    if (window.confirm(`⚠️ 정말로 '${data.player.name}' 선수를 영구 탈퇴 처리(삭제)하시겠습니까?\n\n이 선수의 모든 전적 및 프로필 데이터가 시스템에서 영구히 완전히 삭제되며 절대 복구할 수 없습니다.`)) {
      try {
        await tiergService.deletePlayer(data.player.id);
        alert(`'${data.player.name}' 선수가 성공적으로 탈퇴 처리되었습니다.`);
        onHandicapUpdated();
        onClose();
      } catch (error: any) {
        console.error('Failed to delete player:', error);
        alert(error.message || '선수 삭제에 실패했습니다.');
      }
    }
  };

  const handleToggleAdminRights = async (checked: boolean) => {
    if (!data) return;
    setUpdatingAdminStatus(true);
    try {
      await tiergService.updatePlayerAdminStatus(data.player.id, checked);
      setPlayerIsAdmin(checked);
      onHandicapUpdated();
      alert(`'${data.player.name}' 선수의 관리자 권한이 성공적으로 ${checked ? '부여' : '회수'}되었습니다.`);
      loadPlayerDetails();
    } catch (error: any) {
      console.error('Failed to toggle admin status:', error);
      alert(error.message || '관리자 권한 변경에 실패했습니다.');
    } finally {
      setUpdatingAdminStatus(false);
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
            <h2 className="profile-name">
              {player.name}
              {playerIsAdmin && <span style={{ fontSize: '10px', verticalAlign: 'middle', backgroundColor: 'rgba(245,158,11,0.15)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.3)', padding: '2px 8px', borderRadius: '10px', marginLeft: '6px' }}>관리자</span>}
            </h2>
            <div className="profile-tier" style={{ color: theme.color }}>
              {theme.name} (LP {player.points})
            </div>
            <div className="profile-lp">기본 핸디캡: {player.base_handicap}개</div>

            {/* Admin Checkbox to delegate/revoke Admin Rights */}
            {isAdmin && currentAdminId !== player.id && (
              <div style={{
                marginTop: '12px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 14px',
                borderRadius: '20px',
                backgroundColor: 'rgba(245, 158, 11, 0.08)',
                border: '1px solid rgba(245, 158, 11, 0.25)',
                cursor: 'pointer'
              }}>
                <input
                  type="checkbox"
                  id="adminRightsCheckbox"
                  checked={playerIsAdmin}
                  disabled={updatingAdminStatus}
                  onChange={(e) => handleToggleAdminRights(e.target.checked)}
                  style={{ cursor: 'pointer', width: '15px', height: '15px' }}
                />
                <label htmlFor="adminRightsCheckbox" style={{ fontSize: '12px', fontWeight: '700', color: '#fbbf24', cursor: 'pointer', userSelect: 'none' }}>
                  ⭐ 관리자 권한 부여
                </label>
              </div>
            )}
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

          {/* Admin Handicap & Nickname Edit Form (Only visible to logged-in admins!) */}
          {isAdmin && (
            <div style={{ backgroundColor: 'rgba(255, 255, 255, 0.02)', padding: '15px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', marginBottom: '20px' }}>
              <h4 style={{ fontSize: '14px', fontWeight: '700', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Sparkles size={16} color="var(--accent)" /> 프로필 편집 (관리자용)
              </h4>
              <form onSubmit={handleUpdateHandicap} style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '14px' }}>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <div style={{ flex: 1 }}>
                    <label className="form-label" style={{ fontSize: '11px', marginBottom: '4px' }}>별명 (#태그)</label>
                    <input
                      type="text"
                      className="form-input"
                      style={{ padding: '8px 12px' }}
                      value={nicknameInput}
                      onChange={(e) => setNicknameInput(e.target.value)}
                      placeholder="예: #장타왕"
                      maxLength={10}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label className="form-label" style={{ fontSize: '11px', marginBottom: '4px' }}>기본 핸디캡 (개)</label>
                    <input
                      type="number"
                      className="form-input"
                      style={{ padding: '8px 12px' }}
                      value={handicapInput}
                      onChange={(e) => setHandicapInput(e.target.value)}
                      placeholder="예: 18"
                      min="0"
                      max="72"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  className="submit-btn"
                  style={{ width: '100%', padding: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', background: updateSuccess ? '#10b981' : undefined }}
                  disabled={updatingHandicap}
                >
                  {updateSuccess ? <Check size={16} /> : '프로필 정보 수정 저장'}
                </button>
              </form>

              {/* Admin Player Status Dropdown */}
              <h4 style={{ fontSize: '14px', fontWeight: '700', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                <UserCheck size={16} color="var(--accent)" /> 활동 상태 변경 (관리자용)
              </h4>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <select
                  className="form-input"
                  value={playerStatus}
                  onChange={(e) => handleUpdateStatus(e.target.value as PlayerStatus)}
                  style={{ flex: 1, padding: '8px 12px', backgroundColor: 'var(--bg-hover)' }}
                  disabled={updatingStatus}
                >
                  <option value="Active">활동 중 (정상 랭크 및 출전 대기)</option>
                  <option value="Dormant">휴면 (랭킹 음영 처리 및 경기 출전 제외)</option>
                </select>
              </div>
            </div>
          )}

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
                        <span style={{ fontWeight: '600' }}>{res.raw_score}타 (핸디 적용 {res.adjusted_score}타)</span>
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

          {/* Admin Player Retirement (Delete) Button - Only visible to logged-in admins! */}
          {isAdmin && (
            <button
              onClick={handleDeletePlayer}
              className="submit-btn"
              style={{
                background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                marginTop: '25px',
                boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px'
              }}
            >
              <UserMinus size={18} />
              <span>⚠️ 이 플레이어 회원 탈퇴 (영구 삭제)</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
