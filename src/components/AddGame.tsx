import React, { useState, useEffect } from 'react';
import { Sparkles, Calendar, FileText, AlertTriangle, Trophy, Shuffle } from 'lucide-react';
import { type Player, type MatchMode, TIER_THEMES, TIER_WEIGHTS } from '../types';
import { tiergService, calculateNewTierAndPoints } from '../services/tiergService';

interface AddGameProps {
  onGameAdded: () => void;
}

export const AddGame: React.FC<AddGameProps> = ({ onGameAdded }) => {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);

  // Match info
  const [playedAt, setPlayedAt] = useState<string>(
    new Date().toISOString().substring(0, 16) // Default to local current time formatted for datetime-local
  );
  const [notes, setNotes] = useState<string>('');
  const [matchMode, setMatchMode] = useState<MatchMode>('handicap');

  // Random Room Allocation State
  const [roomCount, setRoomCount] = useState<number>(2);
  const [roomResults, setRoomResults] = useState<string[][]>([]);

  // Selected player IDs
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);

  // Scores and Costs inputs mapping playerId -> string
  const [rawScores, setRawScores] = useState<Record<string, string>>({});
  const [scoreSelections, setScoreSelections] = useState<Record<string, string>>({});
  const [guillotineHandicaps, setGuillotineHandicaps] = useState<Record<string, string>>({});
  const [costsPaid, setCostsPaid] = useState<Record<string, string>>({});

  const [saving, setSaving] = useState(false);

  // Helper to shuffle and randomly assign rooms
  const handleRandomAssign = () => {
    if (selectedPlayerIds.length < 2) {
      alert('방을 배정할 선수를 최소 2명 이상 터치하여 선택해 주세요!');
      return;
    }
    if (roomCount < 2 || roomCount > 4) {
      alert('방 개수는 2개에서 4개 사이로 선택해 주세요.');
      return;
    }

    // Shuffle currently selected player IDs
    const shuffled = [...selectedPlayerIds].sort(() => Math.random() - 0.5);

    // Initialize rooms arrays
    const allocated: string[][] = Array.from({ length: roomCount }, () => []);

    // Distribute players into rooms as evenly as possible
    shuffled.forEach((id, idx) => {
      allocated[idx % roomCount].push(id);
    });

    setRoomResults(allocated);
  };

  // Helper to dynamically calculate actual strokes from combo-box or direct inputs
  const getRawScoreForPlayer = (id: string): number => {
    const selection = scoreSelections[id] || '18'; // Default to +18 Over Par (90 strokes)
    if (selection === 'direct') {
      return parseInt(rawScores[id], 10) || 72;
    }
    return 72 + parseInt(selection, 10);
  };

  // Helper to retrieve handicap dynamically based on MatchMode
  const getHandicapForPlayer = (id: string, baseHandicap: number): number => {
    if (matchMode === 'guillotine') {
      const customHandicap = guillotineHandicaps[id];
      return customHandicap !== undefined ? (parseInt(customHandicap, 10) || 0) : baseHandicap;
    }
    return baseHandicap;
  };

  useEffect(() => {
    loadPlayers();
  }, []);

  const loadPlayers = async () => {
    setLoading(true);
    try {
      const fetchedPlayers = await tiergService.getPlayers();
      setPlayers(fetchedPlayers);
    } catch (error) {
      console.error('Failed to fetch players:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTogglePlayer = (id: string) => {
    const activePlayersCount = players.filter((p) => p.status !== 'Dormant').length;
    const player = players.find(p => p.id === id);
    if (!player) return;

    if (selectedPlayerIds.includes(id)) {
      setSelectedPlayerIds(selectedPlayerIds.filter((pId) => pId !== id));
      // Clean up score, handicap, and cost input
      const newScores = { ...rawScores };
      const newSelections = { ...scoreSelections };
      const newGuillotineHandicaps = { ...guillotineHandicaps };
      const newCosts = { ...costsPaid };
      delete newScores[id];
      delete newSelections[id];
      delete newGuillotineHandicaps[id];
      delete newCosts[id];
      setRawScores(newScores);
      setScoreSelections(newSelections);
      setGuillotineHandicaps(newGuillotineHandicaps);
      setCostsPaid(newCosts);
    } else {
      if (selectedPlayerIds.length >= activePlayersCount) {
        alert(`최대 ${activePlayersCount}명까지만 경기에 참여할 수 있습니다.`);
        return;
      }
      setSelectedPlayerIds([...selectedPlayerIds, id]);
      // Initialize inputs with reasonable defaults (Defaulting to +18 over par i.e. 90 strokes, base handicap, and 0 won/10,000 won bet cost!)
      setRawScores({ ...rawScores, [id]: '90' });
      setScoreSelections({ ...scoreSelections, [id]: '18' });
      setGuillotineHandicaps({ ...guillotineHandicaps, [id]: '0' });
      setCostsPaid({ ...costsPaid, [id]: matchMode === 'guillotine' ? '10000' : '0' });
    }
  };

  // Generate preview of results based on inputs
  const getResultsPreview = () => {
    if (selectedPlayerIds.length < 2) return [];

    // Map selections to calculations
    const items = selectedPlayerIds.map((id) => {
      const player = players.find((p) => p.id === id)!;
      const rawScore = getRawScoreForPlayer(id);
      const costPaid = parseInt(costsPaid[id], 10) || 0;
      
      // If 'scratch' mode, no handicap is subtracted in preview ranking!
      // Otherwise, fetch base or custom temporary handicap dynamically
      const adjustedScore = matchMode === 'scratch' 
        ? rawScore 
        : rawScore - getHandicapForPlayer(id, player.base_handicap);

      return {
        player,
        rawScore,
        costPaid,
        adjustedScore,
      };
    });

    // Sort by adjusted score ascending (lower is better in golf)
    items.sort((a, b) => a.adjustedScore - b.adjustedScore);

    // Apply ranks
    let rank = 1;
    const ranked = items.map((item, index) => {
      if (index > 0 && item.adjustedScore > items[index - 1].adjustedScore) {
        rank = index + 1;
      }
      return {
        ...item,
        rank,
      };
    });

    // Map standard LP points based on rank
    const lpChangeByRank: Record<number, number> = {
      1: 20,
      2: 10,
      3: -10,
      4: -20,
    };

    return ranked.map((item) => {
      let lpChange = 0;
      
      if (matchMode === 'scratch' || matchMode === 'guillotine') {
        // Scratch and Guillotine modes do not award LP (LP is frozen!)
        lpChange = 0;
      } else {
        // Standard LP calculation
        if (ranked.length === 4) {
          lpChange = lpChangeByRank[item.rank] || 0;
        } else {
          // Dynamic formulation for match size != 4
          const median = (ranked.length + 1) / 2;
          if (item.rank < median) {
            lpChange = item.rank === 1 ? 20 : 10;
          } else if (item.rank > median) {
            lpChange = item.rank === ranked.length ? -20 : -10;
          } else {
            lpChange = 0;
          }
        }
      }

      // Reconstruct final Tier and LP preview depending on MatchMode
      const { newTier, newPoints } = (matchMode === 'scratch' || matchMode === 'guillotine')
        ? { newTier: item.player.tier, newPoints: item.player.points }
        : calculateNewTierAndPoints(
            item.player.tier,
            item.player.points,
            lpChange
          );

      // Check if promoted or demoted
      const isPromo = newTier !== item.player.tier && lpChange > 0;
      const isDemo = newTier !== item.player.tier && lpChange < 0;

      return {
        ...item,
        lpChange,
        newTier,
        newPoints,
        isPromo,
        isDemo,
      };
    });
  };

  const handleSaveGame = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedPlayerIds.length < 2) {
      alert('최소 2명 이상의 참여 선수를 선택해주세요.');
      return;
    }

    // Validate scores are positive
    const resultsPayload = [];
    for (const id of selectedPlayerIds) {
      const raw = getRawScoreForPlayer(id);
      const cost = parseInt(costsPaid[id], 10);

      // Explicit validation for direct typing mode
      if (scoreSelections[id] === 'direct') {
        const directRaw = parseInt(rawScores[id], 10);
        if (isNaN(directRaw) || directRaw < 18 || directRaw > 180) {
          alert(`${players.find((p) => p.id === id)?.name} 선수의 타수 직접 입력값(18~180타)이 올바르지 않습니다.`);
          return;
        }
      }

      if (isNaN(cost) || cost < 0) {
        alert(`${players.find((p) => p.id === id)?.name} 선수의 비용 입력값이 올바르지 않습니다.`);
        return;
      }

      // Explicit validation and extract for custom guillotine handicap
      let customH: number | undefined = undefined;
      if (matchMode === 'guillotine') {
        const hVal = parseInt(guillotineHandicaps[id], 10);
        if (isNaN(hVal) || hVal < 0 || hVal > 72) {
          alert(`${players.find((p) => p.id === id)?.name} 선수의 단두대 임시 핸디캡(0~72개) 입력값이 올바르지 않습니다.`);
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

    setSaving(true);
    try {
      const dateStr = new Date(playedAt).toISOString();
      
      // Prefix notes dynamically depending on Selected MatchMode!
      let finalNotes = notes.trim();
      if (matchMode === 'scratch') {
        finalNotes = `[스크래치] ${finalNotes}`;
      } else if (matchMode === 'guillotine') {
        finalNotes = `[단두대] ${finalNotes}`;
      }

      await tiergService.addGame(finalNotes, dateStr, resultsPayload, matchMode);
      
      // Success resets
      setSelectedPlayerIds([]);
      setNotes('');
      setMatchMode('handicap'); // reset back to default
      setRoomResults([]); // clear room assignment roulette
      onGameAdded();
      alert('경기 전적 등록이 완료되었습니다! 실시간 랭킹에 즉시 반영되었습니다.');
    } catch (error) {
      console.error('Failed to save game results:', error);
      alert('게임 전적 저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>선수 명단을 가져오는 중...</div>;
  }

  const previewList = getResultsPreview();

  return (
    <div className="add-game-container">
      <div className="page-title">
        <Sparkles color="var(--accent)" /> 경기 결과 기록실
      </div>

      <form onSubmit={handleSaveGame} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        {/* Game Meta Setup Card */}
        <div className="game-setup-card">
          <div className="form-group" style={{ marginBottom: '14px' }}>
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Calendar size={15} color="var(--accent)" /> 경기 일시
            </label>
            <input
              type="datetime-local"
              className="form-input"
              value={playedAt}
              onChange={(e) => setPlayedAt(e.target.value)}
              required
            />
          </div>

          {/* New Match Mode Selector Dropdown */}
          <div className="form-group" style={{ marginBottom: '14px' }}>
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Trophy size={15} color="var(--accent)" /> 매치 모드 선택
            </label>
            <select
              className="form-input"
              value={matchMode}
              onChange={(e) => {
                setMatchMode(e.target.value as MatchMode);
                setRoomResults([]); // Clear previous room results when mode/players adjust
              }}
              style={{ backgroundColor: 'var(--bg-hover)' }}
            >
              <option value="handicap">핸디 적용 (기본 공식 리그 모드)</option>
              <option value="scratch">스크래치 (핸디 미적용, 전적/LP 동결 모드)</option>
              <option value="guillotine">단두대 (핸디 적용, 패자 100% 경기비 독박 모드)</option>
            </select>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', display: 'block', lineHeight: '1.4' }}>
              {matchMode === 'handicap' && '💡 현재 적용 중인 정석 리그 규칙입니다. 핸디캡 보정 후 순위에 따라 LP가 증감하여 티어 승강등이 반영됩니다.'}
              {matchMode === 'scratch' && '💡 핸디캡 보정 없이 원본 스코어로만 순위를 정하며, 경기 역사관 기록만 기록될 뿐 LP 및 티어 전적은 완전히 동결(0 LP)됩니다.'}
              {matchMode === 'guillotine' && '💥 초강력 내기 모드입니다! 핸디캡을 적용해 LP 점수를 부여하며, 게임에 기입된 전체 부담금 총합(총 게임/식사 비용)을 오직 꼴찌(들)에게만 100% 몰빵(뿜빠이) 정산시키고 승자들은 지출 경비를 0원으로 클라우드에 세팅합니다!'}
            </span>
          </div>

          <div className="form-group" style={{ marginBottom: '0' }}>
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <FileText size={15} color="var(--accent)" /> 경기 코스 및 메모
            </label>
            <input
              type="text"
              className="form-input"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="예: 골프존 아일랜드CC, 밥/간식 내기"
            />
          </div>
        </div>

        {/* Player Select Card */}
        <div className="player-select-card">
          {(() => {
            const activePlayers = players
              .filter((p) => p.status !== 'Dormant')
              .sort((a, b) => {
                const weightA = TIER_WEIGHTS[a.tier] + a.points;
                const weightB = TIER_WEIGHTS[b.tier] + b.points;
                if (weightB !== weightA) return weightB - weightA;
                return a.name.localeCompare(b.name, 'ko-KR');
              });
            return (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontWeight: '700', fontSize: '15px' }}>⛳ 참가 선수 선택 (2~{activePlayers.length}명)</span>
                  <span style={{ fontSize: '12px', color: selectedPlayerIds.length === 4 ? '#10b981' : 'var(--text-muted)' }}>
                    {selectedPlayerIds.length}명 선택함 {selectedPlayerIds.length === 4 ? '(4인 표준 경기)' : ''}
                  </span>
                </div>

                <div className="selection-grid">
                  {activePlayers.map((player) => {
                    const isSelected = selectedPlayerIds.includes(player.id);
                    const theme = TIER_THEMES[player.tier] || TIER_THEMES.Iron;

                    return (
                      <div
                        key={player.id}
                        className={`select-player-bubble ${isSelected ? 'selected' : ''}`}
                        onClick={() => handleTogglePlayer(player.id)}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <span style={{ fontWeight: '700', fontSize: '14px' }}>{player.name}</span>
                          <span style={{ fontSize: '11px', color: theme.color, fontWeight: '600' }}>
                            {theme.name} (H:{player.base_handicap})
                          </span>
                        </div>
                        <div className="select-player-badge" />
                      </div>
                    );
                  })}
                </div>
              </>
            );
          })()}
        </div>

        {/* Random Room Assigner Card (🎲 방 랜덤 배정 추첨기) */}
        {selectedPlayerIds.length >= 2 && (
          <div className="game-setup-card" style={{ borderColor: 'rgba(245, 158, 11, 0.25)', boxShadow: '0 0 15px rgba(245, 158, 11, 0.05)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <span style={{ fontWeight: '700', fontSize: '15px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Shuffle size={16} color="#fbbf24" /> 🎲 방 랜덤 배정 추첨기
              </span>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                선택된 {selectedPlayerIds.length}명 기준
              </span>
            </div>

            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ flex: 1 }}>
                <label className="form-label" style={{ fontSize: '11px', marginBottom: '4px' }}>나눌 방 개수 선택</label>
                <select
                  className="form-input"
                  value={roomCount}
                  onChange={(e) => {
                    setRoomCount(parseInt(e.target.value, 10));
                    setRoomResults([]); // Clear when count adjusts
                  }}
                  style={{ padding: '8px 12px', backgroundColor: 'var(--bg-hover)' }}
                >
                  <option value={2}>2개 방 배정</option>
                  <option value={3}>3개 방 배정</option>
                  <option value={4}>4개 방 배정</option>
                </select>
              </div>
              <button
                type="button"
                onClick={handleRandomAssign}
                className="submit-btn"
                style={{
                  width: 'auto',
                  marginTop: '15px',
                  padding: '10px 18px',
                  fontSize: '13px',
                  background: 'linear-gradient(135deg, #f59e0b, #b45309)',
                  boxShadow: '0 4px 12px rgba(245, 158, 11, 0.2)'
                }}
              >
                추첨 배정하기 🎲
              </button>
            </div>

            {/* Render assignments results */}
            {roomResults.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', backgroundColor: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid rgba(255,255,255,0.03)' }}>
                <h4 style={{ fontSize: '12px', fontWeight: '700', color: '#fbbf24', marginBottom: '4px' }}>✨ 랜덤 추첨 결과 조편성</h4>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                  {roomResults.map((room, roomIdx) => {
                    if (room.length === 0) return null;
                    return (
                      <div key={roomIdx} style={{ flex: '1 1 120px', backgroundColor: 'var(--bg-hover)', padding: '10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                        <div style={{ fontSize: '12px', fontWeight: '800', color: 'var(--accent)', marginBottom: '6px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '4px' }}>
                          🏢 {String.fromCharCode(65 + roomIdx)}번 룸 ({room.length}명)
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          {room.map((pId) => {
                            const pName = players.find(p => p.id === pId)?.name || 'Unknown';
                            return (
                              <span key={pId} style={{ fontSize: '13px', fontWeight: '600' }}>
                                🏌️‍♂️ {pName}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Input Scores List */}
        {selectedPlayerIds.length > 0 && (
          <div className="score-entry-list">
            <h3 style={{ fontSize: '15px', fontWeight: '700', margin: '10px 0 5px' }}>📊 선수별 경기 결과 입력</h3>
            {selectedPlayerIds.map((pId) => {
              const player = players.find((p) => p.id === pId)!;
              const theme = TIER_THEMES[player.tier] || TIER_THEMES.Iron;

              return (
                <div key={pId} className="score-entry-row" style={{ borderLeft: `4px solid ${theme.color}` }}>
                  <div className="score-player-header">
                    <span className="score-player-name">
                      {player.name}
                      <span style={{ fontSize: '11px', color: theme.color, fontWeight: '600' }}>
                        {theme.name} (현재 {player.points}LP)
                      </span>
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>핸디캡: -{player.base_handicap}개</span>
                  </div>

                  <div className="inputs-row" style={{ gridTemplateColumns: matchMode === 'guillotine' ? '1.2fr 1fr 0.8fr' : '1fr 1fr' }}>
                    <div className="form-group" style={{ marginBottom: '0' }}>
                      <label className="form-label" style={{ fontSize: '11px', marginBottom: '4px' }}>스코어 (언더/오버)</label>
                      <select
                        className="form-input"
                        value={scoreSelections[pId] || '18'}
                        onChange={(e) => {
                          const val = e.target.value;
                          setScoreSelections({ ...scoreSelections, [pId]: val });
                          if (val !== 'direct') {
                            setRawScores({ ...rawScores, [pId]: (72 + parseInt(val, 10)).toString() });
                          }
                        }}
                        style={{ backgroundColor: 'var(--bg-hover)' }}
                      >
                        {Array.from({ length: 51 }, (_, i) => -10 + i).map((v) => {
                          let label = '';
                          if (v < 0) label = `${v} (${72 + v}타)`;
                          else if (v === 0) label = `이븐 (${72 + v}타)`;
                          else label = `+${v} (${72 + v}타)`;
                          return <option key={v} value={v.toString()}>{label}</option>;
                        })}
                        <option value="direct">직접 입력 (타수 직접 타이핑)</option>
                      </select>
                    </div>

                    {/* Dynamic Bet/Cost input label */}
                    <div className="form-group" style={{ marginBottom: '0' }}>
                      <label className="form-label" style={{ fontSize: '11px', marginBottom: '4px' }}>
                        {matchMode === 'guillotine' ? '단두대 베팅금 (원)' : '본인 부담 비용 (원)'}
                      </label>
                      <input
                        type="number"
                        className="form-input"
                        value={costsPaid[pId] || '0'}
                        onChange={(e) => setCostsPaid({ ...costsPaid, [pId]: e.target.value })}
                        onFocus={() => {
                          if (costsPaid[pId] === '0' || costsPaid[pId] === undefined) {
                            setCostsPaid({ ...costsPaid, [pId]: '' });
                          }
                        }}
                        onBlur={() => {
                          if (costsPaid[pId] === '' || costsPaid[pId] === undefined) {
                            setCostsPaid({ ...costsPaid, [pId]: '0' });
                          }
                        }}
                        placeholder="예: 10000"
                        min="0"
                        required
                      />
                    </div>

                    {/* New Custom Handicap field (Only visible in Guillotine mode!) */}
                    {matchMode === 'guillotine' && (
                      <div className="form-group" style={{ marginBottom: '0' }}>
                        <label className="form-label" style={{ fontSize: '11px', marginBottom: '4px', color: '#fbbf24' }}>
                          단두대 핸디 (개)
                        </label>
                        <input
                          type="number"
                          className="form-input"
                          value={guillotineHandicaps[pId] || '0'}
                          onChange={(e) => setGuillotineHandicaps({ ...guillotineHandicaps, [pId]: e.target.value })}
                          onFocus={() => {
                            if (guillotineHandicaps[pId] === '0' || guillotineHandicaps[pId] === undefined) {
                              setGuillotineHandicaps({ ...guillotineHandicaps, [pId]: '' });
                            }
                          }}
                          onBlur={() => {
                            if (guillotineHandicaps[pId] === '' || guillotineHandicaps[pId] === undefined) {
                              setGuillotineHandicaps({ ...guillotineHandicaps, [pId]: '0' });
                            }
                          }}
                          placeholder="임시 핸디"
                          min="0"
                          max="72"
                          required
                        />
                      </div>
                    )}
                  </div>

                  {/* Direct Input Field - visible only when 'direct' is selected in dropdown */}
                  {scoreSelections[pId] === 'direct' && (
                    <div className="form-group" style={{ marginTop: '12px', marginBottom: '0' }}>
                      <label className="form-label" style={{ fontSize: '11px', marginBottom: '4px', color: 'var(--accent)' }}>타수 직접 입력 (타)</label>
                      <input
                        type="number"
                        className="form-input"
                        value={rawScores[pId] || ''}
                        onChange={(e) => setRawScores({ ...rawScores, [pId]: e.target.value })}
                        placeholder="실제 친 타수 입력 (예: 85)"
                        min="18"
                        max="180"
                        required
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Results Live Calculations Preview */}
        {previewList.length >= 2 && (
          <div className="preview-card">
            <div className="preview-badge-ribbon">실시간 승강등 연산 결과</div>
            <h4 style={{ fontSize: '14px', fontWeight: '800', marginBottom: '10px', color: 'var(--accent)' }}>
              ⚡ 경기 예상 시뮬레이션
            </h4>

            {previewList.map((item) => {
              const currentTheme = TIER_THEMES[item.player.tier] || TIER_THEMES.Iron;
              const nextTheme = TIER_THEMES[item.newTier] || TIER_THEMES.Iron;
              const isPlus = item.lpChange >= 0;

              return (
                <div key={item.player.id} className="preview-row">
                  <div className="preview-rank">
                    {item.rank}등
                  </div>
                  
                  <div className="preview-name">
                    <span>{item.player.name}</span>
                    {item.isPromo && (
                      <span className="promo-alert" style={{ fontSize: '10px' }}>
                        🌟 승급 확정!
                      </span>
                    )}
                    {item.isDemo && (
                      <span className="demo-alert" style={{ fontSize: '10px' }}>
                        ⚠️ 강등 경고
                      </span>
                    )}
                  </div>

                  <div className="preview-scores">
                    <div className="preview-raw">{item.rawScore}타</div>
                    <div className="preview-adj">핸디 {item.adjustedScore}타</div>
                  </div>

                  <div className="preview-lp-pills-row">
                    <div className={`preview-lp-change ${isPlus ? 'plus' : 'minus'}`}>
                      {isPlus ? `+${item.lpChange}` : item.lpChange} LP
                    </div>
                    <div className="preview-tier-evolve">
                      <span style={{ color: currentTheme.color }}>{currentTheme.name}</span>
                      <span>➡️</span>
                      <span style={{ color: nextTheme.color, fontWeight: '800' }}>{nextTheme.name} ({item.newPoints}LP)</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Submit Button */}
        {selectedPlayerIds.length >= 2 ? (
          <button type="submit" className="submit-btn" disabled={saving} style={{ marginTop: '10px' }}>
            {saving ? '경기 기록 전송 및 데이터 동기화 중...' : '🏆 경기 결과 최종 확정 (순위 & 티어 저장)'}
          </button>
        ) : (
          <div style={{
            padding: '12px',
            backgroundColor: 'rgba(239, 68, 68, 0.05)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            borderRadius: 'var(--radius-md)',
            color: '#f87171',
            fontSize: '13px',
            textAlign: 'center',
            marginTop: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px'
          }}>
            <AlertTriangle size={14} /> 경기를 확정하려면 최소 2명 이상의 골퍼를 선택해야 합니다.
          </div>
        )}
      </form>
    </div>
  );
};
