const WEEKDAY: Record<string, string> = {
  '0': 'Chủ nhật',
  '7': 'Chủ nhật',
  '1': 'Thứ 2',
  '2': 'Thứ 3',
  '3': 'Thứ 4',
  '4': 'Thứ 5',
  '5': 'Thứ 6',
  '6': 'Thứ 7',
};

const pad2 = (value: string): string => value.padStart(2, '0');

/**
 * Turns a 5-field cron expression into a readable Vietnamese phrase for logs/UI.
 * Falls back to the raw cron string for patterns it does not recognize.
 * @param cron - Cron expression (minute hour day-of-month month day-of-week)
 * @returns Human-readable schedule, e.g. "hằng ngày lúc 02:00"
 */
export function describeCron(cron: string): string {
  const parts = (cron || '').trim().split(/\s+/);
  if (parts.length !== 5) return cron;
  const [minute, hour, dom, month, dow] = parts;
  const everyOther = dom === '*' && month === '*' && dow === '*';

  if (/^\*\/\d+$/.test(minute) && hour === '*' && everyOther) {
    return `mỗi ${minute.slice(2)} phút`;
  }
  if (minute === '0' && /^\*\/\d+$/.test(hour) && everyOther) {
    return `mỗi ${hour.slice(2)} giờ`;
  }
  if (minute === '0' && hour === '*' && everyOther) {
    return 'mỗi giờ';
  }

  if (/^\d+$/.test(minute) && /^\d+$/.test(hour)) {
    const time = `${pad2(hour)}:${pad2(minute)}`;
    if (dom === '*' && month === '*' && /^\d+$/.test(dow)) {
      return `hằng tuần vào ${WEEKDAY[dow] ?? `thứ ${dow}`} lúc ${time}`;
    }
    if (/^\d+$/.test(dom) && month === '*' && dow === '*') {
      return `ngày ${dom} hằng tháng lúc ${time}`;
    }
    if (everyOther) {
      return `hằng ngày lúc ${time}`;
    }
  }

  return cron;
}
