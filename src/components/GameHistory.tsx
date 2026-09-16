import React, { useState, useEffect } from 'react';
import { History, Calendar, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { type GameWithResults } from '../types';
import { tiergService } from '../services/tiergService';

interface GameHistoryProps {
  refreshTrigger: number;
}

export const GameHistory: React.FC<GameHistoryProps> = ({ refreshTrigger }) => {
  const [games, setGames] = useState<GameWithResults[]>([]);
  const [loading, setLoading] = useState(true);

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
        <History color="var(--accent)" /> 경기 히스토리 아카이브
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {games.map(({ game, results }) => {
          // Calculate total expense of this specific game
          const totalGameCost = results.reduce((sum, r) => sum + r.cost_paid, 0);

          return (
            <div key={game.id} className="game-history-card">
              
              {/* Game Card Header */}
              <div className="game-history-header">
                <div>
                  <div className="game-date" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Calendar size={13} color="var(--accent)" />
                    {new Date(game.played_at).toLocaleString('ko-KR', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                  {game.notes && <div className="game-notes" style={{ marginTop: '2px' }}>📍 {game.notes}</div>}
                </div>
                <div style={{ textAlign: 'right', fontSize: '11px', color: 'var(--text-muted)' }}>
                  총 경비: <strong style={{ color: '#34d399', fontSize: '12px' }}>{totalGameCost.toLocaleString()}원</strong>
                </div>
              </div>

              {/* Game Card Placements List */}
              <div className="game-history-results">
                {results.map((res) => {
                  const isPlus = res.points_changed >= 0;

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
                        {/* Placement Index */}
                        <span
                          className="history-rank"
                          style={{
                            color: res.rank === 1 ? '#ffd700' : res.rank === 2 ? '#cbd5e1' : 'var(--text-muted)',
                            fontStyle: 'italic',
                          }}
                        >
                          {res.rank}등
                        </span>
                        
                        {/* Player Name and Cost */}
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span className="history-name">{res.player_name}</span>
                          <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                            실제 {res.raw_score}타 (넷 {res.adjusted_score}타)
                          </span>
                        </div>
                      </div>

                      {/* Cost and LP difference on right side */}
                      <div className="history-lp-pills" style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginRight: '5px' }}>
                          {res.cost_paid > 0 ? `${res.cost_paid.toLocaleString()}원` : '0원'}
                        </div>
                        <div
                          className={`history-lp-diff ${isPlus ? 'plus' : 'minus'}`}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '2px',
                            minWidth: '60px',
                            justifyContent: 'flex-end',
                          }}
                        >
                          {isPlus ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                          {isPlus ? `+${res.points_changed}` : res.points_changed} LP
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
