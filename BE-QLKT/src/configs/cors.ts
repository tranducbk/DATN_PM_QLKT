const allowedOrigins: string[] = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : ['http://localhost:3000', 'http://localhost:3001'];

/**
 * Allowlist loaded once from `ALLOWED_ORIGINS` (comma-separated) with localhost dev defaults.
 * @returns Parsed origin strings used by `allowCorsOrigin`
 */
export function getAllowedOrigins(): string[] {
  return allowedOrigins;
}

/**
 * `cors` / Socket.IO-compatible origin gate: missing `Origin` is allowed (non-browser clients).
 * @param origin - `Origin` request header
 * @param callback - `(err, allow)` as required by `cors`
 * @returns void
 */
export function allowCorsOrigin(
  origin: string | undefined,
  callback: (err: Error | null, allow?: boolean) => void
): void {
  const allowed = getAllowedOrigins();
  if (!origin) return callback(null, true);
  if (allowed.includes(origin)) callback(null, true);
  else callback(new Error('Not allowed by CORS'));
}
