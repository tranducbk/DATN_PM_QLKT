import type { Request, Response } from 'express';

export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
}

export interface PaginatedData<T> {
  items: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface AuditLogOptions {
  action: string;
  resource: string;
  getResourceId?: (req: Request, res: Response, responseData: unknown) => string | null;
  getDescription?: (req: Request, res: Response, responseData: unknown) => string | Promise<string>;
  getPayload?: (req: Request, res: Response, responseData: unknown) => unknown;
}
