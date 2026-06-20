import type { Request, Response } from 'express';

export interface AuditLogOptions {
  action: string;
  resource: string;
  getResourceId?: (req: Request, res: Response, responseData: unknown) => string | null;
  getDescription?: (req: Request, res: Response, responseData: unknown) => string | Promise<string>;
  getPayload?: (req: Request, res: Response, responseData: unknown) => unknown;
}
