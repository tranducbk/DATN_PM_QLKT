import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import dayjs from 'dayjs';
import type { DateInput, DatePoint } from './types';

/**
 * Merges class names with Tailwind conflict resolution.
 * @param inputs - Class name values
 * @returns Merged class string
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Calculates duration between two dates using calendar-month logic.
 * Uses the same approach as backend for consistency.
 * @param startDate - Start date (string or Date)
 * @param endDate - End date (string or Date), defaults to current date
 * @returns Human-readable duration (e.g. "2 years 6 months", "3 months", "15 days")
 */
export function calculateDuration(startDate: DatePoint, endDate?: DatePoint): string {
  const start = new Date(startDate);
  const end = endDate ? new Date(endDate) : new Date();

  // Calculate actual calendar-month difference (same as backend).
  let months = (end.getFullYear() - start.getFullYear()) * 12;
  months += end.getMonth() - start.getMonth();

  // If day-of-month at end is smaller than start day, subtract one month.
  if (end.getDate() < start.getDate()) {
    months--;
  }

  // Ensure non-negative result.
  months = Math.max(0, months);

  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;

  // For periods under one month, display day count.
  if (months === 0) {
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return `${diffDays} ngày`;
  }

  // Display years and months.
  if (years > 0 && remainingMonths > 0) {
    return `${years} năm ${remainingMonths} tháng`;
  } else if (years > 0) {
    return `${years} năm`;
  } else {
    return `${remainingMonths} tháng`;
  }
}

/**
 * Formats date as `DD/MM/YYYY`.
 * @param date - Input date (string, Date, or nullish)
 * @returns Formatted date string or `-` for nullish values
 */
export function formatDate(date: DateInput): string {
  if (!date) return '-';
  return dayjs(date).format('DD/MM/YYYY');
}

/**
 * Formats date-time as `DD/MM/YYYY HH:mm`.
 * @param date - Input date (string, Date, or nullish)
 * @returns Formatted date-time string or `-` for nullish values
 */
export function formatDateTime(date: DateInput): string {
  if (!date) return '-';
  return dayjs(date).format('DD/MM/YYYY HH:mm');
}

/**
 * Formats date-time as `DD/MM/YYYY HH:mm:ss`.
 * @param date - Input date (string, Date, or nullish)
 * @returns Formatted timestamp string or `-` for nullish values
 */
export function formatDateTimeFull(date: DateInput): string {
  if (!date) return '-';
  return dayjs(date).format('DD/MM/YYYY HH:mm:ss');
}

/**
 * Calculates total personnel count for a unit including subordinate units.
 * @param unit - Unit record with own and subordinate counts
 * @returns Total personnel count
 */
export function calcUnitTotal(unit: { so_luong?: number; DonViTrucThuoc?: { so_luong?: number }[] }): number {
  const own = unit.so_luong ?? 0;
  const children = (unit.DonViTrucThuoc ?? []).reduce((sum, sub) => sum + (sub.so_luong ?? 0), 0);
  return own + children;
}

/**
 * Capitalizes only the first character of a string.
 * Handles Vietnamese diacritics correctly via Unicode toUpperCase.
 * @param value - Raw input string
 * @returns String with first character uppercased
 */
export function capitalizeFirst(value: string): string {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/**
 * Capitalizes the first letter of each word.
 * Handles Vietnamese diacritics correctly via Unicode toUpperCase.
 * @param value - Raw input string
 * @returns String with each word capitalized
 */
export function capitalizeWords(value: string): string {
  if (!value) return value;
  return value
    .split(' ')
    .map(word => (word ? word.charAt(0).toUpperCase() + word.slice(1) : word))
    .join(' ');
}
