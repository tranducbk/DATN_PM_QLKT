/**
 * Formats a date value to `DD-MM-YYYY`.
 * @param dateStr - Date object or date string
 * @returns Formatted date string, or empty string when invalid
 */
const formatDate = (dateStr: Date | string | null | undefined): string => {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      return '';
    }
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  } catch {
    return '';
  }
};

export { formatDate };
