/**
 * Danh sách origin FE (HTTP CORS + Socket.IO) — một nguồn, tránh lệch khi deploy.
 * `.env`: ALLOWED_ORIGINS=https://a.com,https://b.com
 */
export function getAllowedOrigins(): string[] {
  return process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
    : ['http://localhost:3000', 'http://localhost:3001'];
}

/** Callback dùng chung cho `cors` (Express) và `Server` (Socket.IO). */
export function allowCorsOrigin(
  origin: string | undefined,
  callback: (err: Error | null, allow?: boolean) => void
): void {
  const allowed = getAllowedOrigins();
  if (!origin) return callback(null, true);
  if (allowed.includes(origin)) callback(null, true);
  else callback(new Error('Not allowed by CORS'));
}
