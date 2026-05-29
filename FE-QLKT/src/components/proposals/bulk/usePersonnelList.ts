import { useState, useEffect, useMemo } from 'react';
import { message } from 'antd';
import { apiClient } from '@/lib/apiClient';
import { getApiErrorMessage } from '@/lib/apiError';
import { FETCH_ALL_LIMIT } from '@/constants/pagination.constants';
import type { Step2Personnel } from './types';

export interface PersonnelListState {
  personnel: Step2Personnel[];
  loading: boolean;
  searchText: string;
  setSearchText: (v: string) => void;
  unitFilter: string;
  setUnitFilter: (v: string) => void;
  units: string[];
  filteredPersonnel: Step2Personnel[];
  refetch: () => Promise<void>;
}

/**
 * Shared personnel fetch + filter logic for Step2SelectPersonnel* components.
 * Replaces the per-component `fetchPersonnel` + `filteredPersonnel` + `units` block
 * duplicated across 7 award-type variants.
 * @param options.warnWhenEmpty - Show "không có quân nhân" message after first fetch
 *   returns empty. HCQKQT and KNC variants opt in; others use default false.
 * @returns State + setters + memoized filtered list (search by ho_ten, filter by unit id).
 */
export function usePersonnelList(options: { warnWhenEmpty?: boolean } = {}): PersonnelListState {
  const { warnWhenEmpty = false } = options;
  const [personnel, setPersonnel] = useState<Step2Personnel[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [unitFilter, setUnitFilter] = useState<string>('ALL');

  const refetch = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getPersonnel({ page: 1, limit: FETCH_ALL_LIMIT });
      if (response.success) {
        const data = response.data ?? [];
        setPersonnel(data);
        if (warnWhenEmpty && data.length === 0) {
          message.warning('Không có quân nhân nào trong đơn vị của bạn.');
        }
      } else {
        message.error(response.message || 'Không thể lấy danh sách quân nhân');
      }
    } catch (error: unknown) {
      message.error(getApiErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const units = useMemo(
    () =>
      Array.from(
        new Set(
          personnel.map(p => {
            if (p.DonViTrucThuoc) {
              return `${p.DonViTrucThuoc.id}|${p.DonViTrucThuoc.ten_don_vi}`;
            }
            if (p.CoQuanDonVi) {
              return `${p.CoQuanDonVi.id}|${p.CoQuanDonVi.ten_don_vi}`;
            }
            return '';
          })
        )
      ).filter(Boolean),
    [personnel]
  );

  const filteredPersonnel = useMemo(
    () =>
      personnel.filter(p => {
        const matchesSearch =
          searchText === '' || p.ho_ten.toLowerCase().includes(searchText.toLowerCase());
        const matchesUnit =
          !unitFilter ||
          unitFilter === 'ALL' ||
          p.don_vi_truc_thuoc_id === unitFilter.split('|')[0] ||
          p.co_quan_don_vi_id === unitFilter.split('|')[0];
        return matchesSearch && matchesUnit;
      }),
    [personnel, searchText, unitFilter]
  );

  return {
    personnel,
    loading,
    searchText,
    setSearchText,
    unitFilter,
    setUnitFilter,
    units,
    filteredPersonnel,
    refetch,
  };
}
