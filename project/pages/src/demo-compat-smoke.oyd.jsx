import React, { useEffect, useState } from 'react';

var CARD_TITLE = 'OpenYida compat compiler smoke test';

export default function Page() {
  const [count, setCount] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
    return () => {
      setReady(false);
    };
  }, []);

  return (
    <div style={{
      minHeight: '100vh',
      padding: '32px',
      backgroundColor: '#f5f7fb',
      color: '#172033',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    }}>
      <div style={{
        maxWidth: 720,
        margin: '0 auto',
        padding: 24,
        backgroundColor: '#fff',
        border: '1px solid #d9e1ec',
        borderRadius: 8,
      }}>
        <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>{CARD_TITLE}</div>
        <div style={{ fontSize: 14, color: '#667085', marginBottom: 20 }}>
          This page was written as .oyd.jsx with useState/useEffect and lowered before publish.
        </div>
        <div style={{ fontSize: 40, fontWeight: 800, marginBottom: 16 }}>{count}</div>
        <button
          style={{
            height: 40,
            padding: '0 16px',
            border: '0',
            borderRadius: 6,
            backgroundColor: '#2f6bff',
            color: '#fff',
            cursor: 'pointer',
            fontWeight: 700,
          }}
          onClick={() => setCount(count + 1)}
        >
          Increment
        </button>
        <div style={{ marginTop: 16, color: ready ? '#18a67e' : '#ee6b57' }}>
          Runtime status: {ready ? 'mounted' : 'mounting'}
        </div>
      </div>
    </div>
  );
}
