'use client';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Eye } from 'lucide-react';
import Link from 'next/link';
import { formatDate } from '@/lib/utils';

/** Dữ liệu một dòng quân nhân cho bảng (tối thiểu các field đang render). */
export interface PersonnelTableRow {
  id: string;
  ho_ten?: string | null;
  ngay_sinh?: string | null;
  cap_bac?: string | null;
  ChucVu?: { ten_chuc_vu?: string | null };
  ten_chuc_vu?: string | null;
  CoQuanDonVi?: { ten_don_vi?: string | null };
  DonViTrucThuoc?: {
    ten_don_vi?: string | null;
    CoQuanDonVi?: { ten_don_vi?: string | null };
  };
}

interface PersonnelTableProps {
  personnel: PersonnelTableRow[];
  /** Offset STT khi phân trang server (vd: (page - 1) * pageSize). Mặc định 0. */
  sttOffset?: number;
  onEdit?: (p: PersonnelTableRow) => void;
  onRefresh?: () => void;
  readOnly?: boolean;
  viewLinkPrefix?: string;
}

export function PersonnelTable({
  personnel,
  sttOffset = 0,
  onEdit,
  readOnly = false,
  viewLinkPrefix = '/admin/personnel',
}: PersonnelTableProps) {
  return (
    <>
      <div className="min-w-0 max-w-full">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[80px] text-center">STT</TableHead>
              <TableHead className="w-[140px] text-center">Họ tên</TableHead>
              <TableHead className="w-[180px] text-center">Cơ quan đơn vị</TableHead>
              <TableHead className="w-[180px] text-center">Đơn vị trực thuộc</TableHead>
              <TableHead className="w-[140px] text-center">Cấp bậc</TableHead>
              <TableHead className="w-[160px] text-center">Chức vụ</TableHead>
              <TableHead className="w-[150px] text-center">Hành động</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {personnel.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground h-24">
                  Không có dữ liệu
                </TableCell>
              </TableRow>
            ) : (
              personnel.map((p, index) => {
                const coQuanDonViName =
                  p.DonViTrucThuoc?.CoQuanDonVi?.ten_don_vi || p.CoQuanDonVi?.ten_don_vi || '-';

                const donViTrucThuocName = p.DonViTrucThuoc?.ten_don_vi || '-';

                return (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium text-center">{sttOffset + index + 1}</TableCell>
                    <TableCell className="text-center">
                      <div className="flex flex-col">
                        <span className="font-medium">{p.ho_ten}</span>
                        {p.ngay_sinh && (
                          <span className="text-xs text-muted-foreground mt-1">
                            {formatDate(p.ngay_sinh)}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">{coQuanDonViName}</TableCell>
                    <TableCell className="text-center">{donViTrucThuocName}</TableCell>
                    <TableCell className="text-center">{p.cap_bac || '-'}</TableCell>
                    <TableCell className="text-center">
                      {p.ChucVu?.ten_chuc_vu || p.ten_chuc_vu || '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-2 justify-end">
                        {readOnly ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onEdit?.(p)}
                            className="hover:bg-blue-50 hover:border-blue-500 hover:text-blue-600 dark:hover:bg-blue-900/20"
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            Xem
                          </Button>
                        ) : (
                          <Link href={`${viewLinkPrefix}/${p.id}`}>
                            <Button
                              variant="outline"
                              size="sm"
                              className="hover:bg-blue-50 hover:border-blue-500 hover:text-blue-600 dark:hover:bg-blue-900/20"
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              Xem
                            </Button>
                          </Link>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
