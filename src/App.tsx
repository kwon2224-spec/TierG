import { useState } from 'react';
import { Trophy, PlusCircle, History, Sparkles, Database, DatabaseZap } from 'lucide-react';
import { Leaderboard } from './components/Leaderboard';
import { AddGame } from './components/AddGame';
import { GameHistory } from './components/GameHistory';
import { PlayerProfile } from './components/PlayerProfile';
import { tiergService } from './services/tiergService';
import './App.css';

type Tab = 'leaderboard' | 'add-game' | 'history';

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('leaderboard');
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  
  // A simple counter to trigger data re-fetching in child components
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleRefresh = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  const handleResetDemoData = () => {
    if (window.confirm('로컬 데모 데이터를 처음 기본 명단(10명) 상태로 초기화하시겠습니까? 기록된 임시 전적은 모두 삭제됩니다.')) {
      tiergService.resetDatabase();
      handleRefresh();
      alert('데이터가 성공적으로 초기화되었습니다.');
    }
  };

  const isSupabase = tiergService.isSupabaseMode();

  return (
    <div className="app-container">
      {/* App Header */}
      <header className="app-header">
        <div className="logo-container">
          <div className="logo">
            <Sparkles size={24} style={{ fill: '#10b981', stroke: '#10b981' }} />
            <span>Tier Golf</span>
            <span className="logo-sub">TierG</span>
          </div>

          {/* Database Mode Connection Badge */}
          {isSupabase ? (
            <div className="mode-badge supabase">
              <DatabaseZap size={12} /> Live Cloud DB
            </div>
          ) : (
            <div className="mode-badge demo">
              <Database size={12} /> Local Demo
            </div>
          )}
        </div>

        {/* Navigation Tabs */}
        <nav className="app-nav">
          <button
            className={`nav-btn ${activeTab === 'leaderboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('leaderboard')}
          >
            <Trophy size={18} />
            <span>티어 랭킹</span>
          </button>
          <button
            className={`nav-btn ${activeTab === 'add-game' ? 'active' : ''}`}
            onClick={() => setActiveTab('add-game')}
          >
            <PlusCircle size={18} />
            <span>경기 입력</span>
          </button>
          <button
            className={`nav-btn ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => setActiveTab('history')}
          >
            <History size={18} />
            <span>경기 히스토리</span>
          </button>
        </nav>
      </header>

      {/* Main Content Area */}
      <main className="app-content">
        {activeTab === 'leaderboard' && (
          <div>
            <Leaderboard
              onSelectPlayer={(id) => setSelectedPlayerId(id)}
              refreshTrigger={refreshTrigger}
            />

            {/* Reset Database Button (Only visible in Demo Mode for admins/users testing) */}
            {!isSupabase && (
              <div className="admin-actions">
                <button className="reset-db-btn" onClick={handleResetDemoData}>
                  🔄 데모 데이터 공장 초기화
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'add-game' && (
          <AddGame
            onGameAdded={() => {
              setActiveTab('leaderboard'); // Direct user back to rankings on success
              handleRefresh();
            }}
          />
        )}

        {activeTab === 'history' && (
          <GameHistory
            refreshTrigger={refreshTrigger}
            onGameDeleted={handleRefresh}
          />
        )}
      </main>

      {/* Floating Detailed Player Profile Modal */}
      {selectedPlayerId && (
        <PlayerProfile
          playerId={selectedPlayerId}
          onClose={() => setSelectedPlayerId(null)}
          onHandicapUpdated={handleRefresh}
        />
      )}
    </div>
  );
}

export default App;
