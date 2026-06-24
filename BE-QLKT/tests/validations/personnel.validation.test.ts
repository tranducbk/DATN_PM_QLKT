import { updateOwnProfile } from '../../src/validations/personnel.validation';

describe('Tự sửa hồ sơ: chỉ nhận đúng các trường được phép (biên bảo mật)', () => {
  it('Gửi kèm trường nguy hiểm (cấp bậc, ngày nhập ngũ, CCCD, đơn vị, chức vụ, giới tính) → bị loại bỏ', () => {
    const result = updateOwnProfile.parse({
      so_dien_thoai: '0987',
      cho_o_hien_nay: 'Hà Nội',
      cap_bac: 'Đại tướng',
      ngay_nhap_ngu: '2000-01-01',
      cccd: '999999999999',
      co_quan_don_vi_id: 'unit-x',
      chuc_vu_id: 'pos-y',
      gioi_tinh: 'NU',
    });

    expect(result).toEqual({ so_dien_thoai: '0987', cho_o_hien_nay: 'Hà Nội' });
    expect(result).not.toHaveProperty('cap_bac');
    expect(result).not.toHaveProperty('ngay_nhap_ngu');
    expect(result).not.toHaveProperty('cccd');
    expect(result).not.toHaveProperty('co_quan_don_vi_id');
    expect(result).not.toHaveProperty('chuc_vu_id');
    expect(result).not.toHaveProperty('gioi_tinh');
  });

  it('Gửi kèm id/quan_nhan_id trong body → bị loại (không thể nhắm hồ sơ người khác)', () => {
    const result = updateOwnProfile.parse({
      so_dien_thoai: '0912',
      id: 'other-id',
      quan_nhan_id: 'other-qn',
    });

    expect(result).not.toHaveProperty('id');
    expect(result).not.toHaveProperty('quan_nhan_id');
  });

  it('Chấp nhận đủ 7 trường được phép; ngày sinh ép kiểu Date', () => {
    const result = updateOwnProfile.parse({
      ho_ten: 'Vũ Đình Lâm',
      ngay_sinh: '1975-05-15',
      so_dien_thoai: '0912',
      que_quan_2_cap: 'Xã A, tỉnh B',
      que_quan_3_cap: 'Xã A, Huyện C, Tỉnh B',
      tru_quan: 'Hà Nội',
      cho_o_hien_nay: 'Hà Nội',
    });

    expect(result.ngay_sinh).toBeInstanceOf(Date);
    expect(Object.keys(result).sort()).toEqual(
      [
        'cho_o_hien_nay',
        'ho_ten',
        'ngay_sinh',
        'que_quan_2_cap',
        'que_quan_3_cap',
        'so_dien_thoai',
        'tru_quan',
      ].sort()
    );
  });

  it('Họ tên rỗng → báo lỗi, không cho lưu', () => {
    expect(updateOwnProfile.safeParse({ ho_ten: '' }).success).toBe(false);
  });
});
