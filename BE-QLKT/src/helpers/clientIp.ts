import os from 'os';
import type { Request } from 'express';

let cachedLanIp: string | null = null;

/** First non-internal IPv4 of the host (LAN address); cached after first lookup. */
function lanIPv4(): string {
  if (cachedLanIp) return cachedLanIp;
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name] ?? []) {
      if (net.family === 'IPv4' && !net.internal) {
        cachedLanIp = net.address;
        return cachedLanIp;
      }
    }
  }
  cachedLanIp = '127.0.0.1';
  return cachedLanIp;
}

const LOOPBACK = new Set(['::1', '127.0.0.1', '']);

/**
 * Resolves the client IP. Honors `trust proxy` (req.ip reads X-Forwarded-For in
 * production), strips the IPv4-mapped IPv6 prefix, and for loopback requests
 * (local dev) substitutes the host's LAN IPv4 so logs show a real address, not ::1.
 * @param req - Express request
 * @returns Client IP string
 */
export function getClientIp(req: Request): string {
  const raw = (req.ip || req.socket.remoteAddress || '').replace(/^::ffff:/, '');
  return LOOPBACK.has(raw) ? lanIPv4() : raw;
}
