import React, { useState, useEffect } from 'react';
import { Trophy, PlusCircle, History, Lock, LockOpen, Check, Sun, Moon } from 'lucide-react';
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

  // Device-isolated Theme State (Saved strictly to each user's phone localStorage!)
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('tierg_theme') as 'dark' | 'light') || 'dark';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('tierg_theme', theme);
  }, [theme]);

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
            {/* Custom Brand Wordmark Logo: Bold Pure Minimalism (No capsule, just large, stunning typography!) */}
            <div className="logo-brand-wordmark" style={{ fontSize: '21px', letterSpacing: '-0.02em' }}>
              <span style={{ fontWeight: '900', color: '#ffffff' }}>TIER</span>
              <span style={{ fontWeight: '900', color: '#10b981', marginLeft: '4px' }}>GOLF</span>
            </div>
          </div>

          {/* Database Mode and Admin Status Badges */}
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            {/* Device-isolated Theme Toggle (Sun/Moon) */}
            <button
              type="button"
              onClick={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                backgroundColor: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-secondary)',
                padding: '4px 9px',
                borderRadius: '12px',
                fontSize: '11px',
                fontWeight: '700',
                cursor: 'pointer',
                userSelect: 'none',
                transition: 'all 0.2s',
              }}
              title={theme === 'dark' ? '화사한 세라믹 라이트 모드로 전환' : '프리미엄 다크 모드로 전환'}
            >
              {theme === 'dark' ? <Sun size={12} color="#fbbf24" /> : <Moon size={12} color="#6366f1" />}
              <span>{theme === 'dark' ? '라이트' : '다크'}</span>
            </button>

            {/* Live Admin status lock/unlock badge - Stylishly redesigned, no clunky Cloud DB jargon! */}
            {currentAdmin ? (
              <div 
                className="admin-status-badge unlocked" 
                onClick={handleLogoutAdmin} 
                title="관리자 로그아웃"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  backgroundColor: 'rgba(16, 185, 129, 0.05)',
                  border: '1px solid rgba(16, 185, 129, 0.15)',
                  color: '#34d399',
                  padding: '4px 10px',
                  borderRadius: '12px',
                  fontSize: '11px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  userSelect: 'none',
                  transition: 'all 0.2s'
                }}
              >
                <LockOpen size={11} />
                <span>{currentAdmin.name}</span>
              </div>
            ) : (
              <div 
                className="admin-status-badge locked" 
                onClick={() => { loadPlayersForAdminDropdown(); setShowAdminLoginModal(true); }} 
                title="관리자 로그인"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  backgroundColor: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                  color: 'var(--text-muted)',
                  padding: '4px 10px',
                  borderRadius: '12px',
                  fontSize: '11px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  userSelect: 'none',
                  transition: 'all 0.2s'
                }}
              >
                <Lock size={11} />
                <span>관리자</span>
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
