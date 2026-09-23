import { render } from 'preact';

declare const __APP_VERSION__: string;

// Phase 0 placeholder. The real shell arrives after the design checkpoint.
function App() {
  return (
    <main style={{ fontFamily: 'system-ui', color: '#eef4f0', background: '#050807', minHeight: '100dvh', padding: 16 }}>
      <h1>Green Tracker</h1>
      <p>Version {__APP_VERSION__}</p>
    </main>
  );
}

render(<App />, document.getElementById('app')!);
