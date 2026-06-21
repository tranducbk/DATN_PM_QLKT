export interface DevStatus {
  cron: {
    enabled: boolean;
    schedule: string;
    lastRun: string | null;
    lastResult: {
      status: string;
      time: string;
      success?: number;
      errors?: number;
      message?: string;
    } | null;
  };
  features: {
    import_enabled: boolean;
    template_enabled: boolean;
  } & Record<string, boolean | undefined>;
}

export interface BackupStatus {
  enabled: boolean;
  schedule: string;
  retentionDays: number;
  lastRun: string | null;
  totalFiles: number;
}
