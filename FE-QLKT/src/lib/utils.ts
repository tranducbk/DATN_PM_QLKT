import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import dayjs from 'dayjs';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Tính khoảng thời gian giữa 2 ngày theo tháng lịch (chính xác)
 * Sử dụng cùng logic với backend để đồng nhất
 * @param startDate - Ngày bắt đầu (string hoặc Date)
 * @param endDate - Ngày kết thúc (string hoặc Date), mặc định là ngày hiện tại
 * @returns Chuỗi mô tả thời gian (VD: "2 năm 6 tháng", "3 tháng", "15 ngày")
 */
export function calculateDuration(startDate: string | Date, endDate?: string | Date): string {
  const start = new Date(startDate);
  const end = endDate ? new Date(endDate) : new Date();

  // Tính số tháng thực tế theo lịch (giống backend)
  let months = (end.getFullYear() - start.getFullYear()) * 12;
  months += end.getMonth() - start.getMonth();

  // Nếu ngày kết thúc < ngày bắt đầu trong tháng thì trừ 1 tháng
  if (end.getDate() < start.getDate()) {
    months--;
  }

  // Đảm bảo không âm
  months = Math.max(0, months);

  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;

  // Nếu dưới 1 tháng, hiển thị số ngày
  if (months === 0) {
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return `${diffDays} ngày`;
  }

  // Hiển thị năm và tháng
  if (years > 0 && remainingMonths > 0) {
    return `${years} năm ${remainingMonths} tháng`;
  } else if (years > 0) {
    return `${years} năm`;
  } else {
    return `${remainingMonths} tháng`;
  }
}

/**
 * Format ngày tháng với số 0 đứng trước (VD: 03/05/2010)
 * @param date - Ngày cần format (string, Date, hoặc null/undefined)
 * @returns Chuỗi ngày tháng đã format hoặc '-' nếu null/undefined
 */
export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return '-';
  return dayjs(date).format('DD/MM/YYYY');
}

/**
 * Format ngày tháng và giờ với số 0 đứng trước (VD: 03/05/2010 14:30)
 * @param date - Ngày cần format (string, Date, hoặc null/undefined)
 * @returns Chuỗi ngày tháng giờ đã format hoặc '-' nếu null/undefined
 */
export function formatDateTime(date: string | Date | null | undefined): string {
  if (!date) return '-';
  return dayjs(date).format('DD/MM/YYYY HH:mm');
}

/**
 * Format ngày tháng và giờ phút giây với số 0 đứng trước (VD: 03/05/2010 14:30:45)
 * @param date - Ngày cần format (string, Date, hoặc null/undefined)
 * @returns Chuỗi ngày tháng giờ phút giây đã format hoặc '-' nếu null/undefined
 */
export function formatDateTimeFull(date: string | Date | null | undefined): string {
  if (!date) return '-';
  return dayjs(date).format('DD/MM/YYYY HH:mm:ss');
}
