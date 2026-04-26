/**
 * Test mapDecisionFields logic from approve.ts
 * Since it's a private function, we test the logic pattern directly.
 */
import { DANH_HIEU_CA_NHAN_HANG_NAM } from '../constants/danhHieu.constants';

function mapDecisionFields(danhHieu: string, soQuyetDinh: string | null) {
  switch (danhHieu) {
    case DANH_HIEU_CA_NHAN_HANG_NAM.BKBQP:
      return { nhan_bkbqp: true, so_quyet_dinh_bkbqp: soQuyetDinh };
    case DANH_HIEU_CA_NHAN_HANG_NAM.CSTDTQ:
      return { nhan_cstdtq: true, so_quyet_dinh_cstdtq: soQuyetDinh };
    case DANH_HIEU_CA_NHAN_HANG_NAM.BKTTCP:
      return { nhan_bkttcp: true, so_quyet_dinh_bkttcp: soQuyetDinh };
    default:
      return { danh_hieu: danhHieu, so_quyet_dinh: soQuyetDinh };
  }
}

describe('mapDecisionFields', () => {
  it('maps CSTDCS to danh_hieu + so_quyet_dinh', () => {
    const result = mapDecisionFields('CSTDCS', 'QD1');
    expect(result).toEqual({ danh_hieu: 'CSTDCS', so_quyet_dinh: 'QD1' });
    expect(result).not.toHaveProperty('nhan_bkbqp');
  });

  it('maps BKBQP to nhan_bkbqp + so_quyet_dinh_bkbqp', () => {
    const result = mapDecisionFields('BKBQP', 'QD2');
    expect(result).toEqual({ nhan_bkbqp: true, so_quyet_dinh_bkbqp: 'QD2' });
    expect(result).not.toHaveProperty('danh_hieu');
    expect(result).not.toHaveProperty('so_quyet_dinh');
  });

  it('maps CSTDTQ to nhan_cstdtq + so_quyet_dinh_cstdtq', () => {
    const result = mapDecisionFields('CSTDTQ', 'QD3');
    expect(result).toEqual({ nhan_cstdtq: true, so_quyet_dinh_cstdtq: 'QD3' });
  });

  it('maps BKTTCP to nhan_bkttcp + so_quyet_dinh_bkttcp', () => {
    const result = mapDecisionFields('BKTTCP', 'QD4');
    expect(result).toEqual({ nhan_bkttcp: true, so_quyet_dinh_bkttcp: 'QD4' });
  });

  it('handles null QD', () => {
    const result = mapDecisionFields('BKBQP', null);
    expect(result).toEqual({ nhan_bkbqp: true, so_quyet_dinh_bkbqp: null });
  });

  it('maps CSTT same as CSTDCS pattern', () => {
    const result = mapDecisionFields('CSTT', 'QD5');
    expect(result).toEqual({ danh_hieu: 'CSTT', so_quyet_dinh: 'QD5' });
  });
});
