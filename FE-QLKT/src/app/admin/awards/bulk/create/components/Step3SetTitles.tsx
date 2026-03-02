'use client';

import Step3SetTitlesHCQKQT from './Step3SetTitlesHCQKQT';
import Step3SetTitlesKNCVSNXD from './Step3SetTitlesKNCVSNXD';
import Step3SetTitlesCaNhanHangNam from './Step3SetTitlesCaNhanHangNam';
import Step3SetTitlesDonViHangNam from './Step3SetTitlesDonViHangNam';
import Step3SetTitlesNienHan from './Step3SetTitlesNienHan';
import Step3SetTitlesCongHien from './Step3SetTitlesCongHien';
import Step3SetTitlesNCKH from './Step3SetTitlesNCKH';

interface TitleData {
  personnel_id?: string;
  don_vi_id?: string;
  don_vi_type?: 'CO_QUAN_DON_VI' | 'DON_VI_TRUC_THUOC';
  danh_hieu?: string;
  loai?: 'DTKH' | 'SKKH';
  mo_ta?: string;
}

interface Step3SetTitlesProps {
  selectedPersonnelIds: string[];
  selectedUnitIds?: string[];
  proposalType: string;
  titleData: TitleData[];
  onTitleDataChange: (data: TitleData[]) => void;
  onPersonnelChange?: (ids: string[]) => void;
  onUnitChange?: (ids: string[]) => void;
  nam: number;
}

export default function Step3SetTitles({
  selectedPersonnelIds,
  selectedUnitIds = [],
  proposalType,
  titleData,
  onTitleDataChange,
  onPersonnelChange = () => {},
  onUnitChange = () => {},
  nam,
}: Step3SetTitlesProps) {
  // Router component - gọi component tương ứng với từng loại đề xuất
  switch (proposalType) {
    case 'HC_QKQT':
      return (
        <Step3SetTitlesHCQKQT
          selectedPersonnelIds={selectedPersonnelIds}
          onPersonnelChange={onPersonnelChange}
          titleData={titleData}
          onTitleDataChange={onTitleDataChange}
          nam={nam}
        />
      );
    case 'KNC_VSNXD_QDNDVN':
      return (
        <Step3SetTitlesKNCVSNXD
          selectedPersonnelIds={selectedPersonnelIds}
          onPersonnelChange={onPersonnelChange}
          titleData={titleData}
          onTitleDataChange={onTitleDataChange}
          nam={nam}
        />
      );
    case 'CA_NHAN_HANG_NAM':
      return (
        <Step3SetTitlesCaNhanHangNam
          selectedPersonnelIds={selectedPersonnelIds}
          onPersonnelChange={onPersonnelChange}
          titleData={titleData}
          onTitleDataChange={onTitleDataChange}
          nam={nam}
        />
      );
    case 'DON_VI_HANG_NAM':
      return (
        <Step3SetTitlesDonViHangNam
          selectedUnitIds={selectedUnitIds || []}
          onUnitChange={onUnitChange}
          titleData={titleData}
          onTitleDataChange={onTitleDataChange}
          nam={nam}
        />
      );
    case 'NIEN_HAN':
      return (
        <Step3SetTitlesNienHan
          selectedPersonnelIds={selectedPersonnelIds}
          onPersonnelChange={onPersonnelChange}
          titleData={titleData}
          onTitleDataChange={onTitleDataChange}
          nam={nam}
        />
      );
    case 'CONG_HIEN':
      return (
        <Step3SetTitlesCongHien
          selectedPersonnelIds={selectedPersonnelIds}
          onPersonnelChange={onPersonnelChange}
          titleData={titleData}
          onTitleDataChange={onTitleDataChange}
          nam={nam}
        />
      );
    case 'NCKH':
      return (
        <Step3SetTitlesNCKH
          selectedPersonnelIds={selectedPersonnelIds}
          onPersonnelChange={onPersonnelChange}
          titleData={titleData}
          onTitleDataChange={onTitleDataChange}
          nam={nam}
        />
      );
    default:
      return <div>Loại đề xuất không hợp lệ</div>;
  }
}
