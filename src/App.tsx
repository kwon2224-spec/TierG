import React, { useState, useEffect } from 'react';
import { Trophy, PlusCircle, History, Database, DatabaseZap, Lock, LockOpen, Check } from 'lucide-react';
import { Leaderboard } from './components/Leaderboard';
import { AddGame } from './components/AddGame';
import { GameHistory } from './components/GameHistory';
import { PlayerProfile } from './components/PlayerProfile';
import { tiergService } from './services/tiergService';
import { type Player } from './types';
import './App.css';

type Tab = 'leaderboard' | 'add-game' | 'history';

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('leaderboard');
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  
  // A simple counter to trigger data re-fetching in child components
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Admin Authorization State
  const [players, setPlayers] = useState<Player[]>([]);
  const [currentAdmin, setCurrentAdmin] = useState<Player | null>(null);
  const [showAdminLoginModal, setShowAdminLoginModal] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [selectedAdminId, setSelectedAdminId] = useState('');

  // Synchronize players and session cache upon boot or refresh
  useEffect(() => {
    // 1. Try to recover active admin session from sessionStorage
    const cached = sessionStorage.getItem('tierg_admin');
    if (cached) {
      try {
        setCurrentAdmin(JSON.parse(cached));
      } catch (e) {
        console.error('Failed to parse cached admin:', e);
      }
    }
    
    // 2. Fetch players list for the dropdown select
    loadPlayersForAdminDropdown();
  }, [refreshTrigger]);

  const loadPlayersForAdminDropdown = async () => {
    try {
      const list = await tiergService.getPlayers();
      setPlayers(list);
      
      // Auto select the first administrator as the default selection
      const admins = list.filter((p) => p.is_admin);
      if (admins.length > 0) {
        setSelectedAdminId(admins[0].id);
      } else if (list.length > 0) {
        setSelectedAdminId(list[0].id);
      }
    } catch (error) {
      console.error('Failed to load players for admin dropdown:', error);
    }
  };

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminPassword === '1110') {
      const adminObj = players.find((p) => p.id === selectedAdminId);
      if (adminObj) {
        setCurrentAdmin(adminObj);
        sessionStorage.setItem('tierg_admin', JSON.stringify(adminObj));
        alert(`'${adminObj.name}' 관리자로 로그인되었습니다.`);
        setAdminPassword('');
        setShowAdminLoginModal(false);
      } else {
        alert('선택된 플레이어 정보를 찾을 수 없습니다.');
      }
    } else {
      alert('비밀번호가 일치하지 않습니다.');
    }
  };

  const handleLogoutAdmin = () => {
    if (window.confirm('관리자 권한을 해제하고 로그아웃 하시겠습니까?')) {
      setCurrentAdmin(null);
      sessionStorage.removeItem('tierg_admin');
      alert('로그아웃되었습니다.');
    }
  };

  const handleRefresh = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  const handleResetDemoData = () => {
    if (window.confirm('데모 데이터를 초기 상태로 리셋하시겠습니까?\n\n초기화 시 기록된 모든 임시 경기 기록이 소멸합니다.')) {
      tiergService.resetDatabase();
      handleRefresh();
      alert('데이터가 초기화되었습니다.');
    }
  };
  const isSupabase = tiergService.isSupabaseMode();

  return (
    <div className="app-container">
      {/* App Header */}
      <header className="app-header">
        <div className="logo-container">
          <div className="logo" onClick={() => setActiveTab('leaderboard')} style={{ cursor: 'pointer' }} title="티어 랭킹 홈으로 즉시 이동">
            {/* Custom Brand Logo: Modern Country Club Shield Crest (Trendy Premium Golf Brand Style) */}
            <svg 
              width="24" 
              height="24" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="#10b981" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
              style={{ marginRight: '2px' }}
            >
              {/* 1. Symmetrical Modern Country Club Shield outline */}
              <path d="M12 21s7-4 7-9V5l-7-2-7 2v7c0 5 7 9 7 9z" />
              {/* 2. Minimalist Golf Ball nestled inside the shield */}
              <circle cx="12" cy="9" r="2" fill="#10b981" stroke="none" />
              {/* 3. Small Golf Tee supporting the ball */}
              <path d="M10.5 11.5h3" />
              <path d="M12 11.5v4" />
            </svg>
            <span>Tier Golf</span>
            <span className="logo-sub">TierG</span>
          </div>

          {/* Database Mode and Admin Status Badges */}
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            {isSupabase ? (
              <div className="mode-badge supabase">
                <DatabaseZap size={12} /> Live Cloud DB
              </div>
            ) : (
              <div className="mode-badge demo">
                <Database size={12} /> Local Demo
              </div>
            )}

            {/* Live Admin status lock/unlock badge */}
            {currentAdmin ? (
              <div className="admin-status-badge unlocked" onClick={handleLogoutAdmin} title="관리자 로그아웃 (인증 정지)">
                <LockOpen size={12} /> {currentAdmin.name}
              </div>
            ) : (
              <div className="admin-status-badge locked" onClick={() => { loadPlayersForAdminDropdown(); setShowAdminLoginModal(true); }} title="관리자 권한 로그인">
                <Lock size={12} /> 잠김
              </div>
            )}
          </div>
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
                  데모 데이터 초기화
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
            isAdmin={currentAdmin !== null}
          />
        )}
      </main>

      {/* Floating Detailed Player Profile Modal */}
      {selectedPlayerId && (
        <PlayerProfile
          playerId={selectedPlayerId}
          onClose={() => setSelectedPlayerId(null)}
          onHandicapUpdated={handleRefresh}
          isAdmin={currentAdmin !== null}
          currentAdminId={currentAdmin?.id}
        />
      )}

      {/* Admin Login Password Modal */}
      {showAdminLoginModal && (
        <div className="modal-overlay" onClick={() => setShowAdminLoginModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">관리자 로그인</h3>
              <button className="modal-close-btn" onClick={() => setShowAdminLoginModal(false)}>
                ✕
              </button>
            </div>
            <form onSubmit={handleAdminLogin} className="modal-body">
              <div className="form-group">
                <label className="form-label">관리자 선택</label>
                <select
                  className="form-input"
                  value={selectedAdminId}
                  onChange={(e) => setSelectedAdminId(e.target.value)}
                  style={{ backgroundColor: 'var(--bg-hover)' }}
                >
                  {players.filter(p => p.is_admin).map((admin) => (
                    <option key={admin.id} value={admin.id}>
                      {admin.name}
                    </option>
                  ))}
                  {players.filter(p => p.is_admin).length === 0 && (
                    <option value="">등록된 관리자가 없습니다.</option>
                  )}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">비밀번호</label>
                <input
                  type="password"
                  className="form-input"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder="비밀번호 입력"
                  required
                />
              </div>

              <button type="submit" className="submit-btn" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                <Check size={18} />
                <span>로그인</span>
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
