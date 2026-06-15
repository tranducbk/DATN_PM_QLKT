import { Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { formatDate } from '@/lib/utils';
import { GENDER } from '@/constants/gender.constants';
import { calculateTotalMonths } from './serviceDuration';
import type { Step2Personnel } from './types';

const { Text } = Typography;

type Step2Column = ColumnsType<Step2Personnel>[number];

export const sttColumn: Step2Column = {
  title: 'STT',
  key: 'index',
  width: 60,
  align: 'center',
  render: (_, __, index) => index + 1,
};

export const hoTenWithUnitColumn: Step2Column = {
  title: 'Họ và tên',
  dataIndex: 'ho_ten',
  key: 'ho_ten',
  width: 200,
  align: 'center',
  render: (text: string, record) => {
    const coQuan = record.DonViTrucThuoc?.CoQuanDonVi || record.CoQuanDonVi;
    const donViTrucThuoc = record.DonViTrucThuoc;

    const donViDisplay: string | null = donViTrucThuoc?.ten_don_vi
      ? coQuan?.ten_don_vi
        ? `${donViTrucThuoc.ten_don_vi} (${coQuan.ten_don_vi})`
        : donViTrucThuoc.ten_don_vi
      : coQuan?.ten_don_vi || null;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <Text strong>{text}</Text>
        {donViDisplay && (
          <Text type="secondary" style={{ fontSize: '12px', marginTop: 4 }}>
            {donViDisplay}
          </Text>
        )}
      </div>
    );
  },
};

export const ngaySinhColumn: Step2Column = {
  title: 'Ngày sinh',
  dataIndex: 'ngay_sinh',
  key: 'ngay_sinh',
  width: 140,
  align: 'center',
  render: (date: string | undefined | null) => (date ? formatDate(date) : '-'),
};

export const capBacChucVuColumn: Step2Column = {
  title: 'Cấp bậc / Chức vụ',
  key: 'cap_bac_chuc_vu',
  width: 180,
  align: 'center',
  render: (_, record) => {
    const capBac = record.cap_bac;
    const chucVu = record.ChucVu?.ten_chuc_vu;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <Text strong style={{ marginBottom: '4px' }}>
          {capBac || '-'}
        </Text>
        <Text type="secondary" style={{ fontSize: '12px' }}>
          {chucVu || '-'}
        </Text>
      </div>
    );
  },
};

export const gioiTinhColumn: Step2Column = {
  title: 'Giới tính',
  key: 'gioi_tinh',
  width: 120,
  align: 'center',
  render: (_, record) => {
    if (!record.gioi_tinh) {
      return <Text type="danger">Chưa cập nhật</Text>;
    }
    return <Text>{record.gioi_tinh === GENDER.MALE ? 'Nam' : 'Nữ'}</Text>;
  },
};

export const ngayNhapNguColumn: Step2Column = {
  title: 'Ngày nhập ngũ',
  key: 'ngay_nhap_ngu',
  width: 150,
  align: 'center',
  render: (_, record) => {
    if (!record.ngay_nhap_ngu) return <Text type="secondary">-</Text>;
    return formatDate(record.ngay_nhap_ngu);
  },
};

export const ngayXuatNguColumn: Step2Column = {
  title: 'Ngày xuất ngũ',
  key: 'ngay_xuat_ngu',
  width: 150,
  align: 'center',
  render: (_, record) => {
    if (!record.ngay_xuat_ngu) return <Text type="secondary">Chưa xuất ngũ</Text>;
    return formatDate(record.ngay_xuat_ngu);
  },
};

/**
 * Builds the total-service-months column relative to the proposal's month/year.
 * @param refNam - Reference year (proposal year), falls back to the current year
 * @param refThang - Reference month (proposal month) used for the cut-off date
 * @returns Column showing total service as "X năm Y tháng"
 */
export function tongThangColumn(refNam: number | null, refThang: number): Step2Column {
  return {
    title: 'Tổng tháng',
    key: 'tong_thang',
    width: 150,
    align: 'center',
    render: (_, record) => {
      const refYear = refNam ?? new Date().getFullYear();
      const lastDayOfMonth = new Date(refYear, refThang, 0);
      const result = calculateTotalMonths(
        record.ngay_nhap_ngu,
        record.ngay_xuat_ngu,
        lastDayOfMonth
      );
      if (!result) return <Text type="secondary">-</Text>;

      if (result.years > 0 && result.months > 0) {
        return (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <Text strong>{result.years} năm</Text>
            <Text type="secondary" style={{ fontSize: '12px', lineHeight: '1.2' }}>
              {result.months} tháng
            </Text>
          </div>
        );
      } else if (result.years > 0) {
        return <Text strong>{result.years} năm</Text>;
      } else if (result.totalMonths > 0) {
        return <Text strong>{result.totalMonths} tháng</Text>;
      } else {
        return <Text type="secondary">0 tháng</Text>;
      }
    },
  };
}
