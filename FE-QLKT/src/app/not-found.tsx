'use client';

import Link from 'next/link';
import { Button } from 'antd';

export default function NotFound() {
  return (
    <div
      className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4"
      style={{ background: 'linear-gradient(160deg, #eef2ff 0%, #f0f9ff 50%, #ede9fe 100%)' }}
    >
      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .fade-1 { animation: fadeUp 0.55s ease both 0.1s; }
        .fade-2 { animation: fadeUp 0.55s ease both 0.25s; }
        .fade-3 { animation: fadeUp 0.55s ease both 0.4s; }
      `}</style>

      {/* Soft glow blobs */}
      <div style={{
        position: 'absolute', top: -160, left: -120, width: 500, height: 500, pointerEvents: 'none',
        background: 'radial-gradient(circle, rgba(165,180,252,0.3) 0%, transparent 65%)',
        filter: 'blur(50px)',
      }} />
      <div style={{
        position: 'absolute', bottom: -120, right: -100, width: 420, height: 420, pointerEvents: 'none',
        background: 'radial-gradient(circle, rgba(196,181,253,0.28) 0%, transparent 65%)',
        filter: 'blur(50px)',
      }} />

      <div className="relative z-10 flex flex-col items-center text-center">

        {/* SVG illustration — all animations are SVG-native */}
        <div style={{ width: 320, height: 300, marginBottom: 16 }}>
          <svg width="320" height="300" viewBox="0 0 320 300" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <radialGradient id="pGrad" cx="38%" cy="32%" r="65%">
                <stop stopColor="#dbeafe" />
                <stop offset="1" stopColor="#c7d2fe" />
              </radialGradient>
              <linearGradient id="bodyG" x1="0" y1="0" x2="0" y2="1">
                <stop stopColor="#ffffff" />
                <stop offset="1" stopColor="#e0e7ff" />
              </linearGradient>
              <linearGradient id="noseG" x1="0" y1="0" x2="0" y2="1">
                <stop stopColor="#6366f1" />
                <stop offset="1" stopColor="#3b82f6" />
              </linearGradient>
              <linearGradient id="finG" x1="0" y1="0" x2="1" y2="1">
                <stop stopColor="#4f46e5" />
                <stop offset="1" stopColor="#2563eb" />
              </linearGradient>
              <radialGradient id="portG" cx="35%" cy="30%" r="65%">
                <stop stopColor="#bfdbfe" />
                <stop offset="1" stopColor="#4f46e5" />
              </radialGradient>
              <linearGradient id="flOut" x1="0" y1="0" x2="0" y2="1">
                <stop stopColor="#fb923c" />
                <stop offset="1" stopColor="#fde68a" stopOpacity="0" />
              </linearGradient>
              <linearGradient id="flIn" x1="0" y1="0" x2="0" y2="1">
                <stop stopColor="#fef9c3" />
                <stop offset="1" stopColor="#fbbf24" stopOpacity="0" />
              </linearGradient>
              <linearGradient id="ringG" x1="0%" y1="0%" x2="100%" y2="0%" gradientUnits="userSpaceOnUse">
                <stop offset="0%"   stopColor="#a5b4fc" stopOpacity="0.05" />
                <stop offset="35%"  stopColor="#818cf8" stopOpacity="0.7" />
                <stop offset="65%"  stopColor="#818cf8" stopOpacity="0.7" />
                <stop offset="100%" stopColor="#a5b4fc" stopOpacity="0.05" />
              </linearGradient>
              {/* ClipPaths for planet ring layering */}
              <clipPath id="ringBackClip">
                <rect x="0" y="240" width="320" height="60" />
              </clipPath>
              <clipPath id="ringFrontClip">
                <rect x="0" y="0" width="320" height="240" />
              </clipPath>
              {/* Satellite orbit path */}
              <path id="satPath" d="M242,240 A82,17 0 1 0 78,240 A82,17 0 1 0 242,240" />
            </defs>

            {/* Stars — twinkling with SVG animate */}
            <circle cx="22" cy="38" r="3" fill="#818cf8">
              <animate attributeName="opacity" values="0.9;0.15;0.9" dur="2.2s" repeatCount="indefinite" />
            </circle>
            <circle cx="292" cy="28" r="2.5" fill="#a5b4fc">
              <animate attributeName="opacity" values="0.7;0.1;0.7" dur="3.1s" begin="0.7s" repeatCount="indefinite" />
            </circle>
            <circle cx="48" cy="158" r="2" fill="#c7d2fe">
              <animate attributeName="opacity" values="0.8;0.2;0.8" dur="1.9s" begin="1.2s" repeatCount="indefinite" />
            </circle>
            <circle cx="278" cy="132" r="3" fill="#818cf8">
              <animate attributeName="opacity" values="0.85;0.1;0.85" dur="2.7s" begin="0.4s" repeatCount="indefinite" />
            </circle>
            <circle cx="258" cy="58" r="2" fill="#a5b4fc">
              <animate attributeName="opacity" values="0.6;0.2;0.6" dur="2.4s" begin="0.9s" repeatCount="indefinite" />
            </circle>
            <circle cx="12" cy="215" r="1.5" fill="#c7d2fe">
              <animate attributeName="opacity" values="0.7;0.15;0.7" dur="3.3s" begin="0.3s" repeatCount="indefinite" />
            </circle>
            <circle cx="305" cy="200" r="2" fill="#818cf8">
              <animate attributeName="opacity" values="0.8;0.2;0.8" dur="2.0s" begin="1.5s" repeatCount="indefinite" />
            </circle>

            {/* Back ring (below planet) */}
            <ellipse cx="160" cy="240" rx="82" ry="17"
              fill="none" stroke="url(#ringG)" strokeWidth="10"
              clipPath="url(#ringBackClip)" />

            {/* Planet */}
            <circle cx="160" cy="240" r="52" fill="url(#pGrad)" />
            {/* Craters */}
            <circle cx="136" cy="228" r="9"   fill="#c7d2fe" opacity="0.45" />
            <circle cx="176" cy="248" r="6"   fill="#c7d2fe" opacity="0.38" />
            <circle cx="154" cy="220" r="3.5" fill="#bfdbfe" opacity="0.4" />
            <circle cx="183" cy="228" r="7.5" fill="#c7d2fe" opacity="0.32" />
            {/* Planet shine */}
            <ellipse cx="142" cy="220" rx="14" ry="9" fill="white" opacity="0.12" transform="rotate(-20,142,220)" />

            {/* Front ring (above planet) */}
            <ellipse cx="160" cy="240" rx="82" ry="17"
              fill="none" stroke="url(#ringG)" strokeWidth="10"
              clipPath="url(#ringFrontClip)" />

            {/* Satellite orbiting — SVG animateMotion */}
            <g>
              <rect x="-12" y="-5" width="24" height="10" rx="3" fill="#e0e7ff" stroke="#a5b4fc" strokeWidth="1.5" />
              <rect x="-21" y="-3" width="10" height="6" rx="1.5" fill="#93c5fd" />
              <rect x="11"  y="-3" width="10" height="6" rx="1.5" fill="#93c5fd" />
              <circle r="3" fill="#6366f1" />
              <animateMotion dur="7s" repeatCount="indefinite" rotate="auto">
                <mpath href="#satPath" />
              </animateMotion>
            </g>

            {/* Rocket — SVG animateTransform for float, additive="sum" preserves base position */}
            <g transform="translate(160,115)">
              {/* Nose cone */}
              <path d="M-18,-12 Q-18,-52 0,-64 Q18,-52 18,-12 Z" fill="url(#noseG)" />
              {/* Nose shine */}
              <path d="M-14,-16 Q-14,-46 -2,-58 Q-9,-44 -11,-20 Z" fill="white" opacity="0.18" />
              {/* Body */}
              <rect x="-18" y="-16" width="36" height="56" rx="10" fill="url(#bodyG)" stroke="#e0e7ff" strokeWidth="1" />
              {/* Porthole */}
              <circle cy="-2" r="12" fill="white" opacity="0.95" />
              <circle cy="-2" r="9" fill="url(#portG)" />
              <circle cx="-4" cy="-6" r="3.5" fill="white" opacity="0.42" />
              {/* Body stripe */}
              <rect x="-18" y="26" width="36" height="4.5" rx="2.25" fill="white" opacity="0.12" />
              {/* Left fin */}
              <path d="M-18,26 L-28,44 L-12,36 Z" fill="url(#finG)" />
              {/* Right fin */}
              <path d="M18,26 L28,44 L12,36 Z" fill="url(#finG)" />
              {/* Flame outer */}
              <ellipse cx="0" cy="50" rx="9" ry="17" fill="url(#flOut)" opacity="0.88">
                <animate attributeName="ry" values="17;22;17" dur="0.45s" repeatCount="indefinite" />
                <animate attributeName="rx" values="9;7;9" dur="0.45s" repeatCount="indefinite" />
              </ellipse>
              {/* Flame inner */}
              <ellipse cx="0" cy="48" rx="5" ry="10" fill="url(#flIn)">
                <animate attributeName="ry" values="10;13;10" dur="0.45s" repeatCount="indefinite" />
                <animate attributeName="rx" values="5;3.5;5" dur="0.45s" repeatCount="indefinite" />
              </ellipse>
              {/* Float animation — additive="sum" adds to translate(160,115) */}
              <animateTransform
                attributeName="transform"
                type="translate"
                additive="sum"
                values="0,0; 0,-20; 0,0"
                dur="3.6s"
                repeatCount="indefinite"
                calcMode="spline"
                keySplines="0.45 0 0.55 1;0.45 0 0.55 1"
              />
            </g>
          </svg>
        </div>

        {/* 404 */}
        <div className="fade-1" style={{ marginBottom: 16 }}>
          <span
            style={{
              fontSize: 96,
              fontWeight: 900,
              lineHeight: 1,
              letterSpacing: '-4px',
              background: 'linear-gradient(135deg, #3b82f6 0%, #6366f1 60%, #8b5cf6 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              userSelect: 'none',
              display: 'block',
            }}
          >
            404
          </span>
        </div>

        <h1 className="fade-2" style={{ fontSize: 22, fontWeight: 700, color: '#1e293b', marginBottom: 12, letterSpacing: '-0.3px' }}>
          Trang không tồn tại
        </h1>
        <p className="fade-2" style={{ fontSize: 15, color: '#64748b', maxWidth: 300, lineHeight: 1.7, marginBottom: 36 }}>
          Trang bạn tìm kiếm đã bị xóa, đổi địa chỉ hoặc chưa bao giờ tồn tại.
        </p>

        <div className="fade-3">
          <Link href="/">
            <Button
              type="primary"
              size="large"
              style={{
                height: 48,
                paddingInline: 44,
                fontSize: 15,
                fontWeight: 600,
                borderRadius: 12,
                background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
                border: 'none',
                boxShadow: '0 6px 20px rgba(99,102,241,0.4)',
              }}
            >
              Về trang chủ
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
