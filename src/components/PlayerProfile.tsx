import React, { useEffect, useState } from 'react';
import { X, Calendar, Sparkles, Check, UserCheck, UserMinus, Award, TrendingUp, Lock } from 'lucide-react';
import { type Player, type PlayerStatus, TIER_THEMES, type GameResult, type Tier, TIERS_ORDER } from '../types';
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
      normalCost?: number;
      netCost?: number;
      averageCost: number;
      wins: number;
      guillotineLost: number;
      guillotineSaved: number;
      guillotineWins?: number;
      guillotineLosses?: number;
      leagueWins?: number;
      leagueLosses?: number;
    };
  } | null>(null);

  const [loading, setLoading] = useState(true);
  const [handicapInput, setHandicapInput] = useState<string>('');
  const [nicknameInput, setNicknameInput] = useState<string>('');
  const [tierInput, setTierInput] = useState<Tier>('Iron'); // Newly added tier edit state!
  const [pointsInput, setPointsInput] = useState<string>(''); // Newly added points edit state!
  const [selectedBadgeId, setSelectedBadgeId] = useState<string | null>(null); // Interactive mobile achievement tap state!
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
      setNicknameInput((details.player.nickname || '').trim()); // Safely trim trailing db spaces to fix cursor blink!
      setTierInput(details.player.tier); // set initial tier!
      setPointsInput(details.player.points.toString()); // set initial points!
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

    const newPoints = parseInt(pointsInput, 10);
    if (isNaN(newPoints) || newPoints < 0) {
      alert('올바른 LP 점수를 입력해주세요.');
      return;
    }

    // Defensive formatting: prepend '#' to nickname if missing and not empty
    let formattedNickname = nicknameInput.trim();
    if (formattedNickname && !formattedNickname.startsWith('#')) {
      formattedNickname = `#${formattedNickname}`;
    }

    setUpdatingHandicap(true);
    try {
      // Pass tierInput and newPoints directly to update service!
      await tiergService.updatePlayerHandicap(data.player.id, newHandicap, formattedNickname, tierInput, newPoints);
      
      // Optimistically update local player state immediately so top badge and tier reflect changes with ZERO delay!
      setData((prev) => prev ? {
        ...prev,
        player: {
          ...prev.player,
          tier: tierInput,
          points: newPoints,
          base_handicap: newHandicap,
          nickname: formattedNickname,
        }
      } : null);

      setUpdateSuccess(true);
      onHandicapUpdated();
      setTimeout(() => setUpdateSuccess(false), 2000);
      await loadPlayerDetails();
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

  // 10 Official Achievements Calculation Engine
  const achievements = (() => {
    const chronological = [...results].reverse();

    // 1. Single (79 or below)
    const hasSingle = stats.bestRawScore > 0 && stats.bestRawScore <= 79;

    // 2. Breaking 90 (89 or below)
    const hasBreaking90 = stats.bestRawScore > 0 && stats.bestRawScore <= 89;

    // 3. 3 Consecutive 1st places
    let maxWins = 0;
    let curWins = 0;
    chronological.forEach((r) => {
      if (r.rank === 1) {
        curWins++;
        if (curWins > maxWins) maxWins = curWins;
      } else {
        curWins = 0;
      }
    });
    const has3ConsecWins = maxWins >= 3;

    // 4. 3 Consecutive Last places (points_changed === -20 or guillotine loser)
    let maxLosses = 0;
    let curLosses = 0;
    chronological.forEach((r) => {
      const isLast = r.points_changed === -20 || ((r.bet_amount || 0) > 0 && r.cost_paid > 0);
      if (isLast) {
        curLosses++;
        if (curLosses > maxLosses) maxLosses = curLosses;
      } else {
        curLosses = 0;
      }
    });
    const has3ConsecLosses = maxLosses >= 3;

    // 5. Guillotine Survival Master (3+ wins)
    const hasGuillotineKing = (stats.guillotineWins || 0) >= 3;

    // 6. 10 Games (골프 중독자)
    const has10Games = stats.totalGames >= 10;

    // 7. 50 Games (필드의 지배자)
    const has50Games = stats.totalGames >= 50;

    // 8. 100 Games (전설의 고인물)
    const has100Games = stats.totalGames >= 100;

    // 9. Challenger Reached
    const hasChallenger = player.tier === 'Challenger';

    // 10. Big Sponsor (Single match 100,000+ won paid)
    const hasBigSponsor = results.some((r) => (r.cost_paid || 0) >= 100000);

    return [
      { id: 'single', title: '신의 영역', desc: '18홀 정규 79타 이하 싱글 골퍼 등극', icon: '🦅', unlocked: hasSingle, color: '#ffd700' },
      { id: 'breaking90', title: '일취월장', desc: '18홀 89타 이하 보기 플레이어 진입', icon: '🎯', unlocked: hasBreaking90, color: '#60a5fa' },
      { id: 'consecWins', title: '파죽지세', desc: '거침없는 3경기 연속 1위 독주', icon: '⚡', unlocked: has3ConsecWins, color: '#10b981' },
      { id: 'consecLosses', title: 'ATM', desc: '눈물의 3연속 꼴찌 (모임 공식 현금지급기)', icon: '🏧', unlocked: has3ConsecLosses, color: '#f87171' },
      { id: 'guillotineKing', title: '불사조', desc: '단두대 사투에서 3승 이상 생존 방어', icon: '🛡️', unlocked: hasGuillotineKing, color: '#34d399' },
      { id: 'games10', title: '골프 중독', desc: '모임 통산 10경기 출전 돌파', icon: '🏌️‍♂️', unlocked: has10Games, color: '#a855f7' },
      { id: 'games50', title: '고인물', desc: '모임 통산 50경기 출전 베테랑', icon: '🌪️', unlocked: has50Games, color: '#ec4899' },
      { id: 'games100', title: '전설', desc: '모임 통산 100경기 출전 레전드', icon: '🏛️', unlocked: has100Games, color: '#f59e0b' },
      { id: 'challenger', title: '천상계 정복', desc: '최상위 등급 챌린저 티어 도달', icon: '👑', unlocked: hasChallenger, color: '#ffd700' },
      { id: 'bigSponsor', title: '만수르', desc: '단일 경기 독박 결제 10만원 이상 쾌척', icon: '💸', unlocked: hasBigSponsor, color: '#f43f5e' },
    ];
  })();

  const unlockedAchievementsCount = achievements.filter((a) => a.unlocked).length;

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

            {/* Admin Checkbox to delegate/revoke Admin Rights (Premium iOS-Style Toggle Switch!) */}
            {isAdmin && currentAdminId !== player.id && (
              <div 
                onClick={() => !updatingAdminStatus && handleToggleAdminRights(!playerIsAdmin)}
                style={{
                  marginTop: '12px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '6px 12px',
                  borderRadius: '12px',
                  backgroundColor: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid rgba(255, 255, 255, 0.04)',
                  cursor: updatingAdminStatus ? 'not-allowed' : 'pointer',
                  userSelect: 'none',
                  transition: 'all 0.2s'
                }}
              >
                {/* Custom iOS Slide Toggle Switch */}
                <div style={{
                  width: '34px',
                  height: '18px',
                  borderRadius: '9px',
                  backgroundColor: playerIsAdmin ? '#10b981' : 'rgba(255, 255, 255, 0.08)',
                  position: 'relative',
                  transition: 'all 0.2s',
                  border: '1px solid ' + (playerIsAdmin ? '#10b981' : 'rgba(255, 255, 255, 0.1)')
                }}>
                  <div style={{
                    width: '12px',
                    height: '12px',
                    borderRadius: '50%',
                    backgroundColor: '#fff',
                    position: 'absolute',
                    top: '2px',
                    left: playerIsAdmin ? '18px' : '2px',
                    transition: 'all 0.2s',
                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.4)'
                  }} />
                </div>
                
                {/* Dynamic Status Text */}
                <span style={{ 
                  fontSize: '11px', 
                  fontWeight: '700', 
                  color: playerIsAdmin ? '#34d399' : 'var(--text-muted)',
                  transition: 'color 0.2s'
                }}>
                  {playerIsAdmin ? '관리자 권한 활성화' : '관리자 권한 부여'}
                </span>
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
            <div className="stat-box cost-box" style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '14px' }}>
              <div style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: '8px', marginBottom: '4px' }}>
                <div className="stat-val" style={{ fontSize: '18px', color: '#34d399' }}>
                  {(stats.netCost ?? stats.totalCost).toLocaleString()}원
                </div>
                <div className="stat-lbl" style={{ fontSize: '10px' }}>실질 누적 순지출 (경기당 평균: {Math.round(stats.averageCost).toLocaleString()}원)</div>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', marginBottom: '4px' }}>
                <div style={{ backgroundColor: 'rgba(255, 255, 255, 0.02)', padding: '6px 4px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', textAlign: 'center' }}>
                  <div style={{ fontSize: '12px', fontWeight: '800', color: 'var(--text-primary)' }}>{(stats.normalCost ?? 0).toLocaleString()}원</div>
                  <div style={{ fontSize: '9px', fontWeight: '700', color: 'var(--text-muted)', marginTop: '2px' }}>정규전 지출 ⛳</div>
                </div>
                <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.05)', padding: '6px 4px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(239, 68, 68, 0.15)', textAlign: 'center' }}>
                  <div style={{ fontSize: '12px', fontWeight: '800', color: '#f87171' }}>{stats.guillotineLost.toLocaleString()}원</div>
                  <div style={{ fontSize: '9px', fontWeight: '700', color: 'var(--text-muted)', marginTop: '2px' }}>단두대 독박 💸</div>
                </div>
                <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.05)', padding: '6px 4px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(16, 185, 129, 0.15)', textAlign: 'center' }}>
                  <div style={{ fontSize: '12px', fontWeight: '800', color: '#34d399' }}>{stats.guillotineSaved.toLocaleString()}원</div>
                  <div style={{ fontSize: '9px', fontWeight: '700', color: 'var(--text-muted)', marginTop: '2px' }}>단두대 절약 🛡️</div>
                </div>
              </div>

              {/* 1. Universal Overall League Record & Win Rate Progress Bar */}
              {stats.totalGames > 0 && (() => {
                const wins = stats.leagueWins || 0;
                const losses = stats.leagueLosses || 0;
                const total = wins + losses;
                if (total === 0) return null;
                
                const winRate = Math.round((wins / total) * 1000) / 10; // e.g. 72.5%
                
                return (
                  <div style={{
                    marginTop: '4px',
                    paddingTop: '8px',
                    borderTop: '1px dashed rgba(255,255,255,0.04)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10px', fontWeight: '700' }}>
                      <span style={{ color: 'var(--accent)' }}>통합 리그 승률</span>
                      <span style={{ color: 'var(--text-secondary)' }}>
                        {total}전 {wins}승 {losses}패 (<span style={{ color: winRate >= 50 ? '#34d399' : '#f87171' }}>{winRate}%</span>)
                      </span>
                    </div>
                    
                    {/* Custom Micro Progress Bar */}
                    <div style={{ width: '100%', height: '4px', borderRadius: '2px', backgroundColor: 'rgba(255,255,255,0.05)', overflow: 'hidden', position: 'relative' }}>
                      <div style={{
                        width: `${winRate}%`,
                        height: '100%',
                        borderRadius: '2px',
                        background: 'linear-gradient(90deg, #10b981, #34d399)',
                        transition: 'width 0.3s'
                      }} />
                    </div>
                  </div>
                );
              })()}

              {/* 2. Secondary Guillotine survival rate (only visible to those who played Guillotine!) */}
              {((stats.guillotineWins || 0) + (stats.guillotineLosses || 0)) > 0 && (() => {
                const totalG = (stats.guillotineWins || 0) + (stats.guillotineLosses || 0);
                const wins = stats.guillotineWins || 0;
                const losses = stats.guillotineLosses || 0;
                const survivalRate = Math.round((wins / totalG) * 1000) / 10; // e.g. 80.5%
                
                return (
                  <div style={{
                    marginTop: '8px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: '10px',
                    fontWeight: '700',
                    backgroundColor: 'rgba(255,255,255,0.01)',
                    padding: '5px 8px',
                    borderRadius: '4px',
                    border: '1px solid rgba(255,255,255,0.02)'
                  }}>
                    <span style={{ color: '#fbbf24' }}>단두대 생존율</span>
                    <span style={{ color: 'var(--text-muted)' }}>
                      {totalG}전 {wins}승 {losses}패 (<span style={{ color: survivalRate >= 50 ? '#34d399' : '#f87171' }}>{survivalRate}%</span>)
                    </span>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* 1. Recent 5 Games Stroke Trend Chart (Pure SVG Lightweight Neon Line Chart!) */}
          {(() => {
            const trendMatches = results
              .filter(r => !((r.bet_amount || 0) > 0 || (r.notes || '').includes('[단두대]') || (r.notes || '').includes('9홀') || r.raw_score < 65))
              .slice(0, 5)
              .reverse();

            if (trendMatches.length < 2) return null;

            const scores = trendMatches.map(m => m.raw_score);
            const minScore = Math.min(...scores);
            const maxScore = Math.max(...scores);
            const scoreRange = maxScore === minScore ? 10 : maxScore - minScore;

            // In golf, LOWER score is BETTER, so lower score is mapped HIGHER up on the Y axis!
            const getY = (s: number) => {
              if (maxScore === minScore) return 40;
              return 22 + ((s - minScore) / scoreRange) * (62 - 22);
            };

            const getX = (idx: number) => {
              const total = trendMatches.length;
              return 35 + (idx / (total - 1)) * 230;
            };

            const points = trendMatches.map((m, idx) => ({ x: getX(idx), y: getY(m.raw_score), score: m.raw_score, date: m.played_at }));
            const pathD = points.reduce((acc, pt, idx) => {
              if (idx === 0) return `M ${pt.x} ${pt.y}`;
              const prev = points[idx - 1];
              const cpX = (prev.x + pt.x) / 2;
              return `${acc} C ${cpX} ${prev.y}, ${cpX} ${pt.y}, ${pt.x} ${pt.y}`;
            }, '');

            const areaD = `${pathD} L ${points[points.length - 1].x} 74 L ${points[0].x} 74 Z`;

            const firstScore = scores[0];
            const lastScore = scores[scores.length - 1];
            const diff = firstScore - lastScore;

            return (
              <div style={{
                backgroundColor: 'var(--bg-hover)',
                borderRadius: 'var(--radius-md)',
                padding: '14px 16px',
                border: '1px solid var(--border-color)',
                marginBottom: '16px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <h4 style={{ fontSize: '13px', fontWeight: '700', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <TrendingUp size={15} color="var(--accent)" /> 최근 타수 페이스 추이
                  </h4>
                  <span style={{ fontSize: '11px', fontWeight: '700', color: diff > 0 ? '#10b981' : diff < 0 ? '#fbbf24' : '#60a5fa' }}>
                    {diff > 0 ? `🔥 ${diff}타 줄이며 상승세!` : diff < 0 ? `⛳ +${Math.abs(diff)}타 페이스 조율 중` : `🎯 일관된 타수 유지 중`}
                  </span>
                </div>

                <div style={{ width: '100%', overflow: 'hidden' }}>
                  <svg viewBox="0 0 300 85" style={{ width: '100%', height: 'auto', display: 'block' }}>
                    <defs>
                      <linearGradient id="strokeAreaGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
                        <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>

                    <path d={areaD} fill="url(#strokeAreaGrad)" />
                    <path d={pathD} fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" />

                    {points.map((pt, idx) => {
                      const dateObj = new Date(pt.date);
                      const dateStr = `${dateObj.getMonth() + 1}/${dateObj.getDate()}`;
                      const isBestInRecent = pt.score === minScore;

                      return (
                        <g key={idx}>
                          <circle cx={pt.x} cy={pt.y} r="4" fill="#10b981" stroke="#ffffff" strokeWidth="1.5" />
                          <text
                            x={pt.x}
                            y={pt.y - 7}
                            fill={isBestInRecent ? '#ffd700' : 'var(--text-primary)'}
                            fontSize="10"
                            fontWeight="800"
                            textAnchor="middle"
                          >
                            {pt.score}타
                          </text>
                          <text x={pt.x} y="82" fill="var(--text-muted)" fontSize="9" textAnchor="middle">
                            {dateStr}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                </div>
              </div>
            );
          })()}

          {/* 2. 10 Official Achievements Collection Grid */}
          <div style={{
            backgroundColor: 'var(--bg-hover)',
            borderRadius: 'var(--radius-md)',
            padding: '14px 16px',
            border: '1px solid var(--border-color)',
            marginBottom: '16px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h4 style={{ fontSize: '13px', fontWeight: '700', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Award size={15} color="#ffd700" /> 명예의 공식 업적 (10선)
              </h4>
              <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--accent)' }}>
                {unlockedAchievementsCount} / 10개 달성 ({Math.round(unlockedAchievementsCount * 10)}%)
              </span>
            </div>

            {/* 10 Achievements Grid (5x2 layout) */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(5, 1fr)',
              gap: '10px'
            }}>
              {achievements.map((item) => {
                const isSelected = selectedBadgeId === item.id;
                return (
                  <div
                    key={item.id}
                    onClick={() => setSelectedBadgeId(selectedBadgeId === item.id ? null : item.id)}
                    title={`${item.title}: ${item.desc} (${item.unlocked ? '달성 완료' : '미달성'})`}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      textAlign: 'center',
                      position: 'relative',
                      cursor: 'pointer',
                      transition: 'transform 0.15s ease'
                    }}
                  >
                    <div style={{
                      width: '44px',
                      height: '44px',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '18px',
                      backgroundColor: item.unlocked ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.2)',
                      border: isSelected 
                        ? '2px solid #ffffff' 
                        : item.unlocked 
                        ? `1.5px solid ${item.color}` 
                        : '1px dashed rgba(255, 255, 255, 0.1)',
                      boxShadow: isSelected
                        ? '0 0 14px rgba(255, 255, 255, 0.6)'
                        : item.unlocked 
                        ? `0 0 10px ${item.color}40` 
                        : 'none',
                      transform: isSelected ? 'scale(1.12)' : 'none',
                      filter: item.unlocked ? 'none' : 'grayscale(100%) opacity(0.35)',
                      position: 'relative',
                      transition: 'all 0.2s',
                      userSelect: 'none'
                    }}>
                      <span>{item.icon}</span>

                      {!item.unlocked && (
                        <div style={{
                          position: 'absolute',
                          bottom: '-2px',
                          right: '-2px',
                          backgroundColor: '#1e293b',
                          borderRadius: '50%',
                          padding: '2px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          border: '1px solid rgba(255,255,255,0.1)'
                        }}>
                          <Lock size={8} color="#94a3b8" />
                        </div>
                      )}
                    </div>

                    <span style={{
                      fontSize: '10px',
                      fontWeight: isSelected || item.unlocked ? '700' : '500',
                      color: isSelected ? '#ffffff' : item.unlocked ? 'var(--text-primary)' : 'var(--text-muted)',
                      marginTop: '5px',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      maxWidth: '56px'
                    }}>
                      {item.title}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Selected Achievement Interactive Mobile Explanation Guide! */}
            {(() => {
              const selectedBadge = achievements.find((a) => a.id === selectedBadgeId);
              if (selectedBadge) {
                return (
                  <div style={{
                    marginTop: '12px',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    backgroundColor: selectedBadge.unlocked ? 'rgba(16, 185, 129, 0.08)' : 'rgba(255, 255, 255, 0.03)',
                    border: selectedBadge.unlocked ? '1px solid rgba(16, 185, 129, 0.25)' : '1px solid var(--border-color)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '10px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '20px' }}>{selectedBadge.icon}</span>
                      <div>
                        <div style={{ fontSize: '12px', fontWeight: '800', color: selectedBadge.unlocked ? selectedBadge.color : 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <span>{selectedBadge.title}</span>
                          <span style={{
                            fontSize: '9px',
                            padding: '1px 5px',
                            borderRadius: '4px',
                            backgroundColor: selectedBadge.unlocked ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.08)',
                            color: selectedBadge.unlocked ? '#34d399' : 'var(--text-muted)',
                            fontWeight: '700'
                          }}>
                            {selectedBadge.unlocked ? '달성 완료' : '미달성'}
                          </span>
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                          {selectedBadge.desc}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedBadgeId(null)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-muted)',
                        fontSize: '13px',
                        cursor: 'pointer',
                        padding: '4px 6px'
                      }}
                    >
                      ✕
                    </button>
                  </div>
                );
              }
              return (
                <div style={{
                  marginTop: '12px',
                  fontSize: '11px',
                  color: 'var(--text-muted)',
                  textAlign: 'center',
                  padding: '6px',
                  backgroundColor: 'rgba(255, 255, 255, 0.01)',
                  borderRadius: '6px',
                  border: '1px solid rgba(255, 255, 255, 0.02)'
                }}>
                  💡 뱃지를 터치하면 달성 조건과 설명을 확인할 수 있습니다.
                </div>
              );
            })()}
          </div>

          {/* Admin Handicap & Nickname Edit Form (Only visible to logged-in admins!) */}
          {isAdmin && (
            <div style={{ backgroundColor: 'rgba(255, 255, 255, 0.02)', padding: '15px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', marginBottom: '20px' }}>
              <h4 style={{ fontSize: '14px', fontWeight: '700', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Sparkles size={16} color="var(--accent)" /> 프로필 편집 (관리자용)
              </h4>
              <form onSubmit={handleUpdateHandicap} style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '14px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '2px' }}>
                  <div>
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
                  <div>
                    <label className="form-label" style={{ fontSize: '11px', marginBottom: '4px' }}>티어 지정</label>
                    <select
                      className="form-input"
                      value={tierInput}
                      onChange={(e) => setTierInput(e.target.value as Tier)}
                      style={{ padding: '8px 12px', backgroundColor: 'var(--bg-hover)' }}
                    >
                      {TIERS_ORDER.map((t) => (
                        <option key={t} value={t}>
                          {TIER_THEMES[t].name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
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
                  <div>
                    <label className="form-label" style={{ fontSize: '11px', marginBottom: '4px' }}>LP 점수 (0 ~ 100점)</label>
                    <input
                      type="number"
                      className="form-input"
                      style={{ padding: '8px 12px' }}
                      value={pointsInput}
                      onChange={(e) => setPointsInput(e.target.value)}
                      placeholder="예: 50"
                      min="0"
                      max="9999"
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
                  <option value="Active">활동중</option>
                  <option value="Dormant">휴면</option>
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

                // Identify MatchMode parameters
                const isGuillotine = (res.bet_amount || 0) > 0;
                const isScratch = res.notes?.startsWith('[스크래치]');
                const modeName = isGuillotine ? '단두대' : isScratch ? '스크래치' : '핸디';
                const modeColor = isGuillotine ? '#fbbf24' : isScratch ? '#60a5fa' : '#10b981';
                const modeBg = isGuillotine ? 'rgba(245,158,11,0.06)' : isScratch ? 'rgba(96,165,250,0.06)' : 'rgba(16,185,129,0.06)';

                // Binary Win/Loss for Guillotine matches, otherwise normal Rank placing
                const isGuillotineWin = isGuillotine && res.cost_paid === 0;
                const rankDisplay = isGuillotine
                  ? (isGuillotineWin ? '승' : '패')
                  : `${res.rank}등`;

                return (
                  <div key={res.id} className="profile-history-item">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span
                        style={{
                          fontWeight: '800',
                          color: isGuillotine 
                            ? (isGuillotineWin ? '#34d399' : '#f87171') 
                            : (res.rank === 1 ? '#ffd700' : 'var(--text-secondary)'),
                          fontSize: '14px',
                          minWidth: '24px',
                          textAlign: 'center'
                        }}
                      >
                        {rankDisplay}
                      </span>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <span style={{ fontWeight: '600', fontSize: '13px' }}>{res.raw_score}타 (핸디 {res.adjusted_score}타)</span>
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span style={{ fontSize: '9px', color: modeColor, backgroundColor: modeBg, padding: '2px 5px', borderRadius: '3px', fontWeight: 'bold' }}>
                            {modeName}
                          </span>
                          <Calendar size={10} /> {new Date(res.played_at).toLocaleDateString('ko-KR')}
                        </span>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span
                        className={`history-lp-diff ${isGuillotine ? 'zero' : (isPlus ? 'plus' : 'minus')}`}
                        style={{ fontWeight: '700', fontSize: '14px', color: isGuillotine ? 'var(--text-muted)' : undefined }}
                      >
                        {isGuillotine ? '0 LP' : (isPlus ? `+${lpDiff}` : lpDiff) + ' LP'}
                      </span>
                      <div style={{ fontSize: '10px', color: '#f87171' }}>
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
              <span>이 플레이어 회원 탈퇴 (영구 삭제)</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
