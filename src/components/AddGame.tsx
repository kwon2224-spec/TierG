import React, { useState, useEffect } from 'react';
import { Sparkles, Calendar, FileText, AlertTriangle } from 'lucide-react';
import { type Player, TIER_THEMES } from '../types';
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

  // Selected player IDs
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);

  // Scores and Costs inputs mapping playerId -> string
  const [rawScores, setRawScores] = useState<Record<string, string>>({});
  const [costsPaid, setCostsPaid] = useState<Record<string, string>>({});

  const [saving, setSaving] = useState(false);

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
    if (selectedPlayerIds.includes(id)) {
      setSelectedPlayerIds(selectedPlayerIds.filter((pId) => pId !== id));
      // Clean up score and cost input
      const newScores = { ...rawScores };
      const newCosts = { ...costsPaid };
      delete newScores[id];
      delete newCosts[id];
      setRawScores(newScores);
      setCostsPaid(newCosts);
    } else {
      if (selectedPlayerIds.length >= players.length) {
        alert(`최대 ${players.length}명까지만 경기에 참여할 수 있습니다.`);
        return;
      }
      setSelectedPlayerIds([...selectedPlayerIds, id]);
      // Initialize inputs with reasonable defaults
      setRawScores({ ...rawScores, [id]: '85' });
      setCostsPaid({ ...costsPaid, [id]: '35000' });
    }
  };

  // Generate preview of results based on inputs
  const getResultsPreview = () => {
    if (selectedPlayerIds.length < 2) return [];

    // Map selections to calculations
    const items = selectedPlayerIds.map((id) => {
      const player = players.find((p) => p.id === id)!;
      const rawScore = parseInt(rawScores[id], 10) || 120;
      const costPaid = parseInt(costsPaid[id], 10) || 0;
      const adjustedScore = rawScore - player.base_handicap;

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

      const { newTier, newPoints } = calculateNewTierAndPoints(
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
      const raw = parseInt(rawScores[id], 10);
      const cost = parseInt(costsPaid[id], 10);

      if (isNaN(raw) || raw < 18 || raw > 180) {
        alert(`${players.find((p) => p.id === id)?.name} 선수의 타수(18~180타)가 올바르지 않습니다.`);
        return;
      }
      if (isNaN(cost) || cost < 0) {
        alert(`${players.find((p) => p.id === id)?.name} 선수의 비용 입력값이 올바르지 않습니다.`);
        return;
      }

      resultsPayload.push({
        player_id: id,
        raw_score: raw,
        cost_paid: cost,
      });
    }

    setSaving(true);
    try {
      const dateStr = new Date(playedAt).toISOString();
      await tiergService.addGame(notes.trim(), dateStr, resultsPayload);
      
      // Success resets
      setSelectedPlayerIds([]);
      setNotes('');
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontWeight: '700', fontSize: '15px' }}>⛳ 참가 선수 선택 (2~{players.length}명)</span>
            <span style={{ fontSize: '12px', color: selectedPlayerIds.length === 4 ? '#10b981' : 'var(--text-muted)' }}>
              {selectedPlayerIds.length}명 선택함 {selectedPlayerIds.length === 4 ? '(4인 표준 경기)' : ''}
            </span>
          </div>

          <div className="selection-grid">
            {players.map((player) => {
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
        </div>

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

                  <div className="inputs-row">
                    <div className="form-group" style={{ marginBottom: '0' }}>
                      <label className="form-label" style={{ fontSize: '11px', marginBottom: '4px' }}>원본 타수 스코어</label>
                      <input
                        type="number"
                        className="form-input"
                        value={rawScores[pId] || ''}
                        onChange={(e) => setRawScores({ ...rawScores, [pId]: e.target.value })}
                        placeholder="예: 85"
                        min="18"
                        max="180"
                        required
                      />
                    </div>

                    <div className="form-group" style={{ marginBottom: '0' }}>
                      <label className="form-label" style={{ fontSize: '11px', marginBottom: '4px' }}>본인 부담 비용 (원)</label>
                      <input
                        type="number"
                        className="form-input"
                        value={costsPaid[pId] || ''}
                        onChange={(e) => setCostsPaid({ ...costsPaid, [pId]: e.target.value })}
                        placeholder="예: 35000"
                        min="0"
                        required
                      />
                    </div>
                  </div>
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
                    <div className="preview-adj">넷 {item.adjustedScore}타 (-{item.player.base_handicap})</div>
                  </div>

                  <div className="preview-lp-pills-row" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
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
