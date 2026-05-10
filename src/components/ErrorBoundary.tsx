import React from 'react';

interface State { hasError: boolean; error?: Error; }

export default class ErrorBoundary extends React.Component<
  { children: React.ReactNode }, State
> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[CALVAC] Render error:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <main style={{ padding:'80px 5%', textAlign:'center', minHeight:'60vh',
          display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' }}>
          <div style={{ fontSize:'3rem', marginBottom:16 }}>⚠️</div>
          <h2 style={{ fontFamily:'var(--font-display)', fontSize:'1.4rem', marginBottom:8 }}>
            Something went wrong
          </h2>
          <p style={{ color:'var(--text-muted)', marginBottom:28, fontSize:'0.9rem' }}>
            {this.state.error?.message || 'An unexpected error occurred'}
          </p>
          <button
            onClick={() => { this.setState({ hasError: false }); window.location.reload(); }}
            style={{ padding:'10px 28px', background:'var(--primary)', color:'#fff',
              border:'none', borderRadius:8, fontWeight:700, cursor:'pointer',
              fontFamily:'var(--font-body)', fontSize:'0.9rem' }}>
            Reload page
          </button>
        </main>
      );
    }
    return this.props.children;
  }
}
