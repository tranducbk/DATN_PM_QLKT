'use client';

import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  ApartmentOutlined,
  ArrowRightOutlined,
  AuditOutlined,
  BarChartOutlined,
  CrownOutlined,
  ExperimentOutlined,
  FileDoneOutlined,
  FileProtectOutlined,
  FlagOutlined,
  SafetyCertificateOutlined,
  SafetyOutlined,
  SendOutlined,
  SolutionOutlined,
  StarOutlined,
  TeamOutlined,
  TrophyOutlined,
} from '@ant-design/icons';
import { useAuth } from '@/contexts/AuthContext';
import { ROLES } from '@/constants/roles.constants';
import { cn } from '@/lib/utils';

const DASHBOARD_BY_ROLE: Record<string, string> = {
  [ROLES.SUPER_ADMIN]: '/super-admin/dashboard',
  [ROLES.ADMIN]: '/admin/dashboard',
  [ROLES.MANAGER]: '/manager/dashboard',
  [ROLES.USER]: '/user/dashboard',
};

const CAPABILITIES = [
  {
    icon: <TeamOutlined />,
    title: 'Hồ sơ quân nhân tập trung',
    desc: 'Thông tin cá nhân, cấp bậc, chức vụ và lịch sử công tác quản lý trên một nền tảng.',
  },
  {
    icon: <FileProtectOutlined />,
    title: 'Đề xuất và xét duyệt nhiều cấp',
    desc: 'Luồng phê duyệt theo phân quyền, kiểm tra điều kiện và cảnh báo trùng lặp tự động.',
  },
  {
    icon: <AuditOutlined />,
    title: 'Quyết định và nhật ký hoạt động',
    desc: 'Ban hành quyết định khen thưởng, ghi nhật ký thao tác minh bạch theo từng tài khoản.',
  },
  {
    icon: <BarChartOutlined />,
    title: 'Thống kê và báo cáo',
    desc: 'Theo dõi tiến độ xử lý, tổng hợp số liệu và xuất báo cáo Excel theo đơn vị.',
  },
];

const AWARD_TYPES = [
  {
    icon: <StarOutlined />,
    name: 'Khen thưởng cá nhân hằng năm',
    desc: 'Danh hiệu CSTT, CSTĐCS, BKBQP, CSTĐTQ, BKTTCP.',
  },
  {
    icon: <ApartmentOutlined />,
    name: 'Khen thưởng đơn vị hằng năm',
    desc: 'Danh hiệu ĐVTT, ĐVQT, BKBQP, BKTTCP.',
  },
  {
    icon: <TrophyOutlined />,
    name: 'Huy chương Chiến sĩ vẻ vang',
    desc: 'Ba hạng Ba, Nhì, Nhất theo niên hạn phục vụ.',
  },
  {
    icon: <SafetyOutlined />,
    name: 'Huân chương Bảo vệ Tổ quốc',
    desc: 'Ba hạng Ba, Nhì, Nhất ghi nhận quá trình cống hiến.',
  },
  {
    icon: <FlagOutlined />,
    name: 'Huy chương Quân kỳ quyết thắng',
    desc: 'Yêu cầu đủ 25 năm phục vụ trong QĐNDVN.',
  },
  {
    icon: <CrownOutlined />,
    name: 'Kỷ niệm chương vì sự nghiệp xây dựng QĐNDVN',
    desc: 'Đủ 25 năm với nam, 20 năm với nữ phục vụ trong QĐNDVN.',
  },
  {
    icon: <ExperimentOutlined />,
    name: 'Thành tích nghiên cứu khoa học',
    desc: 'Đề tài khoa học và sáng kiến khoa học.',
  },
];

const WORKFLOW_STEPS = [
  {
    icon: <SendOutlined />,
    title: 'Tạo đề xuất',
    desc: 'Đơn vị lập đề xuất khen thưởng cho cá nhân hoặc tập thể.',
  },
  {
    icon: <SafetyCertificateOutlined />,
    title: 'Kiểm tra điều kiện',
    desc: 'Hệ thống tự động đối chiếu chuỗi danh hiệu và cảnh báo trùng lặp.',
  },
  {
    icon: <SolutionOutlined />,
    title: 'Phê duyệt nhiều cấp',
    desc: 'Luồng xét duyệt theo phân quyền từ đơn vị đến quản trị.',
  },
  {
    icon: <FileDoneOutlined />,
    title: 'Ra quyết định',
    desc: 'Ban hành quyết định và lưu hồ sơ khen thưởng đầy đủ.',
  },
];

const HEADLINE_PHRASES = ['danh hiệu thi đua', 'khen thưởng các cấp', 'thành tích khoa học'];

const TRUST_STATS = [
  { value: '7', label: 'Hình thức khen thưởng' },
  { value: '4', label: 'Cấp phê duyệt' },
  { value: '4', label: 'Vai trò phân quyền' },
  { value: 'Realtime', label: 'Thông báo tức thì' },
];

function Reveal({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`reveal${shown ? ' reveal-in' : ''}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

function TypingHeadline({ phrases }: { phrases: string[] }) {
  const [text, setText] = useState(phrases[0]);
  const [idx, setIdx] = useState(0);
  const [deleting, setDeleting] = useState(false);
  const [reduce, setReduce] = useState(false);

  useEffect(() => {
    setReduce(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }, []);

  useEffect(() => {
    if (reduce) return;
    const full = phrases[idx];
    if (!deleting && text === full) {
      const timeout = setTimeout(() => setDeleting(true), 1800);
      return () => clearTimeout(timeout);
    }
    if (deleting && text === '') {
      setDeleting(false);
      setIdx(prev => (prev + 1) % phrases.length);
      return;
    }
    const timeout = setTimeout(
      () => setText(deleting ? full.slice(0, text.length - 1) : full.slice(0, text.length + 1)),
      deleting ? 38 : 78
    );
    return () => clearTimeout(timeout);
  }, [text, idx, deleting, reduce, phrases]);

  return (
    <span className="text-amber-400">
      {text}
      {!reduce && (
        <span className="ml-1 inline-block h-[0.8em] w-[3px] translate-y-[0.06em] animate-pulse rounded-sm bg-amber-400 align-baseline" />
      )}
    </span>
  );
}

function CountUp({ target, duration = 1300 }: { target: number; duration?: number }) {
  const [value, setValue] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setValue(target);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || started.current) return;
        started.current = true;
        const start = performance.now();
        const tick = (now: number) => {
          const progress = Math.min((now - start) / duration, 1);
          const eased = 1 - Math.pow(1 - progress, 3);
          setValue(Math.round(eased * target));
          if (progress < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
        observer.disconnect();
      },
      { threshold: 0.6 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [target, duration]);

  return <span ref={ref}>{value}</span>;
}

export default function HomePage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const isLoggedIn = !!user;

  const [scrolled, setScrolled] = useState(false);
  const navSentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = navSentinelRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(([entry]) => setScrolled(!entry.isIntersecting), {
      threshold: 0,
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const handleRedirect = () => {
    if (!user) {
      router.push('/login');
      return;
    }
    router.push(DASHBOARD_BY_ROLE[user.role] ?? '/login');
  };

  const primaryLabel = isLoggedIn ? 'Vào hệ thống' : 'Đăng nhập';

  if (isLoading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-slate-950">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-amber-400/30 border-t-amber-400" />
      </div>
    );
  }

  return (
    <div className="landing-page relative min-h-[100dvh] overflow-hidden bg-slate-950 font-heading text-slate-100">
      <div className="fixed inset-0 z-0">
        <Image
          src="/BG%20HVKHQS.jpg"
          alt=""
          fill
          priority
          sizes="100vw"
          quality={90}
          className="object-cover"
        />
        <div className="absolute inset-0 bg-slate-950/22" />
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950/10 via-transparent to-slate-950/15" />
      </div>
      <div className="pointer-events-none fixed inset-0 z-0 bg-grid-faint opacity-50" />
      <div className="animate-glow-breathe pointer-events-none absolute -top-40 right-0 h-[440px] w-[440px] rounded-full bg-amber-500/[0.06] blur-[150px]" />
      <div
        className="animate-glow-breathe pointer-events-none absolute top-[38%] -left-40 h-[480px] w-[480px] rounded-full bg-sky-500/[0.09] blur-[150px]"
        style={{ animationDelay: '2.5s' }}
      />
      <div
        className="animate-glow-breathe pointer-events-none absolute bottom-[6%] right-[10%] h-[440px] w-[440px] rounded-full bg-amber-500/[0.08] blur-[150px]"
        style={{ animationDelay: '4s' }}
      />

      <div ref={navSentinelRef} className="absolute top-0 h-px w-full" />
      <header className="fixed inset-x-0 top-0 z-50 px-4">
        <div
          className={cn(
            'pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-slate-950/80 to-transparent transition-opacity duration-300',
            scrolled ? 'opacity-0' : 'opacity-100'
          )}
        />
        <div
          className={cn(
            'relative mx-auto flex items-center justify-between rounded-full transition-all duration-300',
            scrolled
              ? 'mt-3 max-w-5xl bg-slate-950/85 px-5 py-2.5 shadow-xl shadow-black/40 ring-1 ring-white/[0.06] backdrop-blur-xl'
              : 'h-[72px] max-w-7xl px-2 lg:px-4'
          )}
        >
          <div className="flex items-center gap-3">
            <Image
              src="/logo-msa.png"
              alt="Logo Học viện Khoa học Quân sự"
              width={40}
              height={40}
              className="rounded-lg"
              priority
            />
            <div className="hidden leading-tight sm:block">
              <p className="text-sm font-bold tracking-wide text-white">
                HỌC VIỆN KHOA HỌC QUÂN SỰ
              </p>
              <p className="text-xs text-slate-400">Bộ Quốc phòng</p>
            </div>
          </div>
          <button
            onClick={handleRedirect}
            className="rounded-lg border border-white/15 bg-white/5 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/10 active:translate-y-px"
          >
            {primaryLabel}
          </button>
        </div>
      </header>

      <section className="relative z-10 overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-slate-950/75 via-slate-950/20 to-transparent" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(50%_55%_at_72%_30%,rgba(251,191,36,0.06),transparent_65%)]" />

        <div className="relative mx-auto flex min-h-[100dvh] max-w-7xl items-center px-6 pb-32 pt-28 lg:px-8 lg:pt-32">
          <div className="max-w-3xl animate-slide-up">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-amber-400/25 bg-amber-400/[0.1] px-4 py-1.5 backdrop-blur-sm">
              <SafetyCertificateOutlined className="text-sm text-amber-400" />
              <span className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-300">
                Hệ thống nghiệp vụ nội bộ
              </span>
            </div>
            <h1 className="text-5xl font-extrabold leading-[1.08] tracking-tight text-white drop-shadow-[0_2px_24px_rgba(0,0,0,0.5)] lg:text-7xl">
              Quản lý khen thưởng
              <br />
              và <TypingHeadline phrases={HEADLINE_PHRASES} />
            </h1>
            <p className="mt-6 max-w-xl text-pretty text-base leading-relaxed text-slate-200 lg:text-lg">
              Số hóa quy trình đề xuất, xét duyệt và quyết định khen thưởng tại{' '}
              <span className="whitespace-nowrap">Học viện Khoa học Quân sự</span>.
            </p>
            <div className="mt-9 flex flex-col gap-4 sm:flex-row sm:items-center">
              <button
                onClick={handleRedirect}
                className="cta-shimmer group inline-flex items-center justify-center gap-2 rounded-lg bg-amber-400 px-7 py-3.5 text-sm font-bold text-slate-950 shadow-lg shadow-amber-500/20 transition-all hover:bg-amber-300 hover:shadow-amber-500/30 active:translate-y-px"
              >
                {primaryLabel}
                <ArrowRightOutlined className="transition-transform group-hover:translate-x-0.5" />
              </button>
              <a
                href="#nang-luc"
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/20 bg-white/5 px-7 py-3.5 text-sm font-semibold text-slate-100 backdrop-blur-sm transition-colors hover:border-white/35 hover:bg-white/10"
              >
                Tìm hiểu thêm
              </a>
            </div>
          </div>
        </div>
      </section>

      <div className="relative z-10 bg-slate-950/85">
        <div className="pointer-events-none absolute inset-x-0 -top-44 h-44 bg-gradient-to-b from-transparent to-slate-950/85" />
        <section className="relative border-y border-white/10 backdrop-blur-md">
          <div className="mx-auto grid max-w-7xl grid-cols-2 divide-white/10 px-6 py-10 sm:divide-x lg:grid-cols-4 lg:px-8">
            {TRUST_STATS.map((stat, i) => (
              <div key={stat.label} className="px-2 py-3 text-center sm:px-6">
                <Reveal delay={i * 90}>
                  <div className="text-3xl font-bold text-amber-400 lg:text-4xl">
                    {/^\d+$/.test(stat.value) ? (
                      <CountUp target={Number(stat.value)} />
                    ) : (
                      stat.value
                    )}
                  </div>
                  <div className="mt-1 text-sm text-slate-400">{stat.label}</div>
                </Reveal>
              </div>
            ))}
          </div>
        </section>

        <section
          id="nang-luc"
          className="relative z-10 mx-auto max-w-7xl px-6 py-20 lg:px-8 lg:py-28"
        >
          <div className="grid gap-12 lg:grid-cols-[0.9fr_1.4fr] lg:gap-16">
            <div className="lg:sticky lg:top-24 lg:self-start">
              <p className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-amber-400">
                Năng lực hệ thống
              </p>
              <h2 className="text-3xl font-bold leading-tight text-white lg:text-4xl">
                Một nền tảng cho toàn bộ công tác thi đua khen thưởng
              </h2>
              <p className="mt-5 max-w-md leading-relaxed text-slate-400">
                Thiết kế riêng cho môi trường quân đội, bám sát quy trình nghiệp vụ từ hồ sơ đến
                quyết định.
              </p>
              <button
                onClick={handleRedirect}
                className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-amber-400 transition-colors hover:text-amber-300"
              >
                Bắt đầu sử dụng
                <ArrowRightOutlined />
              </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {CAPABILITIES.map((cap, i) => (
                <Reveal key={cap.title} delay={i * 80}>
                  <div className="group h-full rounded-2xl border border-white/10 bg-gradient-to-b from-slate-800/75 to-slate-900/80 p-6 shadow-lg shadow-black/30 transition-all hover:-translate-y-1 hover:border-amber-400/40 hover:shadow-amber-500/10">
                    <span className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-amber-400/10 text-xl text-amber-400 transition-colors group-hover:bg-amber-400/20">
                      {cap.icon}
                    </span>
                    <h3 className="text-lg font-semibold text-white">{cap.title}</h3>
                    <p className="mt-2 leading-relaxed text-slate-400">{cap.desc}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section className="relative z-10 border-t border-white/[0.06] bg-white/[0.02]">
          <div className="mx-auto max-w-7xl px-6 py-20 lg:px-8 lg:py-24">
            <div className="mb-12 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <TrophyOutlined className="text-2xl text-amber-400" />
                  <h2 className="text-3xl font-bold text-white lg:text-4xl">
                    Bảy hình thức khen thưởng
                  </h2>
                </div>
                <p className="mt-4 max-w-2xl leading-relaxed text-slate-400">
                  Hỗ trợ đầy đủ khen thưởng cá nhân và đơn vị, kèm kiểm tra điều kiện theo chuỗi
                  danh hiệu.
                </p>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {AWARD_TYPES.map((type, i) => (
                <Reveal key={type.name} delay={(i % 4) * 70}>
                  <div
                    onMouseMove={e => {
                      const t = e.currentTarget;
                      const r = t.getBoundingClientRect();
                      t.style.setProperty('--mx', `${e.clientX - r.left}px`);
                      t.style.setProperty('--my', `${e.clientY - r.top}px`);
                    }}
                    className="spotlight group relative h-full overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-slate-800/75 to-slate-900/80 p-6 shadow-lg shadow-black/30 transition-all hover:-translate-y-1 hover:border-amber-400/40 hover:shadow-amber-500/10"
                  >
                    <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-amber-400/[0.06] blur-2xl transition-opacity group-hover:bg-amber-400/15" />
                    <span className="relative mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-amber-400/10 text-xl text-amber-400">
                      {type.icon}
                    </span>
                    <h3 className="relative text-base font-semibold text-white">{type.name}</h3>
                    <p className="relative mt-2 text-sm leading-relaxed text-slate-400">
                      {type.desc}
                    </p>
                  </div>
                </Reveal>
              ))}
              <Reveal delay={210}>
                <button
                  onClick={handleRedirect}
                  className="group flex h-full w-full flex-col justify-between rounded-2xl border border-amber-400/30 bg-gradient-to-br from-amber-400/15 to-amber-400/[0.03] p-6 text-left transition-all hover:-translate-y-1 hover:from-amber-400/25"
                >
                  <CrownOutlined className="text-2xl text-amber-400" />
                  <span className="mt-6 inline-flex items-center gap-2 text-base font-bold text-white">
                    Khám phá toàn bộ
                    <ArrowRightOutlined className="text-amber-400 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </button>
              </Reveal>
            </div>
          </div>
        </section>

        <section className="relative z-10 mx-auto max-w-7xl px-6 py-20 lg:px-8 lg:py-24">
          <div className="mx-auto max-w-2xl text-center">
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-amber-400">
              Quy trình khép kín
            </p>
            <h2 className="text-3xl font-bold text-white lg:text-4xl">Từ đề xuất đến quyết định</h2>
          </div>
          <div className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {WORKFLOW_STEPS.map((step, i) => (
              <Reveal key={step.title} delay={i * 90}>
                <div className="relative h-full rounded-2xl border border-white/10 bg-gradient-to-b from-slate-800/75 to-slate-900/80 p-6 shadow-lg shadow-black/30 transition-all hover:-translate-y-1 hover:border-amber-400/30">
                  <span className="absolute right-5 top-5 text-5xl font-extrabold text-amber-300/50">
                    {i + 1}
                  </span>
                  <span className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-amber-400/10 text-xl text-amber-400">
                    {step.icon}
                  </span>
                  <h3 className="text-lg font-semibold text-white">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-400">{step.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        <section className="relative z-10 border-t border-white/[0.06]">
          <div className="mx-auto max-w-7xl px-6 py-20 lg:px-8 lg:py-24">
            <div className="overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900/80 to-slate-950">
              <div className="grid gap-10 p-8 md:grid-cols-3 lg:gap-16 lg:p-12">
                <div className="md:col-span-2">
                  <h2 className="text-2xl font-bold text-white lg:text-3xl">Về hệ thống</h2>
                  <p className="mt-5 max-w-2xl leading-relaxed text-slate-400">
                    Giải pháp công nghệ phục vụ công tác thi đua khen thưởng tại Học viện Khoa học
                    Quân sự, số hóa toàn bộ quy trình từ đề xuất, xét duyệt đến ra quyết định, bảo
                    đảm tính minh bạch và chính xác.
                  </p>
                  <div className="mt-8 flex flex-wrap gap-3">
                    <span className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200">
                      Bảo mật dữ liệu
                    </span>
                    <span className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200">
                      Nhật ký thao tác
                    </span>
                    <span className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200">
                      Sao lưu định kỳ
                    </span>
                  </div>
                </div>
                <div className="md:border-l md:border-white/10 md:pl-10 lg:pl-16">
                  <h3 className="text-lg font-bold text-white">Liên hệ</h3>
                  <div className="mt-4 space-y-2 text-sm leading-relaxed text-slate-400">
                    <p>Học viện Khoa học Quân sự</p>
                    <p>322E Lê Trọng Tấn, Thanh Xuân, Hà Nội</p>
                    <p>Email: support@hvkhqs.edu.vn</p>
                    <p>Hotline: (+84) 24 6328 1853</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <footer className="relative z-10 border-t border-white/[0.06]">
          <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-6 py-6 text-sm text-slate-500 sm:flex-row lg:px-8">
            <p>© 2026 Học viện Khoa học Quân sự. Bản quyền thuộc về HVKHQS.</p>
            <p>Phát triển bởi Sinh viên CNTT - HVKHQS</p>
          </div>
        </footer>
      </div>
    </div>
  );
}
