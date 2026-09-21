import React, { useState, useEffect } from 'react';
import { X, Calendar, FileText, Trophy, Sparkles } from 'lucide-react';
import { type Player, type MatchMode, TIER_THEMES } from '../types';
import { tiergService } from '../services/tiergService';

interface EditGameModalProps {
  gameId: string;
  onClose: () => void;
  onGameUpdated: () => void;
}

export const EditGameModal: React.FC<EditGameModalProps> = ({
  gameId,
  onClose,
  onGameUpdated,
}) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form States
  const [playedAt, setPlayedAt] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [matchMode, setMatchMode] = useState<MatchMode>('handicap');

  // Players list and raw inputs mapping: playerId -> value string
  const [gamePlayers, setGamePlayers] = useState<Player[]>([]);
  const [rawScores, setRawScores] = useState<Record<string, string>>({});
  const [scoreSelections, setScoreSelections] = useState<Record<string, string>>({});
  const [guillotineHandicaps, setGuillotineHandicaps] = useState<Record<string, string>>({});
  const [costsPaid, setCostsPaid] = useState<Record<string, string>>({});

  useEffect(() => {
    loadGameDetails();
  }, [gameId]);

  const loadGameDetails = async () => {
    setLoading(true);
    try {
      // 1. Fetch current players
      const fetchedPlayers = await tiergService.getPlayers();

      // 2. Fetch specific game details by searching through history list
      const games = await tiergService.getGames();
      const targetGame = games.find((g) => g.game.id === gameId);
      if (!targetGame) {
        alert('수정할 경기를 찾을 수 없습니다.');
        onClose();
        return;
      }

      // 3. Initialize metadata
      // Strip [스크래치] or [단두대] prefixes from notes input box for clean editing
      let cleanNotes = targetGame.game.notes || '';
      if (cleanNotes.startsWith('[스크래치] ')) {
        cleanNotes = cleanNotes.substring(7);
      } else if (cleanNotes.startsWith('[단두대] ')) {
        cleanNotes = cleanNotes.substring(6);
      }

      setNotes(cleanNotes);
      setPlayedAt(targetGame.game.played_at.substring(0, 16));

      // 4. Identify match mode from game_results
      // If pts changed is 0 but it's not scratch/guillotine... wait, we can detect it from game notes or game mode!
      let mode: MatchMode = 'handicap';
      if (targetGame.game.notes?.startsWith('[스크래치]')) {
        mode = 'scratch';
      } else if (targetGame.game.notes?.startsWith('[단두대]')) {
        mode = 'guillotine';
      }
      setMatchMode(mode);

      // 5. Build inputs mappings for current participants
      const activeGamePlayers: Player[] = [];
      const scoresMap: Record<string, string> = {};
      const selectionsMap: Record<string, string> = {};
      const handicapsMap: Record<string, string> = {};
      const costsMap: Record<string, string> = {};

      for (const res of targetGame.results) {
        const p = fetchedPlayers.find((player) => player.id === res.player_id);
        if (p) {
          activeGamePlayers.push(p);
          
          // Re-evaluate combo selection
          const relativeStrokes = res.raw_score - 72;
          if (relativeStrokes >= -10 && relativeStrokes <= 40) {
            selectionsMap[p.id] = relativeStrokes.toString();
          } else {
            selectionsMap[p.id] = 'direct';
          }

          scoresMap[p.id] = res.raw_score.toString();
          
          // If guillotine mode, reconstruct their temporary handicap and original bet amount!
          handicapsMap[p.id] = (res.bet_amount !== undefined ? (res.raw_score - res.adjusted_score) : p.base_handicap).toString();
          costsMap[p.id] = (res.bet_amount !== undefined ? res.bet_amount : res.cost_paid).toString();
        }
      }

      setGamePlayers(activeGamePlayers);
      setRawScores(scoresMap);
      setScoreSelections(selectionsMap);
      setGuillotineHandicaps(handicapsMap);
      setCostsPaid(costsMap);

    } catch (error) {
      console.error('Failed to load edit game details:', error);
      alert('경기 상세 정보를 가져오는 데 실패했습니다.');
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const getRawScoreForPlayer = (id: string): number => {
    const selection = scoreSelections[id] || '18';
    if (selection === 'direct') {
      return parseInt(rawScores[id], 10) || 72;
    }
    return 72 + parseInt(selection, 10);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (gamePlayers.length < 2) return;

    // Validate inputs
    const resultsPayload = [];
    for (const player of gamePlayers) {
      const id = player.id;
      const raw = getRawScoreForPlayer(id);
      const cost = parseInt(costsPaid[id], 10) || 0;

      if (scoreSelections[id] === 'direct') {
        const directRaw = parseInt(rawScores[id], 10);
        if (isNaN(directRaw) || directRaw < 18 || directRaw > 180) {
          alert(`${player.name} 선수의 타수 직접 입력값(18~180타)이 올바르지 않습니다.`);
          return;
        }
      }

      if (cost < 0) {
        alert(`${player.name} 선수의 비용은 0원 이상이어야 합니다.`);
        return;
      }

      let customH: number | undefined = undefined;
      if (matchMode === 'guillotine') {
        const hVal = parseInt(guillotineHandicaps[id], 10) || 0;
        if (hVal < 0 || hVal > 72) {
          alert(`${player.name} 선수의 단두대 임시 핸디캡(0~72개)이 올바르지 않습니다.`);
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
      await tiergService.updateGame(gameId, notes.trim(), dateStr, resultsPayload, matchMode);
      alert('경기 기록이 성공적으로 수정되었습니다! 랭킹과 누적 전적에 실시간 재반영되었습니다.');
      onGameUpdated();
      onClose();
    } catch (error) {
      console.error('Failed to update game:', error);
      alert('경기 정보 수정 저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="modal-backdrop">
        <div className="modal-content" style={{ textAlign: 'center', padding: '40px' }}>
          <div className="form-label" style={{ color: 'var(--text-secondary)' }}>경기 수정 정보 불러오는 중...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-backdrop" style={{ zIndex: 1100 }}>
      <div className="modal-content" style={{ maxWidth: '480px', maxHeight: '90vh', overflowY: 'auto' }}>
        
        {/* Modal Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
          <span style={{ fontWeight: '800', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent)' }}>
            <Sparkles size={18} /> 경기 결과 수정 정합성 보드
          </span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleUpdate} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          
          {/* Game Meta Section */}
          <div className="game-setup-card" style={{ padding: '12px', marginBottom: '0' }}>
            <div className="form-group" style={{ marginBottom: '12px' }}>
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
                <Calendar size={14} color="var(--accent)" /> 경기 일시
              </label>
              <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
                <input
                  type="datetime-local"
                  className="form-input"
                  style={{ flex: 1 }}
                  value={playedAt}
                  onChange={(e) => setPlayedAt(e.target.value)}
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
                    setPlayedAt(localISOTime);
                  }}
                  className="submit-btn"
                  style={{
                    width: 'auto',
                    whiteSpace: 'nowrap',
                    padding: '11px 14px',
                    fontSize: '12px',
                    backgroundColor: 'var(--bg-hover)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-secondary)'
                  }}
                >
                  🕒 지금
                </button>
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: '12px' }}>
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
                <Trophy size={14} color="var(--accent)" /> 매치 모드 선택
              </label>
              <select
                className="form-input"
                value={matchMode}
                onChange={(e) => setMatchMode(e.target.value as MatchMode)}
                style={{ backgroundColor: 'var(--bg-hover)' }}
              >
                <option value="handicap">핸디 적용 (공식 리그전)</option>
                <option value="scratch">스크래치 (전적 동결)</option>
                <option value="guillotine">단두대 (패자 독박)</option>
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: '0' }}>
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
                <FileText size={14} color="var(--accent)" /> 경기 코스 및 메모
              </label>
              <input
                type="text"
                className="form-input"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="예: 아일랜드CC"
              />
            </div>
          </div>

          {/* Participant Scores Editor */}
          <div className="score-entry-list" style={{ marginTop: '0' }}>
            <h4 style={{ fontSize: '13px', fontWeight: '800', marginBottom: '8px', color: '#fbbf24' }}>⛳ 출전 선수별 정보 개별 수정</h4>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {gamePlayers.map((player) => {
                const theme = TIER_THEMES[player.tier] || TIER_THEMES.Iron;
                const pId = player.id;

                return (
                  <div key={pId} className="score-entry-row" style={{ borderLeft: `4px solid ${theme.color}`, padding: '10px', backgroundColor: 'rgba(255,255,255,0.01)' }}>
                    <div className="score-player-header" style={{ marginBottom: '8px' }}>
                      <span className="score-player-name" style={{ fontSize: '13px' }}>
                        {player.name}
                        <span style={{ fontSize: '10px', color: theme.color, marginLeft: '4px' }}>
                          {theme.name}
                        </span>
                      </span>
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>기본핸디: -{player.base_handicap}개</span>
                    </div>

                    <div className="inputs-row" style={{ gridTemplateColumns: matchMode === 'guillotine' ? '1.2fr 1fr 0.8fr' : '1fr 1fr', gap: '8px' }}>
                      <div className="form-group" style={{ marginBottom: '0' }}>
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
                          style={{ backgroundColor: 'var(--bg-hover)', fontSize: '13px', padding: '10px' }}
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
                      </div>

                      <div className="form-group" style={{ marginBottom: '0' }}>
                        <input
                          type="number"
                          className="form-input"
                          value={costsPaid[pId] ?? ''}
                          onChange={(e) => setCostsPaid({ ...costsPaid, [pId]: e.target.value })}
                          placeholder="0"
                          min="0"
                          style={{ fontSize: '13px', padding: '10px' }}
                        />
                      </div>

                      {matchMode === 'guillotine' && (
                        <div className="form-group" style={{ marginBottom: '0' }}>
                          <input
                            type="number"
                            className="form-input"
                            value={guillotineHandicaps[pId] ?? ''}
                            onChange={(e) => setGuillotineHandicaps({ ...guillotineHandicaps, [pId]: e.target.value })}
                            placeholder="0"
                            min="0"
                            max="72"
                            style={{ fontSize: '13px', padding: '10px' }}
                          />
                        </div>
                      )}
                    </div>

                    {scoreSelections[pId] === 'direct' && (
                      <div className="form-group" style={{ marginTop: '8px', marginBottom: '0' }}>
                        <input
                          type="number"
                          className="form-input"
                          value={rawScores[pId] || ''}
                          onChange={(e) => setRawScores({ ...rawScores, [pId]: e.target.value })}
                          placeholder="타수 입력 (예: 85)"
                          min="18"
                          max="180"
                          required
                          style={{ fontSize: '13px', padding: '10px' }}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
            <button
              type="button"
              onClick={onClose}
              className="submit-btn"
              style={{
                flex: 1,
                backgroundColor: 'var(--bg-hover)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-secondary)'
              }}
            >
              취소
            </button>
            <button
              type="submit"
              className="submit-btn"
              disabled={saving}
              style={{ flex: 2, background: 'linear-gradient(135deg, #10b981, #047857)' }}
            >
              {saving ? '수정 내용 저장 중...' : '💾 수정 완료'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
