'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { TrophyOutlined, SafetyOutlined, TeamOutlined, BarChartOutlined } from '@ant-design/icons';
import { useAuth } from '@/contexts/AuthContext';
import { ROLES } from '@/constants/roles.constants';

const TYPING_TEXTS = [
  'Quản lý danh hiệu thi đua',
  'Đề xuất khen thưởng trực tuyến',
  'Phê duyệt nhiều cấp tự động',
  'Xuất báo cáo thống kê Excel',
];

function TypingText() {
  const [displayText, setDisplayText] = useState('');
  const [textIndex, setTextIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const currentFullText = TYPING_TEXTS[textIndex];
    const speed = isDeleting ? 30 : 60;

    if (!isDeleting && displayText === currentFullText) {
      const timeout = setTimeout(() => setIsDeleting(true), 2000);
      return () => clearTimeout(timeout);
    }

    if (isDeleting && displayText === '') {
      setIsDeleting(false);
      setTextIndex((prev) => (prev + 1) % TYPING_TEXTS.length);
      return;
    }

    const timeout = setTimeout(() => {
      setDisplayText(
        isDeleting
          ? currentFullText.substring(0, displayText.length - 1)
          : currentFullText.substring(0, displayText.length + 1),
      );
    }, speed);

    return () => clearTimeout(timeout);
  }, [displayText, textIndex, isDeleting]);

  return (
    <span className="text-shimmer font-semibold">
      {displayText}
      <span className="inline-block w-[2px] h-[1.1em] bg-cyan-400 ml-1 align-middle animate-pulse" />
    </span>
  );
}

function FloatingShapes() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Glowing orbs */}
      <div className="absolute top-[10%] left-[5%] w-80 h-80 rounded-full bg-blue-500/15 animate-glow-pulse" />
      <div className="absolute bottom-[10%] right-[10%] w-96 h-96 rounded-full bg-indigo-500/10 animate-glow-pulse" style={{ animationDelay: '2s' }} />
      <div className="absolute top-[50%] left-[40%] w-64 h-64 rounded-full bg-cyan-500/8 animate-glow-pulse" style={{ animationDelay: '3s' }} />

      {/* Floating geometric shapes */}
      <div className="absolute top-[15%] right-[20%] w-20 h-20 rounded-2xl border border-white/10 bg-white/[0.03] rotate-12 animate-float-slow" />
      <div className="absolute top-[60%] left-[8%] w-16 h-16 rounded-full border border-white/[0.08] bg-white/[0.02] animate-float-medium" />
      <div className="absolute bottom-[25%] right-[15%] w-24 h-24 rounded-3xl border border-blue-400/10 bg-blue-400/[0.03] -rotate-12 animate-float-slow" style={{ animationDelay: '3s' }} />
      <div className="absolute top-[35%] left-[25%] w-12 h-12 rounded-lg border border-cyan-400/10 bg-cyan-400/[0.03] rotate-45 animate-float-fast" />
      <div className="absolute bottom-[40%] left-[55%] w-14 h-14 rounded-xl border border-white/[0.06] bg-white/[0.02] rotate-6 animate-drift" />
      <div className="absolute top-[75%] right-[35%] w-10 h-10 rounded-full border border-indigo-400/10 bg-indigo-400/[0.02] animate-float-medium" style={{ animationDelay: '1s' }} />

      {/* Thin decorative lines */}
      <div className="absolute top-[20%] left-[15%] w-32 h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent rotate-[30deg] animate-float-slow" style={{ animationDelay: '2s' }} />
      <div className="absolute bottom-[30%] right-[25%] w-40 h-[1px] bg-gradient-to-r from-transparent via-blue-400/10 to-transparent -rotate-[20deg] animate-float-medium" style={{ animationDelay: '4s' }} />
    </div>
  );
}

export default function HomePage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  const isLoggedIn = !!user;

  const handleRedirect = () => {
    if (!user) {
      router.push('/login');
      return;
    }

    switch (user.role) {
      case ROLES.SUPER_ADMIN:
        router.push('/super-admin/dashboard');
        break;
      case ROLES.ADMIN:
        router.push('/admin/dashboard');
        break;
      case ROLES.MANAGER:
        router.push('/manager/dashboard');
        break;
      case ROLES.USER:
        router.push('/user/dashboard');
        break;
      default:
        router.push('/login');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-blue-400/30 rounded-full animate-spin border-t-blue-400" />
        </div>
      </div>
    );
  }

  const features = [
    {
      icon: <TeamOutlined style={{ fontSize: 28 }} />,
      title: 'Quản lý hồ sơ quân nhân',
      desc: 'Quản lý thông tin cá nhân, cấp bậc, chức vụ và lịch sử công tác tập trung.',
    },
    {
      icon: <TrophyOutlined style={{ fontSize: 28 }} />,
      title: 'Khen thưởng đa hình thức',
      desc: '7 loại khen thưởng: hằng năm, cống hiến, huân chương, cờ thi đua, NCKH.',
    },
    {
      icon: <SafetyOutlined style={{ fontSize: 28 }} />,
      title: 'Đề xuất & phê duyệt',
      desc: 'Luồng phê duyệt nhiều cấp, kiểm tra điều kiện tự động, cảnh báo trùng lặp.',
    },
    {
      icon: <BarChartOutlined style={{ fontSize: 28 }} />,
      title: 'Thống kê & báo cáo',
      desc: 'Dashboard trực quan, xuất báo cáo Excel, theo dõi tiến độ xử lý.',
    },
  ];

  return (
    <div className="min-h-screen relative overflow-hidden font-heading">
      {/* Background Image */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: 'url("/BG%20HVKHQS.jpg")',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundAttachment: 'fixed',
        }}
      />
      {/* Dark overlay with gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-950/85 via-blue-950/80 to-slate-950/90" />

      {/* Floating shapes & glowing orbs */}
      <FloatingShapes />

      {/* Header */}
      <header className="relative z-20 animate-slide-up">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="absolute -inset-1 bg-white/15 rounded-xl blur-md" />
              <Image
                src="/logo-msa.png"
                alt="Logo Học viện Khoa học Quân sự"
                width={44}
                height={44}
                className="relative rounded-xl"
                priority
              />
            </div>
            <div className="hidden sm:block">
              <p className="text-white font-bold text-sm leading-tight tracking-wide">
                HỌC VIỆN KHOA HỌC QUÂN SỰ
              </p>
              <p className="text-blue-300/60 text-s leading-tight">Bộ Quốc phòng</p>
            </div>
          </div>
          <button
            onClick={handleRedirect}
            className="glass px-5 py-2.5 rounded-xl text-sm font-semibold text-white hover:bg-white/15 transition-all"
          >
            {isLoggedIn ? 'Vào Dashboard' : 'Đăng nhập'}
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 lg:px-8 pt-12 lg:pt-20 pb-16 lg:pb-24">
        <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-16">
          {/* Left - Text */}
          <div className="flex-1 text-center lg:text-left">
            <div className="animate-slide-up">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass mb-6">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-blue-200 text-sm font-medium">Phiên bản 1.0</span>
              </div>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white leading-[1.1] mb-6 tracking-tight animate-slide-up-delay-1">
              Hệ thống
              <br />
              <span className="text-shimmer">
                Quản lý khen thưởng
              </span>
            </h1>

            <p className="text-base lg:text-xl text-blue-100/60 leading-relaxed max-w-xl mx-auto lg:mx-0 mb-4 animate-slide-up-delay-2">
              Giải pháp số hóa toàn diện cho công tác quản lý khen thưởng, danh hiệu thi đua và thành
              tích khoa học tại Học viện Khoa học Quân sự.
            </p>

            {/* Typing animation */}
            <div className="h-8 mb-8 animate-slide-up-delay-2 flex items-center justify-center lg:justify-start">
              <TypingText />
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-4 justify-center lg:justify-start animate-slide-up-delay-3">
              <button
                onClick={handleRedirect}
                className="w-full sm:w-auto px-8 py-4 rounded-xl font-semibold text-white bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 transition-all shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:-translate-y-0.5 flex items-center justify-center gap-3"
              >
                {isLoggedIn ? 'Vào Dashboard' : 'Đăng nhập ngay'}
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 8l4 4m0 0l-4 4m4-4H3"
                  />
                </svg>
              </button>
              <a
                href="#features"
                className="w-full sm:w-auto px-8 py-4 rounded-xl font-semibold text-blue-300 glass hover:bg-white/10 transition-all flex items-center justify-center gap-2"
              >
                Tìm hiểu thêm
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </a>
            </div>

            {/* Stats */}
            <div className="flex items-center justify-center lg:justify-start gap-8 mt-10 pt-10 border-t border-white/10 animate-slide-up-delay-4">
              {[
                { value: '7', label: 'Loại khen thưởng' },
                { value: '4', label: 'Cấp phê duyệt' },
                { value: '24/7', label: 'Truy cập mọi lúc' },
              ].map((stat, index) => (
                <div key={index} className="text-center lg:text-left">
                  <div className="text-2xl lg:text-3xl font-bold text-white">{stat.value}</div>
                  <div className="text-blue-300/50 text-sm mt-1">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Right - Glass CTA Card */}
          <div className="w-full max-w-md lg:max-w-sm xl:max-w-md flex-shrink-0 animate-slide-up-delay-2">
            <div className="relative group">
              {/* Glow behind card */}
              <div className="absolute -inset-2 bg-gradient-to-r from-blue-500/20 via-cyan-500/15 to-indigo-500/20 rounded-3xl blur-2xl group-hover:blur-3xl transition-all duration-500 opacity-60 group-hover:opacity-80" />
              <div className="relative glass-card rounded-3xl p-8">
                <div className="text-center mb-8">
                  <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 mb-5 shadow-lg shadow-blue-500/15 border border-white/10">
                    <Image
                      src="/logo-msa.png"
                      alt="Logo"
                      width={52}
                      height={52}
                      className="rounded-lg drop-shadow-lg"
                    />
                  </div>
                  <h2 className="text-2xl font-bold text-white mb-2">
                    {isLoggedIn ? 'Chào mừng trở lại!' : 'Bắt đầu ngay'}
                  </h2>
                  <p className="text-blue-200/60 text-sm">
                    {isLoggedIn
                      ? 'Bạn đã đăng nhập thành công'
                      : 'Đăng nhập để truy cập hệ thống quản lý khen thưởng'}
                  </p>
                </div>

                <button
                  onClick={handleRedirect}
                  className="w-full py-3.5 px-6 rounded-xl font-semibold text-white bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 transition-all shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 flex items-center justify-center gap-2"
                >
                  {isLoggedIn ? 'Vào Dashboard' : 'Đăng nhập'}
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17 8l4 4m0 0l-4 4m4-4H3"
                    />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Marquee Ticker */}
      <div className="relative z-10 border-y border-white/[0.06] overflow-hidden py-5">
        <div className="flex animate-marquee whitespace-nowrap">
          {[...Array(2)].map((_, setIdx) => (
            <div key={setIdx} className="flex items-center gap-8 px-4">
              {[
                'Quản lý khen thưởng tập trung',
                'Luồng phê duyệt nhiều cấp',
                'Thông báo thời gian thực',
                'Nhập / Xuất Excel',
                'Phân quyền 4 vai trò',
                '7 loại khen thưởng',
                'Kiểm tra điều kiện tự động',
                'Theo dõi lịch sử đề xuất',
              ].map((text, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 flex-shrink-0" />
                  <span className="text-blue-200/60 text-sm font-medium">{text}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Features Section */}
      <section id="features" className="relative z-10">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-16 lg:py-24">
          <div className="text-center mb-12 lg:mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-white mb-4">Tính năng nổi bật</h2>
            <p className="text-blue-200/50 text-base max-w-2xl mx-auto">
              Hệ thống được thiết kế chuyên biệt cho công tác thi đua khen thưởng trong môi trường quân
              đội.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {features.map((feature, index) => (
              <div
                key={index}
                className="group relative glass rounded-2xl p-6 hover:bg-white/[0.08] hover:border-white/20 transition-all duration-300 hover:-translate-y-1"
              >
                {/* Hover glow */}
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-blue-500/0 to-cyan-500/0 group-hover:from-blue-500/5 group-hover:to-cyan-500/5 transition-all duration-300" />
                <div className="relative">
                  <div className="w-12 h-12 rounded-xl glass flex items-center justify-center text-blue-400 mb-4 group-hover:scale-110 group-hover:text-cyan-400 transition-all duration-300">
                    {feature.icon}
                  </div>
                  <h3 className="text-white font-semibold text-base mb-2">{feature.title}</h3>
                  <p className="text-blue-200/50 text-sm leading-relaxed">{feature.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Info Section */}
      <section className="relative z-10 border-t border-white/[0.06]">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-16 lg:py-20">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10 lg:gap-16">
            <div className="md:col-span-2">
              <h3 className="text-white font-bold text-xl mb-4">Về hệ thống quản lý khen thưởng</h3>
              <p className="text-blue-200/50 leading-relaxed mb-6">
                Hệ thống quản lý khen thưởng là giải pháp công nghệ hiện đại được phát triển phục vụ
                công tác thi đua khen thưởng tại Học viện Khoa học Quân sự. Hệ thống hỗ trợ số hóa toàn
                bộ quy trình từ đề xuất, xét duyệt đến ra quyết định khen thưởng, đảm bảo tính minh
                bạch, chính xác và hiệu quả.
              </p>
              <div className="flex flex-wrap gap-6 lg:gap-10">
                {[
                  { value: '4 vai trò', sub: 'Phân quyền chi tiết' },
                  { value: '100%', sub: 'Bảo mật dữ liệu' },
                  { value: 'Realtime', sub: 'Thông báo tức thì' },
                ].map((item, i) => (
                  <div key={i} className="glass rounded-xl px-5 py-4">
                    <div className="text-xl font-bold text-white">{item.value}</div>
                    <div className="text-blue-300/50 text-sm mt-1">{item.sub}</div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-white font-bold text-xl mb-4">Liên hệ</h3>
              <div className="space-y-3 text-blue-200/50 text-sm">
                <p>Học viện Khoa học Quân sự</p>
                <p>322E Lê Trọng Tấn, Thanh Xuân, Hà Nội</p>
                <p>Email: support@hvkhqs.edu.vn</p>
                <p>Hotline: (+84) 12345678</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/[0.06]">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-blue-300/40 text-sm">
            © 2026 Học viện Khoa học Quân sự. Bản quyền thuộc về HVKHQS.
          </p>
          <p className="text-blue-300/30 text-s">Phát triển bởi Sinh viên CNTT - HVKHQS</p>
        </div>
      </footer>
    </div>
  );
}
