export function calculateYearsOfService(ngayNhapNgu: string): number {
  if (!ngayNhapNgu) return 0;
  const now = new Date();
  const nhapNgu = new Date(ngayNhapNgu);
  const months =
    (now.getFullYear() - nhapNgu.getFullYear()) * 12 + now.getMonth() - nhapNgu.getMonth();
  return Math.floor(Math.max(0, months) / 12);
}

export function convertMonthsToYearsAndMonths(totalMonths: number): {
  years: number;
  months: number;
} {
  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  return { years, months };
}
