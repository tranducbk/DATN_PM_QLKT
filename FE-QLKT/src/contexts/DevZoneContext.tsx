'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import axiosInstance from '@/utils/axiosInstance';
import { AWARD_TYPE_TO_ALLOW } from '@/constants/danhHieu.constants';

interface DevZoneContextValue {
  features: Record<string, boolean>;
  loading: boolean;
}

const DevZoneContext = createContext<DevZoneContextValue>({
  features: {},
  loading: true,
});

export function DevZoneProvider({ children }: { children: React.ReactNode }) {
  const [features, setFeatures] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axiosInstance
      .get('/api/dev-zone/features')
      .then(res => {
        if (res.data?.success) setFeatures(res.data.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <DevZoneContext.Provider value={{ features, loading }}>{children}</DevZoneContext.Provider>
  );
}

/**
 * Check if import is allowed for a specific award type.
 * @param awardType - e.g. 'CA_NHAN_HANG_NAM', 'DON_VI_HANG_NAM', etc.
 */
export function useDevZoneFeature(awardType: string): boolean {
  const { features } = useContext(DevZoneContext);
  const key = AWARD_TYPE_TO_ALLOW[awardType];
  return key ? (features[key] ?? false) : false;
}

/**
 * Get all dev zone features (for advanced usage).
 */
export function useDevZone(): DevZoneContextValue {
  return useContext(DevZoneContext);
}
