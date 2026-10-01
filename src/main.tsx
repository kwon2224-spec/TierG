import { Component, type ErrorInfo, type ReactNode, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('TierGolf Uncaught Error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '24px', backgroundColor: '#0f172a', color: '#ffffff', minHeight: '100vh', fontFamily: 'sans-serif' }}>
          <h2 style={{ color: '#f87171', fontSize: '18px', marginBottom: '12px' }}>⚠️ 화면 렌더링 중 오류가 발생했습니다</h2>
          <div style={{ backgroundColor: 'rgba(0,0,0,0.4)', padding: '14px', borderRadius: '8px', fontSize: '13px', color: '#fbbf24', marginBottom: '16px', lineHeight: '1.5' }}>
            {this.state.error?.message || '알 수 없는 오류'}
          </div>
          <pre style={{ backgroundColor: 'rgba(0,0,0,0.6)', padding: '12px', borderRadius: '8px', overflow: 'auto', fontSize: '11px', color: '#94a3b8', maxHeight: '200px' }}>
            {this.state.error?.stack}
          </pre>
          <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
            <button
              onClick={() => {
                localStorage.clear();
                sessionStorage.clear();
                window.location.reload();
              }}
              style={{ padding: '10px 18px', borderRadius: '8px', backgroundColor: '#3b82f6', color: '#fff', border: 'none', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px' }}
            >
              캐시 초기화 및 새로고침
            </button>
            <button
              onClick={() => window.location.reload()}
              style={{ padding: '10px 18px', borderRadius: '8px', backgroundColor: 'rgba(255,255,255,0.1)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px' }}
            >
              단순 새로고침
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
