import { PROPOSAL_TYPES, type ProposalType } from '../../constants/proposalTypes.constants';
import { prisma } from '../../models';
import { promises as fs } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { NotFoundError, ValidationError } from '../../middlewares/errorHandler';
import { sanitizeFilename } from './helpers';
import { PROPOSAL_STATUS } from '../../constants/proposalStatus.constants';
import type { Prisma } from '../../generated/prisma';

/** Personnel row shape returned by `findMany` in `submitProposal`. */
type SubmitPersonnelRow = Prisma.QuanNhanGetPayload<{
  select: {
    id: true;
    ho_ten: true;
    cap_bac: true;
    co_quan_don_vi_id: true;
    don_vi_truc_thuoc_id: true;
    ngay_nhap_ngu: true;
    ngay_xuat_ngu: true;
    CoQuanDonVi: { select: { id: true; ten_don_vi: true; ma_don_vi: true } };
    DonViTrucThuoc: {
      select: {
        id: true;
        ten_don_vi: true;
        ma_don_vi: true;
        co_quan_don_vi_id: true;
        CoQuanDonVi: { select: { id: true; ten_don_vi: true; ma_don_vi: true } };
      };
    };
    ChucVu: { select: { id: true; ten_chuc_vu: true } };
  };
}>;

type DonViTrucThuocSubmitRow = Prisma.DonViTrucThuocGetPayload<{
  include: {
    CoQuanDonVi: { select: { id: true; ten_don_vi: true; ma_don_vi: true } };
  };
}>;

type LichSuChucVuForCongHien = Prisma.LichSuChucVuGetPayload<{
  select: {
    he_so_chuc_vu: true;
    so_thang: true;
    ngay_bat_dau: true;
    ngay_ket_thuc: true;
  };
}>;

/**
 * Creates a reward proposal with optional attachments.
 * @param titleData - Proposal title/achievement payload from the frontend
 * @param attachedFiles - Uploaded attachment files (if any)
 * @param soQuyetDinh - Original decision number
 * @param userId - Manager account id
 * @param type - Proposal type
 * @param nam - Proposal year
 * @param ghiChu - Optional note
 * @returns Created proposal with related entities
 */
export interface SubmitTitleDataItem {
  personnel_id: string;
  don_vi_id?: string;
  don_vi_type?: string;
  danh_hieu?: string;
  loai?: string;
  mo_ta?: string;
  status?: string;
  so_quyet_dinh?: string | null;
  file_quyet_dinh?: string | null;
  cap_bac?: string | null;
  chuc_vu?: string | null;
}

export interface SubmitAttachedFile {
  originalname: string;
  buffer: Buffer;
  size: number;
}

async function submitProposal(
  titleData: SubmitTitleDataItem[],
  attachedFiles: SubmitAttachedFile[] | null,
  soQuyetDinh: string | null,
  userId: string,
  type: ProposalType = PROPOSAL_TYPES.CA_NHAN_HANG_NAM,
  nam: number,
  ghiChu: string | null = null
) {
  try {
    const user = await prisma.taiKhoan.findUnique({
      where: { id: userId },
      include: {
        QuanNhan: {
          include: {
            CoQuanDonVi: true,
            DonViTrucThuoc: {
              include: {
                CoQuanDonVi: true,
              },
            },
          },
        },
      },
    });

    if (!user || !user.QuanNhan) {
      throw new NotFoundError('Thông tin quân nhân của tài khoản này');
    }

    const donViId = user.QuanNhan.co_quan_don_vi_id || user.QuanNhan.don_vi_truc_thuoc_id;

    // Save attachment files to local storage.
    const filesInfo: {
      filename: string;
      originalName: string;
      size: number;
      uploadedAt: string;
    }[] = [];

    if (attachedFiles && attachedFiles.length > 0) {
      const storagePath = path.join(__dirname, '../../../storage/proposals');
      await fs.mkdir(storagePath, { recursive: true });

      for (const file of attachedFiles) {
        if (file && file.buffer) {
          let originalName = file.originalname || 'file';
          try {
            if (Buffer.isBuffer(originalName)) {
              originalName = originalName.toString('utf8');
            } else if (typeof originalName === 'string') {
              originalName = Buffer.from(originalName, 'latin1').toString('utf8');
            }
          } catch (e) {
            originalName = 'file';
          }

          const sanitizedOriginalName = sanitizeFilename(originalName);

          // Use timestamp + short uuid to avoid filename collisions.
          const timestamp = Date.now();
          const uniqueId = uuidv4().slice(0, 8);
          const fileExtension = path.extname(sanitizedOriginalName);
          const baseFilename = path.basename(sanitizedOriginalName, fileExtension);
          const savedFilename = `${timestamp}_${uniqueId}_${baseFilename}${fileExtension}`;

          const filePath = path.join(storagePath, savedFilename);
          await fs.writeFile(filePath, file.buffer);

          // Keep original name for UI display.
          filesInfo.push({
            filename: savedFilename,
            originalName: originalName,
            size: file.size,
            uploadedAt: new Date().toISOString(),
          });
        }
      }
    }

    if (!titleData || !Array.isArray(titleData)) {
      throw new ValidationError('Dữ liệu đề xuất không hợp lệ');
    }

    // For DON_VI_HANG_NAM, input items use `don_vi_id` instead of `personnel_id`.
    let personnelList: SubmitPersonnelRow[] = [];
    if (type !== PROPOSAL_TYPES.DON_VI_HANG_NAM) {
      const personnelIds = titleData
        .map(item => item.personnel_id)
        .filter(id => id !== undefined && id !== null); // Filter out undefined/null

      if (personnelIds.length > 0) {
        // These proposal types need service-time fields for validation.
        const needsTimeTypes: ProposalType[] = [
          PROPOSAL_TYPES.NIEN_HAN,
          PROPOSAL_TYPES.HC_QKQT,
          PROPOSAL_TYPES.KNC_VSNXD_QDNDVN,
        ];
        const needsTimeData = needsTimeTypes.includes(type);

        personnelList = (await prisma.quanNhan.findMany({
          where: {
            id: {
              in: personnelIds,
            },
          },
          select: {
            id: true,
            ho_ten: true,
            cap_bac: true,
            co_quan_don_vi_id: true,
            don_vi_truc_thuoc_id: true,
            ...(needsTimeData && {
              ngay_nhap_ngu: true,
              ngay_xuat_ngu: true,
            }),
            CoQuanDonVi: {
              select: {
                id: true,
                ten_don_vi: true,
                ma_don_vi: true,
              },
            },
            DonViTrucThuoc: {
              select: {
                id: true,
                ten_don_vi: true,
                ma_don_vi: true,
                co_quan_don_vi_id: true,
                CoQuanDonVi: {
                  select: {
                    id: true,
                    ten_don_vi: true,
                    ma_don_vi: true,
                  },
                },
              },
            },
            ChucVu: {
              select: {
                id: true,
                ten_chuc_vu: true,
              },
            },
          },
        })) as SubmitPersonnelRow[];
      }
    }

    // Build lookup map and backfill missing unit relations when needed.
    const personnelMap: Record<string, SubmitPersonnelRow> = {};
    const missingDonViIds = new Set<string>();

    personnelList.forEach(p => {
      if (p.don_vi_truc_thuoc_id && !p.DonViTrucThuoc) {
        missingDonViIds.add(p.don_vi_truc_thuoc_id);
      }
      personnelMap[p.id] = p;
    });

    if (missingDonViIds.size > 0) {
      const missingDonVis = await prisma.donViTrucThuoc.findMany({
        where: {
          id: {
            in: Array.from(missingDonViIds) as string[],
          },
        },
        include: {
          CoQuanDonVi: {
            select: {
              id: true,
              ten_don_vi: true,
              ma_don_vi: true,
            },
          },
        },
      });

      const donViMap: Record<string, DonViTrucThuocSubmitRow> = {};
      missingDonVis.forEach(dv => {
        donViMap[dv.id] = dv;
      });

      Object.keys(personnelMap).forEach(personnelId => {
        const personnel = personnelMap[personnelId];
        if (personnel.don_vi_truc_thuoc_id && !personnel.DonViTrucThuoc) {
          personnel.DonViTrucThuoc = donViMap[personnel.don_vi_truc_thuoc_id] || null;
        }
      });
    }

    // Normalize payload by proposal type and enrich with relation data.
    let dataDanhHieu: any[] | null = null;
    let dataThanhTich: any[] | null = null;
    let dataNienHan: any[] | null = null;
    let dataCongHien: any[] | null = null;

    if (type === PROPOSAL_TYPES.NCKH) {
      // NCKH payload shape.
      dataThanhTich = titleData.map(item => {
        const personnel = personnelMap[item.personnel_id];
        return {
          personnel_id: item.personnel_id,
          ho_ten: personnel?.ho_ten || '',
          nam: nam,
          loai: item.loai,
          mo_ta: item.mo_ta,
          status: item.status || PROPOSAL_STATUS.PENDING,
          so_quyet_dinh: item.so_quyet_dinh || null,
          file_quyet_dinh: item.file_quyet_dinh || null,
          cap_bac: item.cap_bac || null,
          chuc_vu: item.chuc_vu || null,
          co_quan_don_vi: personnel?.CoQuanDonVi
            ? {
                id: personnel.CoQuanDonVi.id,
                ten_co_quan_don_vi: personnel.CoQuanDonVi.ten_don_vi,
                ma_co_quan_don_vi: personnel.CoQuanDonVi.ma_don_vi,
              }
            : null,
          don_vi_truc_thuoc: personnel?.DonViTrucThuoc
            ? {
                id: personnel.DonViTrucThuoc.id,
                ten_don_vi: personnel.DonViTrucThuoc.ten_don_vi,
                ma_don_vi: personnel.DonViTrucThuoc.ma_don_vi,
                co_quan_don_vi: personnel.DonViTrucThuoc.CoQuanDonVi
                  ? {
                      id: personnel.DonViTrucThuoc.CoQuanDonVi.id,
                      ten_don_vi_truc: personnel.DonViTrucThuoc.CoQuanDonVi.ten_don_vi,
                      ma_don_vi: personnel.DonViTrucThuoc.CoQuanDonVi.ma_don_vi,
                    }
                  : null,
              }
            : null,
        };
      });
    } else if (type === PROPOSAL_TYPES.DON_VI_HANG_NAM) {
      // DON_VI_HANG_NAM payload shape.
      dataDanhHieu = await Promise.all(
        titleData.map(async item => {
          let donViInfo = null;
          let coQuanDonViCha = null;

          if (item.don_vi_type === 'CO_QUAN_DON_VI') {
            const donVi = await prisma.coQuanDonVi.findUnique({
              where: { id: item.don_vi_id },
              select: {
                id: true,
                ten_don_vi: true,
                ma_don_vi: true,
              },
            });
            donViInfo = donVi;
          } else if (item.don_vi_type === 'DON_VI_TRUC_THUOC') {
            const donVi = await prisma.donViTrucThuoc.findUnique({
              where: { id: item.don_vi_id },
              include: {
                CoQuanDonVi: {
                  select: {
                    id: true,
                    ten_don_vi: true,
                    ma_don_vi: true,
                  },
                },
              },
            });
            donViInfo = {
              id: donVi!.id,
              ten_don_vi: donVi!.ten_don_vi,
              ma_don_vi: donVi!.ma_don_vi,
            };
            coQuanDonViCha = donVi!.CoQuanDonVi;
          }

          return {
            don_vi_id: item.don_vi_id,
            don_vi_type: item.don_vi_type,
            ten_don_vi: donViInfo?.ten_don_vi || '',
            ma_don_vi: donViInfo?.ma_don_vi || '',
            nam: nam,
            danh_hieu: item.danh_hieu,
            co_quan_don_vi_cha: coQuanDonViCha,
            so_quyet_dinh: item.so_quyet_dinh || null,
            file_quyet_dinh: item.file_quyet_dinh || null,
            nhan_bkbqp: item.danh_hieu === 'BKBQP' ? true : false,
            nhan_bkttcp: item.danh_hieu === 'BKTTCP' ? true : false,
          };
        })
      );
    } else if (type === PROPOSAL_TYPES.CA_NHAN_HANG_NAM) {
      // Standard annual personal-title payload.
      dataDanhHieu = titleData.map(item => {
        const personnel = personnelMap[item.personnel_id];

        // Resolve personnel unit data.
        const personnelCoQuanDonVi = personnel?.CoQuanDonVi;
        const personnelDonViTrucThuoc = personnel?.DonViTrucThuoc;

        // Keep both relations when available.
        let coQuanDonVi = null;
        let donViTrucThuoc = null;

        if (personnelCoQuanDonVi) {
          coQuanDonVi = {
            id: personnelCoQuanDonVi.id,
            ten_co_quan_don_vi: personnelCoQuanDonVi.ten_don_vi,
            ma_co_quan_don_vi: personnelCoQuanDonVi.ma_don_vi,
          };
        }

        if (personnel?.don_vi_truc_thuoc_id && personnelDonViTrucThuoc) {
          donViTrucThuoc = {
            id: personnelDonViTrucThuoc.id,
            ten_don_vi: personnelDonViTrucThuoc.ten_don_vi,
            ma_don_vi: personnelDonViTrucThuoc.ma_don_vi,
            co_quan_don_vi: personnelDonViTrucThuoc.CoQuanDonVi
              ? {
                  id: personnelDonViTrucThuoc.CoQuanDonVi.id,
                  ten_don_vi_truc: personnelDonViTrucThuoc.CoQuanDonVi.ten_don_vi,
                  ma_don_vi: personnelDonViTrucThuoc.CoQuanDonVi.ma_don_vi,
                }
              : null,
          };
        }

        return {
          personnel_id: item.personnel_id,
          ho_ten: personnel?.ho_ten || '',
          nam: nam,
          danh_hieu: item.danh_hieu,
          cap_bac: item.cap_bac || null,
          chuc_vu: item.chuc_vu || null,
          co_quan_don_vi: coQuanDonVi,
          don_vi_truc_thuoc: donViTrucThuoc,
          nhan_bkbqp: item.danh_hieu === 'BKBQP' ? true : false,
          nhan_cstdtq: item.danh_hieu === 'CSTDTQ' ? true : false,
          nhan_bkttcp: item.danh_hieu === 'BKTTCP' ? true : false,
        };
      });
    } else if (
      type === PROPOSAL_TYPES.NIEN_HAN ||
      type === PROPOSAL_TYPES.HC_QKQT ||
      type === PROPOSAL_TYPES.KNC_VSNXD_QDNDVN
    ) {
      // NIEN_HAN / HC_QKQT / KNC_VSNXD_QDNDVN payload shape.
      dataNienHan = titleData.map(item => {
        const personnel = personnelMap[item.personnel_id];

        // Compute service duration from enlistment date.
        let thoiGian = null;
        if (personnel?.ngay_nhap_ngu) {
          const ngayNhapNgu = new Date(personnel.ngay_nhap_ngu);
          const ngayKetThuc = personnel.ngay_xuat_ngu
            ? new Date(personnel.ngay_xuat_ngu)
            : new Date();

          let months = (ngayKetThuc.getFullYear() - ngayNhapNgu.getFullYear()) * 12;
          months += ngayKetThuc.getMonth() - ngayNhapNgu.getMonth();
          if (ngayKetThuc.getDate() < ngayNhapNgu.getDate()) {
            months--;
          }
          months = Math.max(0, months);

          const years = Math.floor(months / 12);
          const remainingMonths = months % 12;
          thoiGian = {
            total_months: months,
            years: years,
            months: remainingMonths,
            display:
              months === 0
                ? '-'
                : years > 0 && remainingMonths > 0
                  ? `${years} năm ${remainingMonths} tháng`
                  : years > 0
                    ? `${years} năm`
                    : `${remainingMonths} tháng`,
          };
        }

        return {
          personnel_id: item.personnel_id,
          ho_ten: personnel?.ho_ten || '',
          nam: nam,
          danh_hieu: item.danh_hieu,
          so_quyet_dinh: item.so_quyet_dinh || null,
          file_quyet_dinh: item.file_quyet_dinh || null,
          thoi_gian: thoiGian,
          cap_bac: item.cap_bac || null,
          chuc_vu: item.chuc_vu || null,
          co_quan_don_vi: personnel?.CoQuanDonVi
            ? {
                id: personnel.CoQuanDonVi.id,
                ten_co_quan_don_vi: personnel.CoQuanDonVi.ten_don_vi,
                ma_co_quan_don_vi: personnel.CoQuanDonVi.ma_don_vi,
              }
            : null,
          don_vi_truc_thuoc: personnel?.DonViTrucThuoc
            ? {
                id: personnel.DonViTrucThuoc.id,
                ten_don_vi: personnel.DonViTrucThuoc.ten_don_vi,
                ma_don_vi: personnel.DonViTrucThuoc.ma_don_vi,
                co_quan_don_vi: personnel.DonViTrucThuoc.CoQuanDonVi
                  ? {
                      id: personnel.DonViTrucThuoc.CoQuanDonVi.id,
                      ten_don_vi_truc: personnel.DonViTrucThuoc.CoQuanDonVi.ten_don_vi,
                      ma_don_vi: personnel.DonViTrucThuoc.CoQuanDonVi.ma_don_vi,
                    }
                  : null,
              }
            : null,
        };
      });
    } else if (type === PROPOSAL_TYPES.CONG_HIEN) {
      // CONG_HIEN payload shape.
      dataCongHien = await Promise.all(
        titleData.map(async item => {
          const personnel = personnelMap[item.personnel_id];
          const baseData = {
            personnel_id: item.personnel_id,
            ho_ten: personnel?.ho_ten || '',
            nam: nam,
            danh_hieu: item.danh_hieu,
            cap_bac: item.cap_bac || null,
            chuc_vu: item.chuc_vu || null,
            co_quan_don_vi: personnel?.CoQuanDonVi
              ? {
                  id: personnel.CoQuanDonVi.id,
                  ten_co_quan_don_vi: personnel.CoQuanDonVi.ten_don_vi,
                  ma_co_quan_don_vi: personnel.CoQuanDonVi.ma_don_vi,
                }
              : null,
            don_vi_truc_thuoc: personnel?.DonViTrucThuoc
              ? {
                  id: personnel.DonViTrucThuoc.id,
                  ten_don_vi: personnel.DonViTrucThuoc.ten_don_vi,
                  ma_don_vi: personnel.DonViTrucThuoc.ma_don_vi,
                  co_quan_don_vi: personnel.DonViTrucThuoc.CoQuanDonVi
                    ? {
                        id: personnel.DonViTrucThuoc.CoQuanDonVi.id,
                        ten_don_vi_truc: personnel.DonViTrucThuoc.CoQuanDonVi.ten_don_vi,
                        ma_don_vi: personnel.DonViTrucThuoc.CoQuanDonVi.ma_don_vi,
                      }
                    : null,
                }
              : null,
          };

          // Add grouped duration fields for CONG_HIEN checks.
          if (type === PROPOSAL_TYPES.CONG_HIEN && item.personnel_id) {
            try {
              const histories = await prisma.lichSuChucVu.findMany({
                where: { quan_nhan_id: item.personnel_id },
                select: {
                  he_so_chuc_vu: true,
                  so_thang: true,
                  ngay_bat_dau: true,
                  ngay_ket_thuc: true,
                },
              });

              // Compute active months for current position records.
              const today = new Date();
              const updatedHistories = histories.map(history => {
                if (history.so_thang === null || history.so_thang === undefined) {
                  if (history.ngay_bat_dau && !history.ngay_ket_thuc) {
                    const ngayBatDau = new Date(history.ngay_bat_dau);
                    let months = (today.getFullYear() - ngayBatDau.getFullYear()) * 12;
                    months += today.getMonth() - ngayBatDau.getMonth();
                    if (today.getDate() < ngayBatDau.getDate()) {
                      months--;
                    }
                    return {
                      ...history,
                      so_thang: Math.max(0, months),
                    };
                  }
                }
                return history;
              });

              // Aggregate months by coefficient group.
              const getTotalMonthsByGroup = (group: string) => {
                let totalMonths = 0;
                updatedHistories.forEach(history => {
                  const heSo = Number(history.he_so_chuc_vu) || 0;
                  let belongsToGroup = false;

                  if (group === '0.7') {
                    belongsToGroup = heSo >= 0.7 && heSo < 0.8;
                  } else if (group === '0.8') {
                    belongsToGroup = heSo >= 0.8 && heSo < 0.9;
                  } else if (group === '0.9-1.0') {
                    belongsToGroup = heSo >= 0.9 && heSo <= 1.0;
                  }

                  if (
                    belongsToGroup &&
                    history.so_thang !== null &&
                    history.so_thang !== undefined
                  ) {
                    totalMonths += Number(history.so_thang);
                  }
                });
                return totalMonths;
              };

              // Compute duration for all three groups.
              const months0_7 = getTotalMonthsByGroup('0.7');
              const months0_8 = getTotalMonthsByGroup('0.8');
              const months0_9_1_0 = getTotalMonthsByGroup('0.9-1.0');

              // Format duration to readable years/months.
              const formatTime = (totalMonths: number) => {
                const years = Math.floor(totalMonths / 12);
                const remainingMonths = totalMonths % 12;
                return {
                  total_months: totalMonths,
                  years: years,
                  months: remainingMonths,
                  display:
                    totalMonths === 0
                      ? '-'
                      : years > 0 && remainingMonths > 0
                        ? `${years} năm ${remainingMonths} tháng`
                        : years > 0
                          ? `${years} năm`
                          : `${remainingMonths} tháng`,
                };
              };

              return {
                ...baseData,
                thoi_gian_nhom_0_7: formatTime(months0_7),
                thoi_gian_nhom_0_8: formatTime(months0_8),
                thoi_gian_nhom_0_9_1_0: formatTime(months0_9_1_0),
              };
            } catch (error) {
              console.error('ProposalSubmit.fetchPositionHistory failed', { personnelId: item.personnel_id, error });
              return baseData;
            }
          }

          return baseData;
        })
      );
    }

    // Validation: prevent mixing CSTDCS/CSTT with BKBQP/CSTDTQ.
    if (type === PROPOSAL_TYPES.CA_NHAN_HANG_NAM && dataDanhHieu && dataDanhHieu.length > 0) {
      const hasChinh = dataDanhHieu.some(
        item => item.danh_hieu === 'CSTDCS' || item.danh_hieu === 'CSTT'
      );
      const hasBKBQP = dataDanhHieu.some(item => item.danh_hieu === 'BKBQP');
      const hasCSTDTQ = dataDanhHieu.some(item => item.danh_hieu === 'CSTDTQ');

      if (hasChinh && (hasBKBQP || hasCSTDTQ)) {
        throw new ValidationError(
          'Không thể đề xuất CSTDCS/CSTT cùng với BKBQP/CSTDTQ trong một đề xuất. ' +
            'Vui lòng tách thành các đề xuất riêng: một đề xuất cho CSTDCS/CSTT, và một đề xuất riêng cho BKBQP/CSTDTQ.'
        );
      }
    }

    // Validation for NIEN_HAN: only HCCSVV ranks are allowed.
    if (type === PROPOSAL_TYPES.NIEN_HAN && dataNienHan && dataNienHan.length > 0) {
      const danhHieus = dataNienHan.map(item => item.danh_hieu).filter(Boolean);

      const allowedDanhHieus = ['HCCSVV_HANG_BA', 'HCCSVV_HANG_NHI', 'HCCSVV_HANG_NHAT'];
      const invalidDanhHieus = danhHieus.filter(dh => !allowedDanhHieus.includes(dh));

      if (invalidDanhHieus.length > 0) {
        throw new ValidationError(
          `Loại đề xuất "Huy chương Chiến sĩ vẻ vang" chỉ cho phép các hạng HCCSVV. ` +
            `Các danh hiệu không hợp lệ: ${invalidDanhHieus.join(', ')}. ` +
            `Vui lòng sử dụng loại đề xuất riêng cho HC_QKQT hoặc KNC_VSNXD_QDNDVN.`
        );
      }
    }

    // Validation for HC_QKQT: only HC_QKQT is allowed.
    if (type === PROPOSAL_TYPES.HC_QKQT && dataNienHan && dataNienHan.length > 0) {
      const danhHieus = dataNienHan.map(item => item.danh_hieu).filter(Boolean);

      const invalidDanhHieus = danhHieus.filter(dh => dh !== 'HC_QKQT');

      if (invalidDanhHieus.length > 0) {
        throw new ValidationError(
          `Loại đề xuất "Huy chương Quân kỳ quyết thắng" chỉ cho phép danh hiệu HC_QKQT. ` +
            `Các danh hiệu không hợp lệ: ${invalidDanhHieus.join(', ')}.`
        );
      }

      // Validation: require at least 25 years of service.
      const personnelIds = dataNienHan.map(item => item.personnel_id).filter(Boolean);
      const ineligiblePersonnel: { id: string; ho_ten: string; reason: string }[] = [];

      for (const personnelId of personnelIds) {
        try {
          const quanNhan = await prisma.quanNhan.findUnique({
            where: { id: personnelId },
            select: {
              id: true,
              ho_ten: true,
              ngay_nhap_ngu: true,
              ngay_xuat_ngu: true,
            },
          });

          if (!quanNhan) {
            ineligiblePersonnel.push({
              id: personnelId,
              ho_ten: 'N/A',
              reason: 'Không tìm thấy quân nhân',
            });
            continue;
          }

          if (!quanNhan.ngay_nhap_ngu) {
            ineligiblePersonnel.push({
              id: personnelId,
              ho_ten: quanNhan.ho_ten,
              reason: 'Chưa có thông tin ngày nhập ngũ',
            });
            continue;
          }

          const ngayNhapNgu = new Date(quanNhan.ngay_nhap_ngu);
          const ngayKetThuc = quanNhan.ngay_xuat_ngu
            ? new Date(quanNhan.ngay_xuat_ngu)
            : new Date();

          let months = (ngayKetThuc.getFullYear() - ngayNhapNgu.getFullYear()) * 12;
          months += ngayKetThuc.getMonth() - ngayNhapNgu.getMonth();
          if (ngayKetThuc.getDate() < ngayNhapNgu.getDate()) {
            months--;
          }
          months = Math.max(0, months);

          const years = Math.floor(months / 12);

          const requiredYears = 25;

          if (years < requiredYears) {
            ineligiblePersonnel.push({
              id: personnelId,
              ho_ten: quanNhan.ho_ten,
              reason: `Chưa đủ ${requiredYears} năm phục vụ (hiện tại: ${years} năm)`,
            });
          }
        } catch (error) {
          ineligiblePersonnel.push({
            id: personnelId,
            ho_ten: 'N/A',
            reason: `Lỗi kiểm tra: ${(error as Error).message}`,
          });
        }
      }

      if (ineligiblePersonnel.length > 0) {
        const names = ineligiblePersonnel.map(p => `${p.ho_ten} (${p.reason})`).join(', ');
        throw new ValidationError(
          `Một số quân nhân chưa đủ điều kiện để đề xuất Huy chương Quân kỳ quyết thắng (yêu cầu >= 25 năm phục vụ):\n${names}`
        );
      }
    }

    // Validation for KNC_VSNXD_QDNDVN.
    if (type === PROPOSAL_TYPES.KNC_VSNXD_QDNDVN && dataNienHan && dataNienHan.length > 0) {
      const danhHieus = dataNienHan.map(item => item.danh_hieu).filter(Boolean);

      const invalidDanhHieus = danhHieus.filter(dh => dh !== 'KNC_VSNXD_QDNDVN');

      if (invalidDanhHieus.length > 0) {
        throw new ValidationError(
          `Loại đề xuất "Kỷ niệm chương Vì sự nghiệp xây dựng QĐNDVN" chỉ cho phép danh hiệu KNC_VSNXD_QDNDVN. ` +
            `Các danh hiệu không hợp lệ: ${invalidDanhHieus.join(', ')}.`
        );
      }

      // Validation: female >=20 years, male >=25 years of service.
      const personnelIds = dataNienHan.map(item => item.personnel_id).filter(Boolean);
      const ineligiblePersonnel: { id: string; ho_ten: string; reason: string }[] = [];

      for (const personnelId of personnelIds) {
        try {
          const quanNhan = await prisma.quanNhan.findUnique({
            where: { id: personnelId },
            select: {
              id: true,
              ho_ten: true,
              gioi_tinh: true,
              ngay_nhap_ngu: true,
              ngay_xuat_ngu: true,
            },
          });

          if (!quanNhan) {
            ineligiblePersonnel.push({
              id: personnelId,
              ho_ten: 'N/A',
              reason: 'Không tìm thấy quân nhân',
            });
            continue;
          }

          if (
            !quanNhan.gioi_tinh ||
            (quanNhan.gioi_tinh !== 'NAM' && quanNhan.gioi_tinh !== 'NU')
          ) {
            ineligiblePersonnel.push({
              id: personnelId,
              ho_ten: quanNhan.ho_ten,
              reason: 'Chưa cập nhật thông tin giới tính',
            });
            continue;
          }

          if (!quanNhan.ngay_nhap_ngu) {
            ineligiblePersonnel.push({
              id: personnelId,
              ho_ten: quanNhan.ho_ten,
              reason: 'Chưa có thông tin ngày nhập ngũ',
            });
            continue;
          }

          const ngayNhapNgu = new Date(quanNhan.ngay_nhap_ngu);
          const ngayKetThuc = quanNhan.ngay_xuat_ngu
            ? new Date(quanNhan.ngay_xuat_ngu)
            : new Date();

          let months = (ngayKetThuc.getFullYear() - ngayNhapNgu.getFullYear()) * 12;
          months += ngayKetThuc.getMonth() - ngayNhapNgu.getMonth();
          if (ngayKetThuc.getDate() < ngayNhapNgu.getDate()) {
            months--;
          }
          months = Math.max(0, months);

          const years = Math.floor(months / 12);

          const requiredYears = quanNhan.gioi_tinh === 'NU' ? 20 : 25;

          if (years < requiredYears) {
            ineligiblePersonnel.push({
              id: personnelId,
              ho_ten: quanNhan.ho_ten,
              reason: `Chưa đủ ${requiredYears} năm phục vụ (hiện tại: ${years} năm)`,
            });
          }
        } catch (error) {
          ineligiblePersonnel.push({
            id: personnelId,
            ho_ten: 'N/A',
            reason: `Lỗi kiểm tra: ${(error as Error).message}`,
          });
        }
      }

      if (ineligiblePersonnel.length > 0) {
        const names = ineligiblePersonnel.map(p => `${p.ho_ten} (${p.reason})`).join(', ');
        throw new ValidationError(
          `Một số quân nhân chưa đủ điều kiện để đề xuất Kỷ niệm chương Vì sự nghiệp xây dựng QĐNDVN:\n${names}`
        );
      }
    }

    // Validation for CONG_HIEN: minimum 10-year requirement by grouped history.
    if (type === PROPOSAL_TYPES.CONG_HIEN && dataDanhHieu && dataDanhHieu.length > 0) {
      const baseRequiredMonths = 10 * 12;
      const femaleRequiredMonths = Math.round(baseRequiredMonths * (2 / 3));

      const personnelIds = dataDanhHieu.map(item => item.personnel_id).filter(Boolean);
      const positionHistoriesMap: Record<string, LichSuChucVuForCongHien[]> = {};
      const personnelGenderMap: Record<string, string | null> = {};

      for (const personnelId of personnelIds) {
        try {
          const quanNhan = await prisma.quanNhan.findUnique({
            where: { id: personnelId },
            select: {
              id: true,
              gioi_tinh: true,
            },
          });

          if (quanNhan) {
            personnelGenderMap[personnelId] = quanNhan.gioi_tinh;
          }

          const histories = await prisma.lichSuChucVu.findMany({
            where: { quan_nhan_id: personnelId },
            select: {
              he_so_chuc_vu: true,
              so_thang: true,
              ngay_bat_dau: true,
              ngay_ket_thuc: true,
            },
          });

          const today = new Date();
          const updatedHistories = histories.map(item => {
            if (item.so_thang === null || item.so_thang === undefined) {
              if (item.ngay_bat_dau && !item.ngay_ket_thuc) {
                const ngayBatDau = new Date(item.ngay_bat_dau);
                let months = (today.getFullYear() - ngayBatDau.getFullYear()) * 12;
                months += today.getMonth() - ngayBatDau.getMonth();
                if (today.getDate() < ngayBatDau.getDate()) {
                  months--;
                }
                return {
                  ...item,
                  so_thang: Math.max(0, months),
                };
              }
            }
            return item;
          });

          positionHistoriesMap[personnelId] = updatedHistories;
        } catch (error) {
          console.error('ProposalSubmit.buildPositionHistories failed', { personnelId, error });
          positionHistoriesMap[personnelId] = [];
        }
      }

      const getTotalMonthsByGroup = (personnelId: string, group: string) => {
        const histories = positionHistoriesMap[personnelId] || [];
        let totalMonths = 0;

        histories.forEach(history => {
          const heSo = Number(history.he_so_chuc_vu) || 0;
          let belongsToGroup = false;

          if (group === '0.7') {
            belongsToGroup = heSo >= 0.7 && heSo < 0.8;
          } else if (group === '0.8') {
            belongsToGroup = heSo >= 0.8 && heSo < 0.9;
          } else if (group === '0.9-1.0') {
            belongsToGroup = heSo >= 0.9 && heSo <= 1.0;
          }

          if (belongsToGroup && history.so_thang !== null && history.so_thang !== undefined) {
            totalMonths += Number(history.so_thang);
          }
        });

        return totalMonths;
      };

      const getRequiredMonths = (personnelId: string) => {
        const gioiTinh = personnelGenderMap[personnelId];
        return gioiTinh === 'NU' ? femaleRequiredMonths : baseRequiredMonths;
      };

      const checkEligibleForRank = (personnelId: string, rank: string) => {
        const months0_9_1_0 = getTotalMonthsByGroup(personnelId, '0.9-1.0');
        const months0_8 = getTotalMonthsByGroup(personnelId, '0.8');
        const months0_7 = getTotalMonthsByGroup(personnelId, '0.7');
        const requiredMonths = getRequiredMonths(personnelId);

        if (rank === 'HANG_NHAT') {
          return months0_9_1_0 >= requiredMonths;
        } else if (rank === 'HANG_NHI') {
          return months0_8 + months0_9_1_0 >= requiredMonths;
        } else if (rank === 'HANG_BA') {
          return months0_7 + months0_8 + months0_9_1_0 >= requiredMonths;
        }

        return false;
      };

      for (const item of dataDanhHieu) {
        if (!item.danh_hieu || !item.personnel_id) continue;

        const personnel = personnelMap[item.personnel_id];
        const hoTen = personnel?.ho_ten || item.personnel_id;
        const gioiTinh = personnelGenderMap[item.personnel_id];
        const requiredMonths = getRequiredMonths(item.personnel_id);

        let eligible = false;
        let rankName = '';

        if (item.danh_hieu === 'HCBVTQ_HANG_NHAT') {
          eligible = checkEligibleForRank(item.personnel_id, 'HANG_NHAT');
          rankName = 'Hạng Nhất';
        } else if (item.danh_hieu === 'HCBVTQ_HANG_NHI') {
          eligible = checkEligibleForRank(item.personnel_id, 'HANG_NHI');
          rankName = 'Hạng Nhì';
        } else if (item.danh_hieu === 'HCBVTQ_HANG_BA') {
          eligible = checkEligibleForRank(item.personnel_id, 'HANG_BA');
          rankName = 'Hạng Ba';
        }

        if (!eligible) {
          const months0_9_1_0 = getTotalMonthsByGroup(item.personnel_id, '0.9-1.0');
          const months0_8 = getTotalMonthsByGroup(item.personnel_id, '0.8');
          const months0_7 = getTotalMonthsByGroup(item.personnel_id, '0.7');

          let totalMonths = 0;
          if (item.danh_hieu === 'HCBVTQ_HANG_NHAT') {
            totalMonths = months0_9_1_0;
          } else if (item.danh_hieu === 'HCBVTQ_HANG_NHI') {
            totalMonths = months0_8 + months0_9_1_0;
          } else if (item.danh_hieu === 'HCBVTQ_HANG_BA') {
            totalMonths = months0_7 + months0_8 + months0_9_1_0;
          }

          const totalYears = Math.floor(totalMonths / 12);
          const remainingMonths = totalMonths % 12;
          const totalYearsText =
            totalYears > 0 && remainingMonths > 0
              ? `${totalYears} năm ${remainingMonths} tháng`
              : totalYears > 0
                ? `${totalYears} năm`
                : `${remainingMonths} tháng`;

          const requiredYears = Math.floor(requiredMonths / 12);
          const requiredRemainingMonths = requiredMonths % 12;
          const requiredYearsText =
            requiredYears > 0 && requiredRemainingMonths > 0
              ? `${requiredYears} năm ${requiredRemainingMonths} tháng`
              : requiredYears > 0
                ? `${requiredYears} năm`
                : `${requiredRemainingMonths} tháng`;

          const genderText = gioiTinh === 'NU' ? ' (Nữ giảm 1/3 thời gian)' : '';

          throw new ValidationError(
            `Quân nhân "${hoTen}" không đủ điều kiện đề xuất Huân chương Bảo vệ Tổ quốc ${rankName}. ` +
              `Yêu cầu: ít nhất ${requiredYearsText}${genderText}. Hiện tại: ${totalYearsText}. ` +
              `Vui lòng kiểm tra lại lịch sử chức vụ của quân nhân này.`
          );
        }
      }
    }

    // Persist proposal after validation.
    const isCoQuanDonVi = !!user.QuanNhan.co_quan_don_vi_id;
    const proposalData: Prisma.BangDeXuatUncheckedCreateInput = {
      nguoi_de_xuat_id: userId,
      loai_de_xuat: type,
      nam: parseInt(String(nam), 10) || new Date().getFullYear(),
      status: PROPOSAL_STATUS.PENDING,
      data_danh_hieu: dataDanhHieu as Prisma.InputJsonValue,
      data_thanh_tich: dataThanhTich as Prisma.InputJsonValue,
      data_nien_han: dataNienHan as Prisma.InputJsonValue,
      data_cong_hien: dataCongHien as Prisma.InputJsonValue,
      files_attached: filesInfo.length > 0 ? (filesInfo as Prisma.InputJsonValue) : null,
      ghi_chu: ghiChu || null,
      ...(isCoQuanDonVi
        ? { co_quan_don_vi_id: donViId, don_vi_truc_thuoc_id: null }
        : { co_quan_don_vi_id: null, don_vi_truc_thuoc_id: donViId }),
    };

    const proposal = await prisma.bangDeXuat.create({
      data: proposalData,
      include: {
        CoQuanDonVi: true,
        DonViTrucThuoc: {
          include: {
            CoQuanDonVi: true,
          },
        },
        NguoiDeXuat: {
          include: {
            QuanNhan: true,
          },
        },
      },
    });

    return {
      message: 'Đã gửi đề xuất khen thưởng thành công',
      proposal: {
        id: proposal.id,
        loai_de_xuat: proposal.loai_de_xuat,
        don_vi: (proposal.DonViTrucThuoc || proposal.CoQuanDonVi)?.ten_don_vi || '-',
        nguoi_de_xuat: proposal.NguoiDeXuat.QuanNhan?.ho_ten || proposal.NguoiDeXuat.username,
        status: proposal.status,
        so_personnel: titleData.length,
        createdAt: proposal.createdAt,
      },
    };
  } catch (error) {
    throw error;
  }
}

export { submitProposal };
