'use client';

import { ReactNode } from 'react';
import Image from 'next/image';
import { Empty } from 'antd';
import { TrophyOutlined, FileTextOutlined, CalendarOutlined } from '@ant-design/icons';
import { DANH_HIEU_CA_NHAN_HANG_NAM, DANH_HIEU_MAP } from '@/constants/danhHieu.constants';
import { AWARD_ICONS } from '@/constants/awardIcons.constants';
import type { AnnualRewardRow } from '@/app/user/profile/types';

type TierKey = 'TONG' | 'CSTDCS' | 'CSTT' | 'BKBQP' | 'CSTDTQ' | 'BKTTCP' | 'FALLBACK';

interface TierStyle {
  label: string;
  accent: string;
  soft: string;
  /** Line-icon fallback, only for tiers without a PNG (TONG, FALLBACK). */
  icon?: ReactNode;
}

interface TimelineEntry {
  key: string;
  tier: TierKey;
  label: string;
  soQuyetDinh?: string;
}

interface AnnualTitleTimelineProps {
  rewards: AnnualRewardRow[];
  isDark: boolean;
  onOpenDecision: (soQuyetDinh: string) => void;
}

const TIER_RANK: Record<TierKey, number> = {
  TONG: 0,
  FALLBACK: 0,
  CSTDCS: 1,
  CSTT: 1,
  BKBQP: 2,
  CSTDTQ: 3,
  BKTTCP: 4,
};

const STAT_KEYS: TierKey[] = ['TONG', 'CSTDCS', 'BKBQP', 'CSTDTQ', 'BKTTCP'];

const TIER_ICON_SRC: Partial<Record<TierKey, string>> = {
  CSTDCS: AWARD_ICONS.CSTDCS,
  CSTT: AWARD_ICONS.CSTT,
  BKBQP: AWARD_ICONS.BKBQP,
  CSTDTQ: AWARD_ICONS.CSTDTQ,
  BKTTCP: AWARD_ICONS.BKTTCP,
};

function renderTierIcon(
  tierKey: TierKey,
  fallback: ReactNode,
  accent: string,
  size: number
): ReactNode {
  const src = TIER_ICON_SRC[tierKey];
  if (src) {
    return <Image src={src} alt="" width={size} height={size} className="object-contain" />;
  }
  return (
    <span style={{ color: accent, fontSize: Math.round(size * 0.7), lineHeight: 1 }}>
      {fallback}
    </span>
  );
}

/**
 * Tier visual identity shared by the summary band and the timeline so a single
 * accent color always means the same award tier (ascending prestige: emerald
 * base, amber, orange, violet apex). Neutral blue anchors the meta "total" stat.
 */
function buildTierStyles(isDark: boolean): Record<TierKey, TierStyle> {
  if (isDark) {
    return {
      TONG: {
        label: 'Tổng số năm',
        icon: <CalendarOutlined />,
        accent: '#60a5fa',
        soft: 'rgba(96,165,250,0.14)',
      },
      CSTDCS: { label: 'CSTĐ Cơ sở', accent: '#34d399', soft: 'rgba(52,211,153,0.14)' },
      CSTT: { label: 'Chiến sĩ tiên tiến', accent: '#38bdf8', soft: 'rgba(56,189,248,0.14)' },
      BKBQP: { label: 'BK Bộ trưởng BQP', accent: '#fbbf24', soft: 'rgba(251,191,36,0.14)' },
      CSTDTQ: { label: 'CSTĐ Toàn quân', accent: '#fb923c', soft: 'rgba(251,146,60,0.14)' },
      BKTTCP: { label: 'BK Thủ tướng CP', accent: '#a78bfa', soft: 'rgba(167,139,250,0.16)' },
      FALLBACK: {
        label: '',
        icon: <TrophyOutlined />,
        accent: '#9ca3af',
        soft: 'rgba(156,163,175,0.14)',
      },
    };
  }
  return {
    TONG: {
      label: 'Tổng số năm',
      icon: <CalendarOutlined />,
      accent: '#2563eb',
      soft: 'rgba(37,99,235,0.08)',
    },
    CSTDCS: { label: 'CSTĐ Cơ sở', accent: '#059669', soft: 'rgba(5,150,105,0.08)' },
    CSTT: { label: 'Chiến sĩ tiên tiến', accent: '#0284c7', soft: 'rgba(2,132,199,0.08)' },
    BKBQP: { label: 'BK Bộ trưởng BQP', accent: '#d97706', soft: 'rgba(217,119,6,0.10)' },
    CSTDTQ: { label: 'CSTĐ Toàn quân', accent: '#ea580c', soft: 'rgba(234,88,12,0.09)' },
    BKTTCP: { label: 'BK Thủ tướng CP', accent: '#7c3aed', soft: 'rgba(124,58,237,0.08)' },
    FALLBACK: {
      label: '',
      icon: <TrophyOutlined />,
      accent: '#6b7280',
      soft: 'rgba(107,114,128,0.08)',
    },
  };
}

function groupByYearDesc(rewards: AnnualRewardRow[]): [number, AnnualRewardRow[]][] {
  const byYear = rewards.reduce((acc: Record<number, AnnualRewardRow[]>, reward) => {
    (acc[reward.nam] ??= []).push(reward);
    return acc;
  }, {});
  return Object.entries(byYear)
    .map(([year, list]): [number, AnnualRewardRow[]] => [Number(year), list])
    .sort(([a], [b]) => b - a);
}

function buildEntries(yearRewards: AnnualRewardRow[]): TimelineEntry[] {
  const entries: TimelineEntry[] = [];

  yearRewards.forEach((reward, index) => {
    const rowId = reward.id ?? `${reward.nam}-${index}`;

    if (reward.danh_hieu) {
      const tier: TierKey =
        reward.danh_hieu === DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS
          ? 'CSTDCS'
          : reward.danh_hieu === DANH_HIEU_CA_NHAN_HANG_NAM.CSTT
            ? 'CSTT'
            : 'FALLBACK';
      entries.push({
        key: `${rowId}-base`,
        tier,
        label: DANH_HIEU_MAP[reward.danh_hieu] || reward.danh_hieu,
        soQuyetDinh: reward.so_quyet_dinh?.trim() || undefined,
      });
    }

    if (reward.nhan_bkbqp && reward.so_quyet_dinh_bkbqp?.trim()) {
      entries.push({
        key: `${rowId}-bkbqp`,
        tier: 'BKBQP',
        label: DANH_HIEU_MAP.BKBQP,
        soQuyetDinh: reward.so_quyet_dinh_bkbqp,
      });
    }
    if (reward.nhan_cstdtq && reward.so_quyet_dinh_cstdtq?.trim()) {
      entries.push({
        key: `${rowId}-cstdtq`,
        tier: 'CSTDTQ',
        label: DANH_HIEU_MAP.CSTDTQ,
        soQuyetDinh: reward.so_quyet_dinh_cstdtq,
      });
    }
    if (reward.nhan_bkttcp && reward.so_quyet_dinh_bkttcp?.trim()) {
      entries.push({
        key: `${rowId}-bkttcp`,
        tier: 'BKTTCP',
        label: DANH_HIEU_MAP.BKTTCP,
        soQuyetDinh: reward.so_quyet_dinh_bkttcp,
      });
    }
  });

  return entries.sort((a, b) => TIER_RANK[b.tier] - TIER_RANK[a.tier]);
}

/**
 * Annual personal-title profile tab: a tier-coded summary band over an editorial
 * timeline. Year markers take the color of the highest honor earned that year.
 * @param rewards - Annual reward rows for the personnel
 * @param isDark - Whether dark mode is active
 * @param onOpenDecision - Opens the decision-number file when a QĐ link is clicked
 * @returns Rendered summary band and award timeline, or an empty state
 */
export function AnnualTitleTimeline({ rewards, isDark, onOpenDecision }: AnnualTitleTimelineProps) {
  if (rewards.length === 0) {
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description={
          <span className="text-gray-500 dark:text-gray-400">
            Chưa có dữ liệu danh hiệu hằng năm
          </span>
        }
        style={{ padding: '60px 0' }}
      />
    );
  }

  const tier = buildTierStyles(isDark);
  const muted = isDark ? '#94a3b8' : '#64748b';
  const rail = isDark ? '#334155' : '#e2e8f0';
  const surface = isDark ? '#1f2937' : '#ffffff';
  const panelBg = isDark ? 'rgba(255,255,255,0.025)' : 'rgba(15,23,42,0.02)';
  const panelBorder = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(15,23,42,0.07)';
  const tileBg = isDark ? 'rgba(255,255,255,0.05)' : '#ffffff';
  const tileBorder = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)';

  const counts: Record<TierKey, number> = {
    TONG: new Set(rewards.map(r => r.nam)).size,
    CSTDCS: rewards.filter(r => r.danh_hieu === DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS).length,
    CSTT: rewards.filter(r => r.danh_hieu === DANH_HIEU_CA_NHAN_HANG_NAM.CSTT).length,
    BKBQP: rewards.filter(r => r.nhan_bkbqp).length,
    CSTDTQ: rewards.filter(r => r.nhan_cstdtq).length,
    BKTTCP: rewards.filter(r => r.nhan_bkttcp).length,
    FALLBACK: 0,
  };

  const years = groupByYearDesc(rewards);

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {STAT_KEYS.map(key => {
          const s = tier[key];
          const isLead = key === 'TONG';
          return (
            <div
              key={key}
              className="flex flex-col items-center gap-3 rounded-2xl px-4 py-5 text-center"
              style={{ background: tileBg, border: `1px solid ${tileBorder}` }}
            >
              <span
                className="flex h-12 w-12 items-center justify-center rounded-xl"
                style={{ background: `${s.accent}26`, border: `1px solid ${s.accent}40` }}
              >
                {renderTierIcon(key, s.icon, s.accent, 30)}
              </span>
              <div className="flex flex-col items-center gap-1">
                <span
                  className="font-bold leading-none"
                  style={{ color: s.accent, fontSize: isLead ? 32 : 28 }}
                >
                  {counts[key]}
                </span>
                <span className="text-xs leading-tight" style={{ color: muted }}>
                  {s.label}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="relative">
        <div
          className="absolute w-px"
          style={{ left: 27, top: 28, bottom: 16, background: rail }}
        />
        <div className="space-y-7">
          {years.map(([year, yearRewards]) => {
            const entries = buildEntries(yearRewards);
            const node = tier[entries[0]?.tier ?? 'CSTDCS'];
            return (
              <div key={year} className="relative pl-[5.25rem]">
                <div
                  className="absolute left-0 top-1 flex h-14 w-14 items-center justify-center rounded-full"
                  style={{
                    background: `linear-gradient(${node.soft}, ${node.soft}), ${surface}`,
                    color: node.accent,
                    border: `1.5px solid ${node.accent}`,
                  }}
                >
                  <span className="text-sm font-bold tracking-tight">{year}</span>
                </div>

                <div
                  className="overflow-hidden rounded-2xl"
                  style={{ background: panelBg, border: `1px solid ${panelBorder}` }}
                >
                  {entries.map((entry, index) => {
                    const es = tier[entry.tier];
                    return (
                      <div
                        key={entry.key}
                        className={`flex items-center justify-between gap-4 px-3 py-3 transition-colors hover:bg-black/[0.03] dark:hover:bg-white/[0.05] ${
                          index > 0 ? 'border-t border-black/5 dark:border-white/[0.06]' : ''
                        }`}
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <span
                            className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl"
                            style={{
                              background: `${es.accent}1f`,
                              border: `1px solid ${es.accent}3a`,
                            }}
                          >
                            {renderTierIcon(entry.tier, es.icon, es.accent, 38)}
                          </span>
                          <span className="truncate font-semibold" style={{ color: es.accent }}>
                            {entry.label}
                          </span>
                        </div>
                        {entry.soQuyetDinh && (
                          <a
                            onClick={e => {
                              e.preventDefault();
                              e.stopPropagation();
                              onOpenDecision(entry.soQuyetDinh!);
                            }}
                            className="flex flex-shrink-0 cursor-pointer items-center gap-1.5 text-[13px] font-medium hover:underline"
                            style={{ color: es.accent }}
                          >
                            <FileTextOutlined style={{ fontSize: 12 }} />
                            <span style={{ color: muted }}>Số QĐ:</span>
                            {entry.soQuyetDinh}
                          </a>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
