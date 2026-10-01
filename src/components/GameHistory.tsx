import React, { useState, useEffect, useMemo } from 'react';
import { History, Calendar, ArrowUpRight, ArrowDownRight, Trash2, Edit2, Sparkles } from 'lucide-react';
import { type GameWithResults, type MatchMode, TIER_THEMES, TIER_WEIGHTS } from '../types';
import { tiergService } from '../services/tiergService';

interface GameHistoryProps {
  refreshTrigger: number;
  onGameDeleted: () => void;
  isAdmin: boolean;
}

export const GameHistory: React.FC<GameHistoryProps> = ({ refreshTrigger, onGameDeleted, isAdmin }) => {
  const [games, setGames] = useState<GameWithResults[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [saving, setSaving] = useState(false);

  // Inline Edit Form State (Single-game edit target)
  const [editingGameId, setEditingGameId] = useState<string | null>(null);
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'handicap' | 'scratch' | 'guillotine'>('all'); // Newly added filter state!
  const [editNotes, setEditNotes] = useState<string>('');
  const [editPlayedAt, setEditPlayedAt] = useState<string>('');
  const [editMatchMode, setEditMatchMode] = useState<MatchMode>('handicap');
  const [editGuillotineHoles, setEditGuillotineHoles] = useState<'9' | '18'>('9'); // Guillotine 9H vs 18H in edit mode!
  const [editRawScores, setEditRawScores] = useState<Record<string, string>>({});
  const [editScoreSelections, setEditScoreSelections] = useState<Record<string, string>>({});
  const [editGuillotineHandicaps, setEditGuillotineHandicaps] = useState<Record<string, string>>({});
  const [editCostsPaid, setEditCostsPaid] = useState<Record<string, string>>({});

  useEffect(() => {
    loadGames();
  }, [refreshTrigger]);

  const loadGames = async () => {
    setLoading(true);
    try {
      const fetchedGames = await tiergService.getGames();
      setGames(fetchedGames);
    } catch (error) {
      console.error('Failed to load games:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteGame = async (gameId: string) => {
    if (window.confirm('선택하신 경기를 취소하시겠습니까?\n\n취소 시 해당 경기로 인한 플레이어들의 LP 변동 내역이 자동 차감 및 복구 처리됩니다.')) {
      setDeleting(true);
      try {
        await tiergService.deleteGame(gameId);
        alert('경기가 전적 역산 복구와 함께 성공적으로 삭제되었습니다.');
        onGameDeleted();
      } catch (error: any) {
        alert(error.message || '경기 삭제에 실패했습니다.');
      } finally {
        setDeleting(false);
      }
    }
  };

  // Format and share dynamic game results text directly to KakaoTalk or clipboard!
  const handleShareGameResult = (game: any, results: any[]) => {
    const isGuillotine = results.some((r) => (r.bet_amount || 0) > 0) || (game.notes || '').includes('[단두대');
    const isScratch = game.notes?.includes('[스크래치]');
    const is9Holes = (game.notes || '').includes('9홀') || !(game.notes || '').includes('18홀');
    const modeName = isGuillotine ? `단두대 (${is9Holes ? '9홀' : '18홀'})` : isScratch ? '스크래치' : '핸디캡';

    const formattedDate = new Date(game.played_at).toLocaleString('ko-KR', {
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    let shareText = `⛳ [TierGolf] 경기 결과 보고\n`;
    shareText += `일시: ${formattedDate}\n`;
    shareText += `모드: ${modeName}\n`;
    
    let notesText = (game.notes || '')
      .replace(/\[단두대(?:\s*(?:9홀|18홀))?\]/g, '')
      .replace(/\[스크래치\]/g, '')
      .trim();
    if (notesText) {
      shareText += `코스/메모: ${notesText}\n`;
    }
    shareText += `\n■ 경기 결과 현황\n`;

    const sortedResults = [...results].sort((a, b) => a.rank - b.rank);
    sortedResults.forEach((res) => {
      const isWin = isGuillotine && res.cost_paid === 0;
      const rankLabel = isGuillotine ? (isWin ? '승' : '패') : `${res.rank}등`;
      
      const lpSign = res.points_changed > 0 ? `+${res.points_changed}` : `${res.points_changed}`;
      const lpDisplay = (isScratch || isGuillotine) ? `0 LP` : `${lpSign} LP`;

      // Display both raw score and handicap adjusted score!
      const scoreDisplay = isScratch
        ? `${res.raw_score}타`
        : `${res.raw_score}타 (${isGuillotine ? `${is9Holes ? '9홀' : '18홀'} ` : ''}핸디 ${res.adjusted_score}타)`;

      let costDisplay = '';
      if (isGuillotine) {
        const betText = (res.bet_amount || 0) > 0 ? ` (베팅: ${(res.bet_amount || 0).toLocaleString()}원)` : '';
        costDisplay = res.cost_paid > 0 ? ` [${res.cost_paid.toLocaleString()}원 독박]${betText}` : betText;
      } else {
        costDisplay = res.cost_paid > 0 ? ` [${res.cost_paid.toLocaleString()}원 지출]` : '';
      }

      shareText += `${rankLabel}. ${res.player_name}: ${scoreDisplay} | ${lpDisplay}${costDisplay}\n`;
    });

    shareText += `\n지금 리더보드를 확인해 보세요! 🏌️‍♂️`;

    if (navigator.share) {
      navigator.share({
        title: 'TierGolf 경기 결과',
        text: shareText,
      }).catch((err) => console.log('Share canceled or failed:', err));
    } else {
      navigator.clipboard.writeText(shareText)
        .then(() => alert('결과 리스트가 클립보드에 복사되었습니다! 카톡방에 붙여넣기 하세요.'))
        .catch(() => alert('복사에 실패했습니다.'));
    }
  };

  // Populate inline edit states with this game details when editing is clicked
  const handleStartEdit = (gameWithRes: GameWithResults) => {
    setEditingGameId(gameWithRes.game.id);

    // Detect Guillotine 9-hole vs 18-hole
    const notesStr = gameWithRes.game.notes || '';
    const is9Holes = notesStr.includes('9홀') || !notesStr.includes('18홀');
    const holes: '9' | '18' = is9Holes ? '9' : '18';
    setEditGuillotineHoles(holes);

    // Strip [스크래치] or [단두대] prefixes cleanly with regex (handles with or without trailing space!)
    const cleanNotes = notesStr
      .replace(/\[단두대(?:\s*(?:9홀|18홀))?\]/g, '')
      .replace(/\[스크래치\]/g, '')
      .trim();

    setEditNotes(cleanNotes);
    
    // Convert DB UTC ISO string safely to Local timezone ISO string for datetime-local input!
    const utcDate = new Date(gameWithRes.game.played_at);
    const tzOffset = utcDate.getTimezoneOffset() * 60000;
    const localISO = new Date(utcDate.getTime() - tzOffset).toISOString().substring(0, 16);
    setEditPlayedAt(localISO);

    // Detect MatchMode with 100% robust cache-free dual check!
    let mode: MatchMode = 'handicap';
    const hasBet = gameWithRes.results.some((r) => (r.bet_amount || 0) > 0);
    if (hasBet || gameWithRes.game.notes?.includes('[단두대]')) {
      mode = 'guillotine';
    } else if (gameWithRes.game.notes?.includes('[스크래치]')) {
      mode = 'scratch';
    }
    setEditMatchMode(mode);

    // Reconstruct player input values
    const scoresMap: Record<string, string> = {};
    const selectionsMap: Record<string, string> = {};
    const handicapsMap: Record<string, string> = {};
    const costsMap: Record<string, string> = {};

    gameWithRes.results.forEach((res) => {
      const is9H = mode === 'guillotine' && holes === '9';
      const basePar = is9H ? 36 : 72;
      const relativeStrokes = res.raw_score - basePar;

      if (is9H) {
        if (relativeStrokes >= -5 && relativeStrokes <= 25) {
          selectionsMap[res.player_id] = relativeStrokes.toString();
        } else {
          selectionsMap[res.player_id] = 'direct';
        }
      } else {
        if (relativeStrokes >= -10 && relativeStrokes <= 40) {
          selectionsMap[res.player_id] = relativeStrokes.toString();
        } else {
          selectionsMap[res.player_id] = 'direct';
        }
      }

      scoresMap[res.player_id] = res.raw_score.toString();
      
      // Calculate handicap used on that day (raw - adjusted)
      const handicapUsed = res.raw_score - res.adjusted_score;
      handicapsMap[res.player_id] = handicapUsed.toString();

      // Original Bet or Cost amount (properly pre-fills existing costs!)
      let costToFill = 0;
      if (mode === 'guillotine') {
        costToFill = (res.bet_amount ?? 0) > 0 ? (res.bet_amount ?? 0) : (res.cost_paid || 0);
      } else {
        costToFill = res.cost_paid || 0;
      }
      // If 0, keep empty string so placeholder '0' shows without forcing user to delete '0' on click!
      costsMap[res.player_id] = costToFill > 0 ? costToFill.toString() : '';
    });

    setEditRawScores(scoresMap);
    setEditScoreSelections(selectionsMap);
    setEditGuillotineHandicaps(handicapsMap);
    setEditCostsPaid(costsMap);
  };

  const getRawScoreForPlayer = (id: string): number => {
    const is9Hole = editMatchMode === 'guillotine' && editGuillotineHoles === '9';
    const basePar = is9Hole ? 36 : 72;
    const defaultOver = is9Hole ? '9' : '18';

    const selection = editScoreSelections[id] || defaultOver;
    if (selection === 'direct') {
      return parseInt(editRawScores[id], 10) || basePar;
    }
    return basePar + parseInt(selection, 10);
  };

  const handleUpdateSubmit = async (e: React.FormEvent, gameId: string, results: any[]) => {
    e.preventDefault();
    setSaving(true);
    try {
      const resultsPayload = [];
      for (const res of results) {
        const id = res.player_id;
        const raw = getRawScoreForPlayer(id);
        const cost = parseInt(editCostsPaid[id], 10) || 0;

        if (editScoreSelections[id] === 'direct') {
          const directRaw = parseInt(editRawScores[id], 10);
          if (isNaN(directRaw) || directRaw < 18 || directRaw > 180) {
            alert(`${res.player_name} 선수의 타수 직접 입력값(18~180타)이 올바르지 않습니다.`);
            setSaving(false);
            return;
          }
        }

        if (cost < 0) {
          alert(`${res.player_name} 선수의 비용은 0원 이상이어야 합니다.`);
          setSaving(false);
          return;
        }

        // Strictly preserve the historical handicap applied on that game day!
        // This ensures subsequent promotions/demotions never corrupt past game recalculations!
        let customH: number | undefined = undefined;
        if (editMatchMode === 'guillotine') {
          const hVal = parseInt(editGuillotineHandicaps[id], 10) || 0;
          if (hVal < 0 || hVal > 72) {
            alert(`${res.player_name} 선수의 단두대 임시 핸디캡(0~72개)이 올바르지 않습니다.`);
            setSaving(false);
            return;
          }
          customH = hVal;
        } else if (editMatchMode === 'handicap') {
          // Strictly lock to the exact handicap used on the day of this game!
          customH = res.raw_score - res.adjusted_score;
        }

        resultsPayload.push({
          player_id: id,
          raw_score: raw,
          cost_paid: cost,
          custom_handicap: customH,
        });
      }

      const dateStr = new Date(editPlayedAt).toISOString();
      let finalNotes = editNotes.trim();
      if (editMatchMode === 'scratch') {
        finalNotes = `[스크래치] ${finalNotes}`.trim();
      } else if (editMatchMode === 'guillotine') {
        finalNotes = `[단두대 ${editGuillotineHoles}홀] ${finalNotes}`.trim();
      }

      await tiergService.updateGame(gameId, finalNotes, dateStr, resultsPayload, editMatchMode);
      alert('경기 정보 수정 저장이 완료되었습니다!');
      setEditingGameId(null);
      onGameDeleted(); // Refresh games history and live leaderboard!
    } catch (err) {
      console.error('Failed to update game inline:', err);
      alert('경기 정보 수정 저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  // Helper to determine game mode dynamically based on the reliable game notes prefix or bet amounts!
  const getGameMode = (gameWithRes: GameWithResults): MatchMode => {
    const hasBet = gameWithRes.results.some((r) => (r.bet_amount || 0) > 0);
    if (hasBet || gameWithRes.game.notes?.includes('[단두대]')) return 'guillotine';
    if (gameWithRes.game.notes?.includes('[스크래치]')) return 'scratch';
    return 'handicap';
  };

  const filteredGames = useMemo(() => {
    return games.filter((g) => {
      if (selectedFilter === 'all') return true;
      return getGameMode(g) === selectedFilter;
    });
  }, [games, selectedFilter]);

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>이전 경기 이력을 가져오는 중...</div>;
  }

  if (games.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
        <History size={48} style={{ marginBottom: '15px', strokeWidth: '1.5' }} />
        <p style={{ fontSize: '15px', fontWeight: '600' }}>기록된 경기 전적이 아직 없습니다.</p>
        <p style={{ fontSize: '12px', marginTop: '4px' }}>'경기 입력' 탭에서 첫 경기를 입력해 보세요!</p>
      </div>
    );
  }

  return (
    <div>
      <div className="page-title">
        경기 히스토리
      </div>

      {/* Match Mode Capsule Filters */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '16px', overflowX: 'auto', paddingBottom: '4px' }}>
        {[
          { id: 'all', label: '전체' },
          { id: 'handicap', label: '핸디캡' },
          { id: 'scratch', label: '스크래치' },
          { id: 'guillotine', label: '단두대' }
        ].map((f) => {
          const isActive = selectedFilter === f.id;
          return (
            <button
              key={f.id}
              onClick={() => {
                setSelectedFilter(f.id as any);
                setEditingGameId(null); // Close any active inline editors when switching filters!
              }}
              style={{
                background: isActive ? 'var(--accent)' : 'rgba(255,255,255,0.03)',
                color: isActive ? '#fff' : 'var(--text-secondary)',
                border: isActive ? '1px solid var(--accent)' : '1px solid rgba(255,255,255,0.05)',
                borderRadius: '20px',
                padding: '6px 14px',
                fontSize: '12px',
                fontWeight: '700',
                cursor: 'pointer',
                transition: 'all 0.2s',
                whiteSpace: 'nowrap'
              }}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {filteredGames.map(({ game, results }) => {
          const totalGameCost = results.reduce((sum, r) => sum + r.cost_paid, 0);
          const isCurrentlyEditing = editingGameId === game.id;

          // Declare match mode variables at the card top-level!
          const isGuillotine = results.some((r) => (r.bet_amount || 0) > 0) || (game.notes || '').includes('[단두대');
          const isScratch = game.notes?.startsWith('[스크래치]');
          const is9Holes = (game.notes || '').includes('9홀') || !(game.notes || '').includes('18홀');
          const guillotineLabel = is9Holes ? '단두대 9홀' : '단두대 18홀';
          const modeName = isGuillotine ? guillotineLabel : isScratch ? '스크래치' : '핸디';
          const modeColor = isGuillotine ? '#fbbf24' : isScratch ? '#60a5fa' : '#10b981';
          const modeBg = isGuillotine ? 'rgba(245,158,11,0.06)' : isScratch ? 'rgba(96,165,250,0.06)' : 'rgba(16,185,129,0.06)';

          return (
            <div key={game.id} className="game-history-card" style={{ border: isCurrentlyEditing ? '1px solid var(--accent)' : '1px solid var(--border-color)' }}>
              
              {/* Game Card Header */}
              <div className="game-history-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <div className="game-date" style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', lineHeight: '1.2' }}>
                    <Calendar size={13} color="var(--accent)" style={{ flexShrink: 0, marginTop: '-1px' }} />
                    <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                      {new Date(game.played_at).toLocaleString('ko-KR', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    <span style={{ fontSize: '9px', color: modeColor, backgroundColor: modeBg, padding: '2px 6px', borderRadius: '3px', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center' }}>
                      {modeName}
                    </span>
                  </div>
                  {(() => {
                    const cleanNotes = (game.notes || '')
                      .replace(/\[단두대(?:\s*(?:9홀|18홀))?\]/g, '')
                      .replace(/\[스크래치\]/g, '')
                      .trim();
                    if (!cleanNotes) return null;
                    return <div className="game-notes" style={{ marginTop: '7px' }}>{cleanNotes}</div>;
                  })()}
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    총 경비: <strong style={{ color: '#34d399', fontSize: '12px' }}>{totalGameCost.toLocaleString()}원</strong>
                  </div>
                  
                  {!isCurrentlyEditing && (
                    <div style={{ display: 'flex', gap: '5px', marginTop: '2px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                      {/* Share Button - ALWAYS visible to all users (both players and admins!) */}
                      <button
                        type="button"
                        onClick={() => handleShareGameResult(game, results)}
                        style={{
                          background: 'none',
                          border: '1px solid rgba(245, 158, 11, 0.4)',
                          color: '#fbbf24',
                          fontSize: '11px',
                          padding: '3px 8px',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          transition: 'all 0.2s',
                          fontWeight: '700'
                        }}
                      >
                        결과 공유
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* CARD BODY: Toggle between Inline Editor vs Normal Results List */}
              {isCurrentlyEditing ? (
                // 1. INLINE EDIT FORM (Beautiful embedded sub-form!)
                <form onSubmit={(e) => handleUpdateSubmit(e, game.id, results)} style={{ marginTop: '14px', borderTop: '1px dashed var(--border-color)', paddingTop: '14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  
                  {/* Inline Form Title */}
                  <div style={{ fontSize: '13px', fontWeight: '800', color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Sparkles size={14} /> 경기 기록 수정
                  </div>

                  {/* Inline Game Meta Fields (No wrapping!) */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div className="form-group" style={{ marginBottom: '0' }}>
                      <label className="form-label" style={{ fontSize: '11px', marginBottom: '4px' }}>경기 일시</label>
                      <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
                        <input
                          type="datetime-local"
                          className="form-input"
                          style={{ flex: 1, height: '40px !important', padding: '6px 8px !important', fontSize: '13px !important' }}
                          value={editPlayedAt}
                          onChange={(e) => setEditPlayedAt(e.target.value)}
                          step="600"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const nowLocal = new Date();
                            const minutes = nowLocal.getMinutes();
                            const roundedMinutes = Math.round(minutes / 10) * 10;
                            nowLocal.setMinutes(roundedMinutes);
                            nowLocal.setSeconds(0);
                            nowLocal.setMilliseconds(0);
                            const tzOffset = nowLocal.getTimezoneOffset() * 60000;
                            const localISOTime = new Date(nowLocal.getTime() - tzOffset).toISOString().substring(0, 16);
                            setEditPlayedAt(localISOTime);
                          }}
                          className="submit-btn"
                          style={{
                            width: 'auto',
                            whiteSpace: 'nowrap',
                            padding: '6px 12px',
                            fontSize: '12px',
                            background: 'none', // Premium Glass Ghost Button
                            border: '1px solid rgba(255, 255, 255, 0.15)',
                            color: 'var(--text-primary)', // Bright and fully clickable!
                            fontWeight: '700'
                          }}
                        >
                          지금
                        </button>
                      </div>
                    </div>

                    {/* Tactile 3-Segment Button Selector (Full width, no wrapping squishing!) */}
                    <div className="form-group" style={{ marginBottom: '0' }}>
                      <label className="form-label" style={{ fontSize: '11px', marginBottom: '4px' }}>매치 모드</label>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', marginTop: '2px' }}>
                        {[
                          { id: 'handicap', label: '핸디 적용' },
                          { id: 'scratch', label: '스크래치' },
                          { id: 'guillotine', label: '단두대' }
                        ].map((m) => {
                          const isActive = editMatchMode === m.id;
                          return (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => setEditMatchMode(m.id as any)}
                              style={{
                                padding: '8px 4px',
                                fontSize: '12px',
                                fontWeight: isActive ? '800' : '600',
                                borderRadius: 'var(--radius-sm)',
                                border: isActive ? '1px solid var(--accent)' : '1px solid rgba(255,255,255,0.05)',
                                background: isActive ? 'linear-gradient(135deg, #10b981, #047857)' : 'rgba(255,255,255,0.02)',
                                color: isActive ? '#fff' : 'var(--text-secondary)',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                textAlign: 'center',
                                boxShadow: isActive ? '0 4px 12px rgba(16, 185, 129, 0.12)' : 'none'
                              }}
                            >
                              {m.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Guillotine 9-Hole vs 18-Hole Selector in Edit Mode */}
                    {editMatchMode === 'guillotine' && (
                      <div style={{
                        marginTop: '6px',
                        padding: '6px 10px',
                        borderRadius: '6px',
                        backgroundColor: 'rgba(245, 158, 11, 0.08)',
                        border: '1px solid rgba(245, 158, 11, 0.25)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '8px'
                      }}>
                        <span style={{ fontSize: '11px', fontWeight: '700', color: '#fbbf24' }}>
                          단두대 진행 홀 수:
                        </span>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          {[
                            { id: '9', label: '9홀 단두대' },
                            { id: '18', label: '18홀 단두대' },
                          ].map((h) => {
                            const isActive = editGuillotineHoles === h.id;
                            return (
                              <button
                                key={h.id}
                                type="button"
                                onClick={() => {
                                  const newHoles = h.id as '9' | '18';
                                  setEditGuillotineHoles(newHoles);
                                  const newBase = newHoles === '9' ? 36 : 72;
                                  const newDefault = newHoles === '9' ? '9' : '18';
                                  const updatedSelections: Record<string, string> = {};
                                  const updatedRaws: Record<string, string> = {};
                                  results.forEach((r) => {
                                    const pId = r.player_id;
                                    updatedSelections[pId] = newDefault;
                                    updatedRaws[pId] = (newBase + parseInt(newDefault, 10)).toString();
                                  });
                                  setEditScoreSelections(updatedSelections);
                                  setEditRawScores(updatedRaws);
                                }}
                                style={{
                                  padding: '4px 10px',
                                  borderRadius: '4px',
                                  fontSize: '11px',
                                  fontWeight: isActive ? '800' : '600',
                                  border: isActive ? '1px solid #f59e0b' : '1px solid var(--border-color)',
                                  backgroundColor: isActive ? '#f59e0b' : 'var(--bg-card)',
                                  color: isActive ? '#000' : 'var(--text-secondary)',
                                  cursor: 'pointer',
                                  transition: 'all 0.15s'
                                }}
                              >
                                {h.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <div className="form-group" style={{ marginBottom: '0' }}>
                      <label className="form-label" style={{ fontSize: '11px', marginBottom: '4px' }}>코스명 및 메모</label>
                      <input
                        type="text"
                        className="form-input"
                        value={editNotes}
                        onChange={(e) => setEditNotes(e.target.value)}
                        placeholder="예: 아일랜드CC"
                        style={{ height: '40px !important', padding: '6px 8px !important', fontSize: '13px !important' }}
                      />
                    </div>
                  </div>

                  {/* Inline Players Editor */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px', backgroundColor: 'rgba(0,0,0,0.15)', padding: '10px', borderRadius: 'var(--radius-sm)' }}>
                    <div style={{ fontSize: '11px', fontWeight: '800', color: '#fbbf24', borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '4px', marginBottom: '4px' }}>
                      선수별 스코어 / 비용 수정
                    </div>
                    {results.map((res) => {
                      const pId = res.player_id;
                      const theme = TIER_THEMES[res.tier_after] || TIER_THEMES.Iron;

                      return (
                        <div key={pId} style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '6px', borderRadius: '4px', backgroundColor: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.02)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '12px', fontWeight: '800' }}>
                              {res.player_name}
                              <span style={{ fontSize: '10px', color: theme.color, marginLeft: '4px' }}>{theme.name}</span>
                            </span>
                          </div>

                          <div className="inputs-row" style={{ gridTemplateColumns: editMatchMode === 'guillotine' ? '1.2fr 1fr 0.8fr' : '1fr 1fr', gap: '6px' }}>
                            <select
                              className="form-input"
                              value={editScoreSelections[pId] || (editMatchMode === 'guillotine' && editGuillotineHoles === '9' ? '9' : '18')}
                              onChange={(e) => {
                                const val = e.target.value;
                                setEditScoreSelections({ ...editScoreSelections, [pId]: val });
                                if (val !== 'direct') {
                                  const base = editMatchMode === 'guillotine' && editGuillotineHoles === '9' ? 36 : 72;
                                  setEditRawScores({ ...editRawScores, [pId]: (base + parseInt(val, 10)).toString() });
                                }
                              }}
                              style={{ backgroundColor: 'var(--bg-hover)', fontSize: '12px', padding: '6px' }}
                            >
                              {(editMatchMode === 'guillotine' && editGuillotineHoles === '9'
                                ? Array.from({ length: 31 }, (_, i) => -5 + i)
                                : Array.from({ length: 51 }, (_, i) => -10 + i)
                              ).map((v) => {
                                const base = editMatchMode === 'guillotine' && editGuillotineHoles === '9' ? 36 : 72;
                                let label = '';
                                if (v < 0) label = `${v} (${base + v}타)`;
                                else if (v === 0) label = `이븐 (${base + v}타)`;
                                else label = `+${v} (${base + v}타)`;
                                return <option key={v} value={v.toString()}>{label}</option>;
                              })}
                              <option value="direct">직접 입력</option>
                            </select>

                            <input
                              type="number"
                              className="form-input"
                              value={editCostsPaid[pId] ?? ''}
                              onChange={(e) => setEditCostsPaid({ ...editCostsPaid, [pId]: e.target.value })}
                              onFocus={(e) => {
                                if (e.target.value === '0') {
                                  setEditCostsPaid({ ...editCostsPaid, [pId]: '' });
                                }
                              }}
                              placeholder="0"
                              min="0"
                              style={{ fontSize: '12px', padding: '6px' }}
                            />

                            {editMatchMode === 'guillotine' && (
                              <input
                                type="number"
                                className="form-input"
                                value={editGuillotineHandicaps[pId] ?? ''}
                                onChange={(e) => setEditGuillotineHandicaps({ ...editGuillotineHandicaps, [pId]: e.target.value })}
                                placeholder="0"
                                min="0"
                                max="72"
                                style={{ fontSize: '12px', padding: '6px' }}
                              />
                            )}
                          </div>

                          {editScoreSelections[pId] === 'direct' && (
                            <input
                              type="number"
                              className="form-input"
                              value={editRawScores[pId] || ''}
                              onChange={(e) => setEditRawScores({ ...editRawScores, [pId]: e.target.value })}
                              placeholder={editMatchMode === 'guillotine' && editGuillotineHoles === '9' ? "타수 입력 (예: 42)" : "타수 입력 (예: 85)"}
                              min="18"
                              max="180"
                              required
                              style={{ fontSize: '12px', padding: '6px', marginTop: '2px' }}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Inline Form Control Footer Buttons (Symmetrical 5:5 Layout!) */}
                  <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                    <button
                      type="button"
                      onClick={() => setEditingGameId(null)}
                      className="submit-btn"
                      style={{
                        flex: 1,
                        height: '42px',
                        padding: '0 14px',
                        fontSize: '13px',
                        fontWeight: '700',
                        background: 'none',
                        border: '1px solid var(--border-color)',
                        color: 'var(--text-secondary)'
                      }}
                    >
                      수정 취소
                    </button>
                    <button
                      type="submit"
                      className="submit-btn"
                      disabled={saving}
                      style={{
                        flex: 1,
                        height: '42px',
                        padding: '0 14px',
                        fontSize: '13px',
                        fontWeight: '700',
                        background: 'linear-gradient(135deg, #10b981, #047857)',
                        boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)'
                      }}
                    >
                      {saving ? '수정 저장 중...' : '수정 완료'}
                    </button>
                  </div>

                </form>
              ) : (
                // 2. STANDARD RESULTS LIST (Normal view state)
                <div className="game-history-results">
                  {results.map((res) => {
                    const lpDiff = res.points_changed;
                    const isZero = lpDiff === 0;
                    const isPlus = lpDiff > 0;

                    const isGuillotineWin = isGuillotine && res.cost_paid === 0;
                    const rankDisplay = isGuillotine
                      ? (isGuillotineWin ? '승' : '패')
                      : `${res.rank}등`;

                    // Subtle micro promo/demo indicators
                    const isPromo = res.player_tier_before && res.tier_after && TIER_WEIGHTS[res.tier_after] > TIER_WEIGHTS[res.player_tier_before];
                    const isDemo = res.player_tier_before && res.tier_after && TIER_WEIGHTS[res.tier_after] < TIER_WEIGHTS[res.player_tier_before];

                    return (
                      <div
                        key={res.id}
                        className="history-result-row"
                        style={{
                          padding: '6px 0',
                          borderBottom: '1px solid rgba(255, 255, 255, 0.02)',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                          {/* Placement Index (Tied Win/Loss for Guillotine) */}
                          <span
                            className="history-rank"
                            style={{
                              color: isGuillotine
                                ? (isGuillotineWin ? '#34d399' : '#f87171')
                                : (res.rank === 1 ? '#ffd700' : res.rank === 2 ? '#cbd5e1' : 'var(--text-muted)'),
                              fontWeight: isGuillotine ? '800' : 'normal',
                              fontStyle: isGuillotine ? 'normal' : 'italic',
                              minWidth: '24px',
                              textAlign: 'center',
                              display: 'inline-block'
                            }}
                          >
                            {rankDisplay}
                          </span>
                          
                          {/* Player Name and Bet Amount */}
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <span className="history-name" style={{ flex: 'none' }}>{res.player_name}</span>
                              {isGuillotine && (res.bet_amount || 0) > 0 && (
                                <span style={{ fontSize: '10px', color: '#fbbf24', fontWeight: '700' }}>
                                  ({(res.bet_amount || 0).toLocaleString()}원)
                                </span>
                              )}
                            </div>
                            <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                              {res.raw_score}타 ({isGuillotine ? `${is9Holes ? '9홀 ' : '18홀 '}` : ''}핸디 {res.adjusted_score}타)
                            </span>
                          </div>
                        </div>

                        {/* Cost, LP difference, and Resulting Tier/Points on right side (Fixed Columns - Never Shifts!) */}
                        <div className="history-lp-pills" style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                          {/* Dedicated Cost Column with fixed width to prevent shifting! */}
                          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', width: '54px', textAlign: 'right', whiteSpace: 'nowrap', flexShrink: 0 }}>
                            {res.cost_paid > 0 ? `${res.cost_paid.toLocaleString()}원` : '0원'}
                          </div>
                          
                          {/* Dedicated LP & Tier Column with guaranteed 112px width so '다이아몬드' never pushes cost! */}
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', width: '112px', minWidth: '112px', flexShrink: 0 }}>
                            <div
                              className={`history-lp-diff ${isZero ? 'zero' : isPlus ? 'plus' : 'minus'}`}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '2px',
                                justifyContent: 'flex-end',
                                color: isZero ? 'var(--text-muted)' : undefined, // Cool gray color if LP is frozen!
                                opacity: isZero ? 0.7 : 1,
                                fontSize: '12px',
                                fontWeight: '700'
                              }}
                            >
                              {!isZero && (isPlus ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />)}
                              {isZero ? '0 LP' : (isPlus ? `+${lpDiff}` : lpDiff) + ' LP'}
                            </div>

                            {/* Resulting Tier & Points After Game */}
                            {res.tier_after && (
                              <div style={{ fontSize: '10px', display: 'flex', alignItems: 'center', gap: '2px', marginTop: '1px', whiteSpace: 'nowrap' }}>
                                <span style={{ color: TIER_THEMES[res.tier_after]?.color || 'var(--text-muted)', fontWeight: '700' }}>
                                  {TIER_THEMES[res.tier_after]?.name || res.tier_after}
                                </span>
                                <span style={{ color: 'var(--text-muted)' }}>({res.points_after ?? 0}LP)</span>
                                {isPromo && (
                                  <span style={{ fontSize: '9px', color: '#10b981', fontWeight: '800', marginLeft: '2px' }}>
                                    ▲승급
                                  </span>
                                )}
                                {isDemo && (
                                  <span style={{ fontSize: '9px', color: '#f87171', fontWeight: '800', marginLeft: '2px' }}>
                                    ▼강등
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {/* Admin Only Footer Controls (Compact & Tightly Attached!) */}
                  {isAdmin && (
                    <div style={{
                      display: 'flex',
                      gap: '8px',
                      justifyContent: 'flex-end',
                      alignItems: 'center',
                      marginTop: '8px',
                      paddingTop: '8px',
                      borderTop: '1px solid var(--border-color)',
                    }}>
                      <button
                        type="button"
                        onClick={() => handleStartEdit({ game, results })}
                        style={{
                          background: 'none',
                          border: '1px solid rgba(59, 130, 246, 0.4)',
                          color: '#60a5fa',
                          fontSize: '11px',
                          padding: '3px 8px',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          transition: 'all 0.2s',
                          fontWeight: '600'
                        }}
                      >
                        <Edit2 size={11} />
                        <span>경기 수정</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteGame(game.id)}
                        disabled={deleting}
                        style={{
                          background: 'none',
                          border: '1px solid rgba(239, 68, 68, 0.4)',
                          color: '#f87171',
                          fontSize: '11px',
                          padding: '3px 8px',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          transition: 'all 0.2s',
                          fontWeight: '600'
                        }}
                      >
                        <Trash2 size={11} />
                        <span>{deleting ? '취소 중...' : '경기 취소'}</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
