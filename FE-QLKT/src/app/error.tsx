'use client';

import { useEffect, useState } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const htmlHasDarkClass = document.documentElement.classList.contains('dark');
    const storedTheme = localStorage.getItem('theme');
    setIsDark(htmlHasDarkClass || storedTheme === 'dark');
    console.error('Application error:', error);
  }, [error]);

  const bg = isDark
    ? 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)'
    : 'linear-gradient(135deg, #f8fafc 0%, #fee2e2 100%)';
  const headingColor = isDark ? '#f1f5f9' : '#1e293b';
  const subColor = isDark ? '#94a3b8' : '#64748b';
  const errBoxBg = isDark ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0.06)';
  const errBoxBorder = isDark ? 'rgba(239,68,68,0.3)' : 'rgba(239,68,68,0.4)';
  const errTextColor = isDark ? '#f87171' : '#dc2626';
  const btnBg = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
  const btnBorder = isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)';
  const btnColor = isDark ? '#e2e8f0' : '#334155';
  const btnHoverBg = isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)';

  return (
    <div style={{ background: bg }}
      className="flex min-h-screen flex-col items-center justify-center px-4">
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          15%       { transform: translateX(-8px) rotate(-3deg); }
          30%       { transform: translateX(8px) rotate(3deg); }
          45%       { transform: translateX(-6px) rotate(-2deg); }
          60%       { transform: translateX(6px) rotate(2deg); }
          75%       { transform: translateX(-3px); }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse-ring {
          0%   { transform: scale(0.9); opacity: 0.6; }
          70%  { transform: scale(1.15); opacity: 0; }
          100% { transform: scale(0.9); opacity: 0; }
        }
        .shake    { animation: shake 0.7s ease 0.4s both; }
        .fade-1   { animation: fadeUp 0.5s ease both 0.5s; }
        .fade-2   { animation: fadeUp 0.5s ease both 0.65s; }
        .fade-3   { animation: fadeUp 0.5s ease both 0.8s; }
        .ring     { animation: pulse-ring 2s ease-out infinite; }
        .ring2    { animation: pulse-ring 2s ease-out infinite 0.5s; }
        .err-btn-danger { background: #dc2626; border: none; color: #fff; border-radius: 8px; padding: 0 24px; height: 44px; font-size: 15px; font-weight: 500; cursor: pointer; transition: background 0.15s; }
        .err-btn-danger:hover { background: #b91c1c; }
      `}</style>

      <div className="relative mb-6 flex items-center justify-center">
        <span className="ring absolute inline-block w-32 h-32 rounded-full bg-red-500 opacity-20" />
        <span className="ring2 absolute inline-block w-32 h-32 rounded-full bg-red-500 opacity-10" />
        <div className="shake relative z-10 flex items-center justify-center w-28 h-28 rounded-full border-4"
          style={{ background: 'rgba(239,68,68,0.15)', borderColor: 'rgba(239,68,68,0.4)' }}>
          <svg width="56" height="56" viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="28" cy="28" r="28" fill="rgba(239,68,68,0.2)" />
            <rect x="25" y="12" width="6" height="22" rx="3" fill="#f87171" />
            <circle cx="28" cy="42" r="4" fill="#f87171" />
          </svg>
        </div>
      </div>

      <h1 className="fade-1 text-3xl font-black mb-2 text-center" style={{ color: headingColor }}>
        Đã xảy ra lỗi
      </h1>
      <p className="fade-1 mb-2 text-center max-w-sm" style={{ color: subColor }}>
        Hệ thống gặp sự cố không mong muốn. Vui lòng thử lại hoặc quay về trang trước.
      </p>
      {process.env.NODE_ENV === 'development' && error?.message && (
        <p className="fade-2 text-xs font-mono mb-6 px-4 py-3 rounded-lg max-w-xl w-full text-left break-words"
          style={{ background: errBoxBg, color: errTextColor, border: `1px solid ${errBoxBorder}` }}>
          {error.message}
        </p>
      )}

      <div className="fade-3 flex gap-3">
        <button
          style={{ background: btnBg, border: `1px solid ${btnBorder}`, color: btnColor, borderRadius: 8, padding: '0 24px', height: 44, fontSize: 15, fontWeight: 500, cursor: 'pointer' }}
          onMouseEnter={e => (e.currentTarget.style.background = btnHoverBg)}
          onMouseLeave={e => (e.currentTarget.style.background = btnBg)}
          onClick={() => window.history.back()}
        >
          Quay lại
        </button>
        <button className="err-btn-danger" onClick={reset}>Thử lại</button>
      </div>
    </div>
  );
}
