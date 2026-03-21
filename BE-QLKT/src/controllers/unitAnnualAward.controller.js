const service = require('../services/unitAnnualAward.service');
const { writeSystemLog } = require('../helpers/systemLogHelper');

exports.list = async (req, res) => {
  try {
    const { page, limit, year, nam, don_vi_id, danh_hieu } = req.query;
    const data = await service.list({
      page: Number(page) || 1,
      limit: Number(limit) || 10,
      year: year || nam, // Hỗ trợ cả year và nam
      donViId: don_vi_id,
      danhHieu: danh_hieu,
      userRole: req.user?.role,
      userQuanNhanId: req.user?.quan_nhan_id,
    });
    res.json({ success: true, data });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ success: false, message: error.message || 'Lỗi hệ thống' });
  }
};

exports.getById = async (req, res) => {
  try {
    const data = await service.getById(req.params.id, req.user?.role, req.user?.quan_nhan_id);
    if (!data) {
      return res
        .status(404)
        .json({ success: false, message: 'Không tìm thấy bản ghi hoặc không có quyền xem' });
    }
    res.json({ success: true, data });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ success: false, message: error.message || 'Lỗi hệ thống' });
  }
};

exports.upsert = async (req, res) => {
  try {
    const body = req.body || {};
    const payload = {
      don_vi_id: body.don_vi_id,
      nam: body.nam,
      danh_hieu: body.danh_hieu,
      so_quyet_dinh: body.so_quyet_dinh,
      file_quyet_dinh: body.file_quyet_dinh,
      ghi_chu: body.ghi_chu,
      nguoi_tao_id: req.user?.id || body.nguoi_tao_id,
    };

    const data = await service.upsert(payload);
    res
      .status(201)
      .json({ success: true, data, message: 'Lưu khen thưởng đơn vị hằng năm thành công' });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ success: false, message: error.message || 'Lỗi hệ thống' });
  }
};

exports.propose = async (req, res) => {
  try {
    const body = req.body || {};
    const data = await service.propose({
      don_vi_id: body.don_vi_id,
      nam: body.nam,
      danh_hieu: body.danh_hieu,
      ghi_chu: body.ghi_chu,
      nguoi_tao_id: req.user?.id || body.nguoi_tao_id,
    });
    res.status(201).json({
      success: true,
      data,
      message: 'Đã gửi đề xuất khen thưởng đơn vị. Hãy chờ admin duyệt',
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ success: false, message: error.message || 'Lỗi hệ thống' });
  }
};

exports.approve = async (req, res) => {
  try {
    const data = await service.approve(req.params.id, {
      so_quyet_dinh: req.body?.so_quyet_dinh,
      file_quyet_dinh: req.body?.file_quyet_dinh,
      nhan_bkbqp: req.body?.nhan_bkbqp,
      so_quyet_dinh_bkbqp: req.body?.so_quyet_dinh_bkbqp,
      file_quyet_dinh_bkbqp: req.body?.file_quyet_dinh_bkbqp,
      nhan_bkttcp: req.body?.nhan_bkttcp,
      so_quyet_dinh_bkttcp: req.body?.so_quyet_dinh_bkttcp,
      file_quyet_dinh_bkttcp: req.body?.file_quyet_dinh_bkttcp,
      nguoi_duyet_id: req.user?.id || req.body?.nguoi_duyet_id,
    });
    res.json({ success: true, data, message: 'Đã phê duyệt đề xuất' });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ success: false, message: error.message || 'Lỗi hệ thống' });
  }
};

exports.reject = async (req, res) => {
  try {
    const data = await service.reject(req.params.id, {
      ghi_chu: req.body?.ghi_chu,
      nguoi_duyet_id: req.user?.id || req.body?.nguoi_duyet_id,
    });
    res.json({ success: true, data, message: 'Đã từ chối đề xuất' });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ success: false, message: error.message || 'Lỗi hệ thống' });
  }
};

exports.recalculate = async (req, res) => {
  try {
    const count = await service.recalculate({ don_vi_id: req.body?.don_vi_id, nam: req.body?.nam });
    res.json({ success: true, data: { updated: count } });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ success: false, message: error.message || 'Lỗi hệ thống' });
  }
};

exports.remove = async (req, res) => {
  try {
    await service.remove(req.params.id);
    res.json({ success: true, data: true, message: 'Đã xóa bản ghi' });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ success: false, message: error.message || 'Lỗi hệ thống' });
  }
};

/**
 * Lấy lịch sử khen thưởng hằng năm của đơn vị (mảng)
 * Query: don_vi_id (bắt buộc)
 */
exports.getUnitAnnualAwards = async (req, res) => {
  try {
    const { don_vi_id } = req.query;

    if (!don_vi_id) {
      return res.status(400).json({ success: false, message: 'Tham số don_vi_id là bắt buộc' });
    }

    const result = await service.getUnitAnnualAwards(
      don_vi_id,
      req.user?.role,
      req.user?.quan_nhan_id
    );

    return res
      .status(200)
      .json({ success: true, message: 'Lấy lịch sử khen thưởng đơn vị thành công', data: result });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res
      .status(statusCode)
      .json({ success: false, message: error.message || 'Lỗi hệ thống' });
  }
};

/**
 * GET /api/awards/units/annual/profile/:don_vi_id
 * Lấy hồ sơ gợi ý hằng năm của đơn vị (tương tự getAnnualProfile cho cá nhân)
 * Query params: ?year=2025 (optional, nếu có sẽ tính toán lại với năm đó)
 */
exports.getUnitAnnualProfile = async (req, res) => {
  try {
    const { don_vi_id } = req.params;
    const { year } = req.query;
    const yearNumber = year ? parseInt(year, 10) : null;

    if (!don_vi_id) {
      return res.status(400).json({ success: false, message: 'Tham số don_vi_id là bắt buộc' });
    }

    // Nếu có năm, tính toán lại hồ sơ với năm đó trước khi lấy
    if (yearNumber) {
      await service.recalculateAnnualUnit(don_vi_id, yearNumber);
    }

    const result = await service.getAnnualUnit(don_vi_id, yearNumber || new Date().getFullYear());

    return res.status(200).json({
      success: true,
      message: 'Lấy hồ sơ hằng năm đơn vị thành công',
      data: result,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res
      .status(statusCode)
      .json({ success: false, message: error.message || 'Lỗi hệ thống' });
  }
};

exports.previewImport = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Vui lòng upload file Excel' });
    }
    const result = await service.previewImport(req.file.buffer);

    await writeSystemLog({
      userId: req.user?.id,
      userRole: req.user?.role,
      action: 'IMPORT_PREVIEW',
      resource: 'unit-annual-awards',
      description: `Tải lên file ${req.file?.originalname || 'Excel'} để review khen thưởng đơn vị hằng năm: ${result.total || result.valid?.length || 0} dòng, ${result.errors?.length || 0} lỗi`,
      payload: { filename: req.file?.originalname, total: result.total, errors: result.errors?.length || 0 },
    });

    return res.json({ success: true, data: result });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res
      .status(statusCode)
      .json({ success: false, message: error.message || 'Lỗi hệ thống' });
  }
};

exports.confirmImport = async (req, res) => {
  try {
    const { items } = req.body;
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Không có dữ liệu để import' });
    }
    const adminId = req.user.id;
    const result = await service.confirmImport(items, adminId);

    await writeSystemLog({
      userId: req.user?.id,
      userRole: req.user?.role,
      action: 'IMPORT',
      resource: 'unit-annual-awards',
      description: `Import khen thưởng đơn vị hằng năm thành công: ${result.imported || items.length} bản ghi`,
      payload: { imported: result.imported || items.length },
    });

    return res.json({ success: true, data: result });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res
      .status(statusCode)
      .json({ success: false, message: error.message || 'Lỗi hệ thống' });
  }
};

exports.getTemplate = async (req, res) => {
  try {
    const userRole = req.user?.role || 'MANAGER';

    // Parse unit_ids from query string (comma-separated), fallback to personnel_ids
    const rawIds = req.query.unit_ids ?? req.query.personnel_ids ?? '';
    let unitIds = [];
    if (rawIds) {
      unitIds = rawIds
        .split(',')
        .map(id => id.trim())
        .filter(id => id.length > 0);
    }

    const workbook = await service.exportTemplate(unitIds, userRole);

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="mau_import_don_vi_hang_nam_${new Date()
        .toISOString()
        .slice(0, 10)}.xlsx"`
    );

    const buffer = await workbook.xlsx.writeBuffer();
    return res.send(buffer);
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || 'Lỗi hệ thống',
    });
  }
};

exports.importFromExcel = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng upload file Excel',
      });
    }

    const result = await service.importFromExcel(req.file.buffer, req.user.id);

    return res.status(200).json({
      success: true,
      message: `Đã thêm thành công ${result.imported}/${result.total} bản ghi`,
      data: result,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || 'Lỗi hệ thống',
    });
  }
};

exports.exportToExcel = async (req, res) => {
  try {
    const { nam, danh_hieu } = req.query;
    const role = req.user?.role;
    const userQuanNhanId = req.user?.quan_nhan_id;

    const filters = {
      nam: nam ? parseInt(nam) : undefined,
      danh_hieu: danh_hieu || undefined,
    };

    const workbook = await service.exportToExcel(filters, role, userQuanNhanId);

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="danh_sach_don_vi_hang_nam_${new Date()
        .toISOString()
        .slice(0, 10)}.xlsx"`
    );

    const buffer = await workbook.xlsx.writeBuffer();
    return res.send(buffer);
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || 'Lỗi hệ thống',
    });
  }
};

exports.getStatistics = async (req, res) => {
  try {
    const { nam } = req.query;
    const role = req.user?.role;
    const userQuanNhanId = req.user?.quan_nhan_id;

    const filters = {
      nam: nam ? parseInt(nam) : undefined,
    };

    const statistics = await service.getStatistics(filters, role, userQuanNhanId);

    return res.status(200).json({
      success: true,
      data: statistics,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || 'Lỗi hệ thống',
    });
  }
};
