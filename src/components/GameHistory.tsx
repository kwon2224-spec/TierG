import React, { useState, useEffect } from 'react';
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
    const isGuillotine = results.some((r) => (r.bet_amount || 0) > 0);
    const isScratch = game.notes?.includes('[스크래치]');
    const modeName = isGuillotine ? '단두대' : isScratch ? '스크래치' : '핸디캡';

    const formattedDate = new Date(game.played_at).toLocaleString('ko-KR', {
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    let shareText = `⛳ [TierGolf] 경기 결과 보고\n`;
    shareText += `일시: ${formattedDate}\n`;
    shareText += `모드: ${modeName}\n`;
    
    let notesText = game.notes || '';
    if (notesText.startsWith('[스크래치] ')) notesText = notesText.substring(7);
    else if (notesText.startsWith('[단두대] ')) notesText = notesText.substring(6);
    if (notesText) {
      shareText += `코스: ${notesText}\n`;
    }
    shareText += `\n■ 경기 결과 현황\n`;

    const sortedResults = [...results].sort((a, b) => a.rank - b.rank);
    sortedResults.forEach((res) => {
      const isWin = isGuillotine && res.cost_paid === 0;
      const rankLabel = isGuillotine ? (isWin ? '승' : '패') : `${res.rank}등`;
      
      const lpSign = res.points_changed > 0 ? `+${res.points_changed}` : `${res.points_changed}`;
      const lpDisplay = (isScratch || isGuillotine) ? `0 LP` : `${lpSign} LP`;

      const costDisplay = res.cost_paid > 0 ? ` [${res.cost_paid.toLocaleString()}원 지출]` : '';

      shareText += `${rankLabel}. ${res.player_name}: ${res.raw_score}타 (${lpDisplay})${costDisplay}\n`;
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

    // Strip [스크래치] or [단두대] prefixes from notes input box for clean inline editing
    let cleanNotes = gameWithRes.game.notes || '';
    if (cleanNotes.startsWith('[스크래치] ')) {
      cleanNotes = cleanNotes.substring(7);
    } else if (cleanNotes.startsWith('[단두대] ')) {
      cleanNotes = cleanNotes.substring(6);
    }

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
      const relativeStrokes = res.raw_score - 72;
      if (relativeStrokes >= -10 && relativeStrokes <= 40) {
        selectionsMap[res.player_id] = relativeStrokes.toString();
      } else {
        selectionsMap[res.player_id] = 'direct';
      }

      scoresMap[res.player_id] = res.raw_score.toString();
      
      // Calculate handicap used on that day (raw - adjusted)
      const handicapUsed = res.raw_score - res.adjusted_score;
      handicapsMap[res.player_id] = handicapUsed.toString();

      // Original Bet amount (use bet_amount fallback, if not cost_paid)
      costsMap[res.player_id] = (res.bet_amount !== undefined ? res.bet_amount : res.cost_paid).toString();
    });

    setEditRawScores(scoresMap);
    setEditScoreSelections(selectionsMap);
    setEditGuillotineHandicaps(handicapsMap);
    setEditCostsPaid(costsMap);
  };

  const getRawScoreForPlayer = (id: string): number => {
    const selection = editScoreSelections[id] || '18';
    if (selection === 'direct') {
      return parseInt(editRawScores[id], 10) || 72;
    }
    return 72 + parseInt(selection, 10);
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

        let customH: number | undefined = undefined;
        if (editMatchMode === 'guillotine') {
          const hVal = parseInt(editGuillotineHandicaps[id], 10) || 0;
          if (hVal < 0 || hVal > 72) {
            alert(`${res.player_name} 선수의 단두대 임시 핸디캡(0~72개)이 올바르지 않습니다.`);
            setSaving(false);
            return;
          }
          customH = hVal;
        }

        resultsPayload.push({
          player_id: id,
          raw_score: raw,
          cost_paid: cost,
          custom_handicap: customH,
        });
      }

      const dateStr = new Date(editPlayedAt).toISOString();
      await tiergService.updateGame(gameId, editNotes.trim(), dateStr, resultsPayload, editMatchMode);
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

  const filteredGames = games.filter((g) => {
    if (selectedFilter === 'all') return true;
    return getGameMode(g) === selectedFilter;
  });

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
        <History color="var(--accent)" /> 경기 히스토리
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
          const isGuillotine = results.some((r) => (r.bet_amount || 0) > 0);
          const isScratch = game.notes?.startsWith('[스크래치]');
          const modeName = isGuillotine ? '단두대' : isScratch ? '스크래치' : '핸디';
          const modeColor = isGuillotine ? '#fbbf24' : isScratch ? '#60a5fa' : '#10b981';
          const modeBg = isGuillotine ? 'rgba(245,158,11,0.06)' : isScratch ? 'rgba(96,165,250,0.06)' : 'rgba(16,185,129,0.06)';

          return (
            <div key={game.id} className="game-history-card" style={{ border: isCurrentlyEditing ? '1px solid var(--accent)' : '1px solid var(--border-color)' }}>
              
              {/* Game Card Header */}
              <div className="game-history-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <div className="game-date" style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                    <Calendar size={13} color="var(--accent)" />
                    <span>
                      {new Date(game.played_at).toLocaleString('ko-KR', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    <span style={{ fontSize: '9px', color: modeColor, backgroundColor: modeBg, padding: '2px 6px', borderRadius: '3px', fontWeight: 'bold', marginLeft: '6px' }}>
                      {modeName}
                    </span>
                  </div>
                  {game.notes && <div className="game-notes" style={{ marginTop: '2px' }}>{game.notes}</div>}
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    총 경비: <strong style={{ color: '#34d399', fontSize: '12px' }}>{totalGameCost.toLocaleString()}원</strong>
                  </div>
                  
                  {!isCurrentlyEditing && (
                    <div style={{ display: 'flex', gap: '6px', marginTop: '2px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
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
                              value={editScoreSelections[pId] || '18'}
                              onChange={(e) => {
                                const val = e.target.value;
                                setEditScoreSelections({ ...editScoreSelections, [pId]: val });
                                if (val !== 'direct') {
                                  setEditRawScores({ ...editRawScores, [pId]: (72 + parseInt(val, 10)).toString() });
                                }
                              }}
                              style={{ backgroundColor: 'var(--bg-hover)', fontSize: '12px', padding: '6px' }}
                            >
                              {Array.from({ length: 51 }, (_, i) => -10 + i).map((v) => {
                                let label = '';
                                if (v < 0) label = `${v} (${72 + v}타)`;
                                else if (v === 0) label = `이븐 (${72 + v}타)`;
                                else label = `+${v} (${72 + v}타)`;
                                return <option key={v} value={v.toString()}>{label}</option>;
                              })}
                              <option value="direct">직접 입력</option>
                            </select>

                            <input
                              type="number"
                              className="form-input"
                              value={editCostsPaid[pId] ?? ''}
                              onChange={(e) => setEditCostsPaid({ ...editCostsPaid, [pId]: e.target.value })}
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
                              placeholder="타수 입력 (예: 85)"
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

                  {/* Inline Form Control Footer Buttons */}
                  <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                    <button
                      type="button"
                      onClick={() => setEditingGameId(null)}
                      className="submit-btn"
                      style={{
                        flex: 1,
                        padding: '8px 12px',
                        fontSize: '12px',
                        background: 'none', // Elegant semi-transparent glass ghost button style
                        border: '1px solid rgba(255, 255, 255, 0.1)',
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
                        flex: 2,
                        padding: '8px 12px',
                        fontSize: '12px',
                        background: 'linear-gradient(135deg, #10b981, #047857)'
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
                          
                          {/* Player Name and Cost */}
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span className="history-name">{res.player_name}</span>
                            <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                              실제 {res.raw_score}타 (핸디 적용 {res.adjusted_score}타)
                            </span>
                          </div>
                        </div>

                        {/* Cost, LP difference, and Resulting Tier/Points on right side */}
                        <div className="history-lp-pills" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', textAlign: 'right' }}>
                            {res.cost_paid > 0 ? `${res.cost_paid.toLocaleString()}원` : '0원'}
                          </div>
                          
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', minWidth: '75px' }}>
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
                              <div style={{ fontSize: '10px', display: 'flex', alignItems: 'center', gap: '2px', marginTop: '1px' }}>
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

                  {/* Admin Only Footer Action Row (Moved from header to prevent mobile timezone text wrapping!) */}
                  {isAdmin && (
                    <div style={{
                      display: 'flex',
                      gap: '8px',
                      justifyContent: 'flex-end',
                      marginTop: '12px',
                      paddingTop: '10px',
                      borderTop: '1px dashed rgba(255,255,255,0.04)'
                    }}>
                      <button
                        type="button"
                        onClick={() => handleStartEdit({ game, results })}
                        style={{
                          background: 'none',
                          border: '1px solid rgba(59, 130, 246, 0.4)',
                          color: '#60a5fa',
                          fontSize: '11px',
                          padding: '4px 10px',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          transition: 'all 0.2s',
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
                          padding: '4px 10px',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          transition: 'all 0.2s',
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
