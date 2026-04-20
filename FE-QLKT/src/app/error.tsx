'use client';

import { useEffect } from 'react';
import { Button } from 'antd';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Application error:', error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-slate-50 to-red-50 dark:from-slate-900 dark:to-slate-800 px-4">
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
      `}</style>

      {/* Icon with pulsing rings */}
      <div className="relative mb-6 flex items-center justify-center">
        <span className="ring absolute inline-block w-32 h-32 rounded-full bg-red-400 opacity-30" />
        <span className="ring2 absolute inline-block w-32 h-32 rounded-full bg-red-400 opacity-20" />
        <div className="shake relative z-10 flex items-center justify-center w-28 h-28 rounded-full bg-red-100 dark:bg-red-900/40 border-4 border-red-300 dark:border-red-700">
          <svg width="56" height="56" viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="28" cy="28" r="28" fill="#fee2e2" />
            {/* Exclamation */}
            <rect x="25" y="12" width="6" height="22" rx="3" fill="#ef4444" />
            <circle cx="28" cy="42" r="4" fill="#ef4444" />
          </svg>
        </div>
      </div>

      <h1 className="fade-1 text-3xl font-black text-slate-800 dark:text-slate-100 mb-2 text-center">
        Đã xảy ra lỗi
      </h1>
      <p className="fade-1 text-slate-500 dark:text-slate-400 mb-2 text-center max-w-sm">
        Hệ thống gặp sự cố không mong muốn. Vui lòng thử lại hoặc quay về trang chủ.
      </p>
      {process.env.NODE_ENV === 'development' && error?.message && (
        <p className="fade-2 text-xs text-red-400 font-mono mb-6 bg-slate-900 px-4 py-3 rounded-lg max-w-xl w-full text-left break-words">
          {error.message}
        </p>
      )}

      <div className="fade-3 flex gap-3">
        <Button size="large" onClick={() => window.history.back()} className="h-11 px-6 font-medium rounded-lg">
          Quay lại
        </Button>
        <Button type="primary" danger size="large" onClick={reset} className="h-11 px-6 font-medium rounded-lg shadow-md">
          Thử lại
        </Button>
      </div>
    </div>
  );
}
