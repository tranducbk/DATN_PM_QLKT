'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { TrophyOutlined } from '@ant-design/icons';

export default function HomePage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    const role = localStorage.getItem('role');

    if (token && role) {
      setIsLoggedIn(true);
      setUserRole(role);
    }

    setLoading(false);
  }, []);

  const handleRedirect = () => {
    if (!isLoggedIn) {
      router.push('/login');
      return;
    }

    switch (userRole) {
      case 'SUPER_ADMIN':
        router.push('/super-admin/dashboard');
        break;
      case 'ADMIN':
        router.push('/admin/dashboard');
        break;
      case 'MANAGER':
        router.push('/manager/dashboard');
        break;
      case 'USER':
        router.push('/user/dashboard');
        break;
      default:
        router.push('/login');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-900 via-slate-900 to-slate-950">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-blue-400/30 rounded-full animate-spin border-t-blue-400"></div>
        </div>
      </div>
    );
  }

  const features = [
    {
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
      title: 'Hồ sơ quân nhân',
      desc: 'Thông tin, cấp bậc, cơ cấu đơn vị tập trung'
    },
    {
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
        </svg>
      ),
      title: 'Khen thưởng',
      desc: 'Danh hiệu, quyết định, minh chứng file tập trung'
    },
    {
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
      title: 'Đề xuất khen thưởng',
      desc: 'Luồng phê duyệt rõ ràng, cảnh báo trùng lặp'
    },
    {
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
      title: 'Báo cáo & thống kê',
      desc: 'Số liệu khen thưởng, tình trạng đề xuất, tiến độ xử lý'
    },
  ];

  return (
    <div
      className="min-h-screen relative overflow-hidden"
      style={{
        backgroundImage:
          'linear-gradient(120deg, rgba(8, 47, 73, 0.75), rgba(15, 23, 42, 0.88)), url("/BG%20HVKHQS.jpg")',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
      }}
    >
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-30">
        <div
          className="absolute top-0 left-0 w-full h-full"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.03'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
          }}
        />
      </div>

      {/* Floating Elements */}
      <div className="absolute top-20 left-10 w-72 h-72 bg-blue-500/20 rounded-full blur-3xl"></div>
      <div className="absolute bottom-20 right-10 w-96 h-96 bg-indigo-500/15 rounded-full blur-3xl"></div>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-blue-600/5 rounded-full blur-3xl"></div>

      {/* Main Content - Split Layout */}
      <div className="relative z-10 min-h-screen flex">
        {/* Left Side - Branding & Info */}
        <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 xl:p-16">
          {/* Logo */}
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="absolute inset-0 bg-white/20 rounded-2xl blur-xl"></div>
                  <Image
                    src="/logo-msa.png"
                    alt="Logo"
                    width={64}
                    height={64}
                    className="relative rounded-2xl"
                    priority
                  />
                </div>
                <h2 className="text-xl font-bold text-white">HỌC VIỆN KHOA HỌC QUÂN SỰ</h2>
              </div>

          {/* Main Content */}
          <div className="space-y-8">
            <div>
              <h1 className="text-5xl xl:text-6xl font-bold text-white leading-tight mb-6">
                Hệ thống
                <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-cyan-400 to-blue-400">
                  Quản lý Khen thưởng
                </span>
              </h1>
              <p className="text-xl text-blue-100/80 leading-relaxed max-w-lg">
                Giải pháp số hóa toàn diện cho công tác quản lý khen thưởng, danh hiệu và thành tích khoa học.
              </p>
            </div>

            {/* Features Grid */}
            <div className="grid grid-cols-2 gap-4">
              {features.map((feature, index) => (
                <div
                  key={index}
                  className="bg-white/5 backdrop-blur-sm rounded-2xl p-5 border border-white/10 hover:bg-white/10 transition-all group"
                >
                  <div className="text-blue-400 mb-3 group-hover:scale-110 group-hover:text-cyan-400 transition-all">
                    {feature.icon}
                  </div>
                  <h3 className="text-white font-semibold mb-1">{feature.title}</h3>
                  <p className="text-blue-200/60 text-sm">{feature.desc}</p>
                </div>
              ))}
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { value: '100+', label: 'Quân nhân' },
                { value: '500+', label: 'Khen thưởng' },
                { value: '99%', label: 'Độ chính xác' },
              ].map((stat, index) => (
                <div
                  key={index}
                  className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-4 shadow-lg"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-white/0" />
                  <div className="relative">
                    <div className="text-3xl font-bold text-white leading-none mb-1">{stat.value}</div>
                    <div className="text-blue-300/70 text-sm">{stat.label}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="text-blue-300/50 text-sm">
            © 2025 Học viện Khoa học Quân sự
          </div>
        </div>

        {/* Right Side - Login/CTA Card */}
        <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12">
          <div className="w-full max-w-md">
            {/* Mobile Logo */}
            <div className="lg:hidden flex items-center justify-center gap-3 mb-10">
              <Image
                src="/logo-msa.png"
                alt="Logo"
                width={56}
                height={56}
                className="rounded-xl"
                priority
              />
              <div>
                <h2 className="text-lg font-bold text-white">HỌC VIỆN KHOA HỌC QUÂN SỰ</h2>
              </div>
            </div>

            {/* Card */}
              <div className="bg-white/10 backdrop-blur-xl rounded-3xl p-8 sm:p-10 border border-white/20 shadow-2xl">
                <div className="text-center mb-8">
                  <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500 via-cyan-500 to-blue-600 mb-6 shadow-lg shadow-blue-500/30">
                    <TrophyOutlined className="text-white drop-shadow-lg" style={{ fontSize: 40 }} />
                  </div>
                <h2 className="text-2xl font-bold text-white mb-2">
                  {isLoggedIn ? 'Chào mừng trở lại!' : 'Truy cập Hệ thống'}
                </h2>
                <p className="text-blue-200/70">
                  {isLoggedIn
                    ? 'Bạn đã đăng nhập thành công'
                    : 'Đăng nhập để quản lý khen thưởng'}
                </p>
              </div>

              <button
                onClick={handleRedirect}
                className="w-full py-4 px-6 rounded-xl font-semibold text-white bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 transition-all shadow-lg shadow-blue-500/30 hover:shadow-blue-500/40 hover:-translate-y-0.5 flex items-center justify-center gap-3"
              >
                {isLoggedIn ? 'Vào Dashboard' : 'Đăng nhập ngay'}
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </button>

              {/* Quick Links */}
              <div className="mt-8 pt-6 border-t border-white/10">
                <div className="flex justify-center gap-6 text-sm">
                  <a href="#features" className="text-blue-300/70 hover:text-white transition-colors">Tính năng</a>
                  <a href="#contact" className="text-blue-300/70 hover:text-white transition-colors">Liên hệ</a>
                  <a href="#about" className="text-blue-300/70 hover:text-white transition-colors">Giới thiệu</a>
                </div>
              </div>
            </div>

            {/* Mobile Features */}
            <div className="lg:hidden mt-8 grid grid-cols-2 gap-3">
              {features.map((feature, index) => (
                <div
                  key={index}
                  className="bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/10"
                >
                  <div className="text-blue-400 mb-2">{feature.icon}</div>
                  <h3 className="text-white font-medium text-sm">{feature.title}</h3>
                </div>
              ))}
            </div>

            {/* Mobile Footer */}
            <div className="lg:hidden mt-8 text-center text-blue-300/50 text-sm">
              © 2025 Học viện Khoa học Quân sự
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Info Section (Desktop) */}
      <div id="features" className="hidden lg:block relative z-10 border-t border-white/10 bg-black/20 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-12 py-16">
          <div className="grid grid-cols-4 gap-8">
            {/* About */}
            <div className="col-span-2">
              <h3 className="text-white font-bold text-lg mb-4">Về Hệ thống Quản lý Khen thưởng</h3>
              <p className="text-blue-200/60 leading-relaxed mb-6">
                Hệ thống Quản lý Khen thưởng là giải pháp công nghệ hiện đại được phát triển
                dành riêng cho Học viện Khoa học Quân sự, hỗ trợ số hóa toàn bộ quy trình quản lý
                khen thưởng, danh hiệu và thành tích khoa học.
              </p>
              <div className="flex gap-8">
                <div>
                  <div className="text-2xl font-bold text-white">24/7</div>
                  <div className="text-blue-300/60 text-sm">Hỗ trợ kỹ thuật</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-white">100%</div>
                  <div className="text-blue-300/60 text-sm">Bảo mật dữ liệu</div>
                </div>
              </div>
            </div>

            {/* Features List */}
            <div>
              <h3 className="text-white font-bold text-lg mb-4">Tính năng</h3>
              <ul className="space-y-3 text-blue-200/60">
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-blue-400 rounded-full"></span>
                  Quản lý quân nhân
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-blue-400 rounded-full"></span>
                  Khen thưởng hằng năm
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-blue-400 rounded-full"></span>
                  Đề xuất & phê duyệt
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-blue-400 rounded-full"></span>
                  Thống kê báo cáo
                </li>
              </ul>
            </div>

            {/* Contact */}
            <div id="contact">
              <h3 className="text-white font-bold text-lg mb-4">Liên hệ</h3>
              <div className="space-y-3 text-blue-200/60">
                <p>Email: support@hvkhqs.edu.vn</p>
                <p>Hotline: (+84) 12345678</p>
                <p>Địa chỉ: 322E Lê Trọng Tấn, Thanh Xuân, Hà Nội</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
