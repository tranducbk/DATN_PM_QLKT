'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Card,
  Typography,
  Button,
  Form,
  Input,
  Select,
  DatePicker,
  message,
  Breadcrumb,
  ConfigProvider,
  theme as antdTheme,
  Spin,
} from 'antd';
import { ArrowLeftOutlined, SaveOutlined } from '@ant-design/icons';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { useTheme } from '@/components/theme-provider';
import { apiClient } from '@/lib/api-client';
import { getApiErrorMessage } from '@/lib/apiError';
import dayjs from 'dayjs';
import { MILITARY_RANKS } from '@/lib/constants/military-ranks';
import { ROLES } from '@/constants/roles.constants';

const { Title } = Typography;

export default function ManagerPersonnelEditPage() {
  const { theme } = useTheme();
  const router = useRouter();
  const params = useParams();
  const personnelId = params?.id as string;
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [coQuanDonViList, setCoQuanDonViList] = useState<any[]>([]);
  const [donViTrucThuocList, setDonViTrucThuocList] = useState<any[]>([]);
  const [positions, setPositions] = useState([]);
  const [currentUnitName, setCurrentUnitName] = useState<string>('');
  const [personnelRole, setPersonnelRole] = useState<string>(''); // Role của personnel đang edit
  const [selectedCoQuanDonViId, setSelectedCoQuanDonViId] = useState<string | undefined>(undefined);
  const [selectedDonViTrucThuocId, setSelectedDonViTrucThuocId] = useState<string | undefined>(
    undefined
  );
  const [currentPositionId, setCurrentPositionId] = useState<string | undefined>(undefined); // Chức vụ hiện tại để luôn hiển thị
  const [managerUnitId, setManagerUnitId] = useState<string | null>(null);

  useEffect(() => {
    // Lấy đơn vị của manager từ localStorage
    const unitId = localStorage.getItem('unit_id');
    setManagerUnitId(unitId);

    const fetchData = async () => {
      try {
        setLoadingData(true);
        const [personnelRes, coQuanRes, donViTrucThuocRes, positionsRes] = await Promise.all([
          apiClient.getPersonnelById(personnelId),
          apiClient.getUnits(), // Cơ quan đơn vị
          apiClient.getSubUnits(), // Đơn vị trực thuộc
          apiClient.getPositions(),
        ]);

        // Lưu riêng 2 danh sách positions TRƯỚC
        const coQuanList = (coQuanRes?.data || []).filter((unit: any) => !unit.co_quan_don_vi_id);
        const donViList = donViTrucThuocRes?.data || [];
        const allPositions = positionsRes?.data || [];

        setCoQuanDonViList(coQuanList);
        setDonViTrucThuocList(donViList);
        setPositions(allPositions);

        if (personnelRes.success) {
          const personnel = personnelRes.data;

          // Lấy role của personnel từ account liên kết
          const role = personnel.TaiKhoan?.role || personnel.Account?.role || '';
          setPersonnelRole(role);

          // Xác định đơn vị hiện tại
          // Ưu tiên đơn vị trực thuộc trước (cho USER), sau đó mới đến cơ quan đơn vị (cho MANAGER)
          let currentUnit = '';
          let coQuanId = '';
          let donViTrucThuocId = '';

          if (personnel.don_vi_truc_thuoc_id) {
            // Personnel thuộc đơn vị trực thuộc (USER)
            currentUnit = personnel.DonViTrucThuoc?.ten_don_vi || '';
            // Lấy cơ quan đơn vị của đơn vị trực thuộc
            coQuanId = personnel.DonViTrucThuoc?.co_quan_don_vi_id || '';
            donViTrucThuocId = personnel.don_vi_truc_thuoc_id;
          } else if (personnel.co_quan_don_vi_id) {
            // Personnel thuộc cơ quan đơn vị (MANAGER)
            currentUnit = personnel.CoQuanDonVi?.ten_don_vi || '';
            coQuanId = personnel.co_quan_don_vi_id;
          }

          setCurrentUnitName(currentUnit);
          setSelectedCoQuanDonViId(coQuanId);
          setSelectedDonViTrucThuocId(donViTrucThuocId);

          // Lưu chức vụ hiện tại
          const positionId = personnel.chuc_vu_id || personnel.ChucVu?.id;
          setCurrentPositionId(positionId);

          // Set form values sau khi đã set state
          form.setFieldsValue({
            ho_ten: personnel.ho_ten,
            cccd: personnel.cccd,
            gioi_tinh: personnel.gioi_tinh || undefined,
            cap_bac: personnel.cap_bac || undefined,
            ngay_sinh: personnel.ngay_sinh ? dayjs(personnel.ngay_sinh) : undefined,
            ngay_nhap_ngu: personnel.ngay_nhap_ngu ? dayjs(personnel.ngay_nhap_ngu) : undefined,
            ngay_xuat_ngu: personnel.ngay_xuat_ngu ? dayjs(personnel.ngay_xuat_ngu) : undefined,
            que_quan_2_cap: personnel.que_quan_2_cap || '',
            que_quan_3_cap: personnel.que_quan_3_cap || '',
            tru_quan: personnel.tru_quan || '',
            cho_o_hien_nay: personnel.cho_o_hien_nay || '',
            ngay_vao_dang: personnel.ngay_vao_dang ? dayjs(personnel.ngay_vao_dang) : undefined,
            ngay_vao_dang_chinh_thuc: personnel.ngay_vao_dang_chinh_thuc
              ? dayjs(personnel.ngay_vao_dang_chinh_thuc)
              : undefined,
            so_the_dang_vien: personnel.so_the_dang_vien || '',
            so_dien_thoai: personnel.so_dien_thoai || '',
            chuc_vu_id: personnel.chuc_vu_id || personnel.ChucVu?.id,
          });
        } else {
          message.error(
            (personnelRes as { message?: string }).message || 'Không thể lấy thông tin quân nhân'
          );
        }
      } catch (error: unknown) {
        message.error(getApiErrorMessage(error, 'Lỗi khi tải dữ liệu'));
      } finally {
        setLoadingData(false);
      }
    };

    if (personnelId) {
      fetchData();
    }
  }, [personnelId, form]);

  // Kiểm tra xem có phải đang edit personnel có role MANAGER không
  const isManagerPersonnel = useMemo(() => personnelRole === ROLES.MANAGER, [personnelRole]);

  // Filter chức vụ dựa trên đơn vị đã chọn
  const filteredPositions = useMemo(() => {
    // Nếu đang load data ban đầu, hiện tất cả positions để Select có thể hiển thị đúng
    if (loadingData) {
      return positions;
    }

    let filtered: any[] = [];

    if (isManagerPersonnel) {
      // MANAGER: Chỉ hiện chức vụ của cơ quan đơn vị
      if (selectedCoQuanDonViId) {
        filtered = positions.filter((p: any) => p.co_quan_don_vi_id === selectedCoQuanDonViId);
      }
    } else {
      // USER: Chỉ hiện chức vụ của đơn vị trực thuộc
      if (selectedDonViTrucThuocId) {
        filtered = positions.filter(
          (p: any) => p.don_vi_truc_thuoc_id === selectedDonViTrucThuocId
        );
      }
    }

    // Luôn bao gồm chức vụ hiện tại nếu nó không có trong danh sách đã filter
    if (currentPositionId && !filtered.find((p: any) => p.id === currentPositionId)) {
      const currentPosition = positions.find((p: any) => p.id === currentPositionId);
      if (currentPosition) {
        filtered = [currentPosition, ...filtered];
      }
    }

    return filtered;
  }, [
    selectedDonViTrucThuocId,
    selectedCoQuanDonViId,
    positions,
    loadingData,
    currentPositionId,
    isManagerPersonnel,
  ]);

  const onFinish = async (values: any) => {
    try {
      setLoading(true);

      // Validate giới tính trước khi submit
      if (!values.gioi_tinh || (values.gioi_tinh !== 'NAM' && values.gioi_tinh !== 'NU')) {
        message.error('Vui lòng chọn giới tính');
        setLoading(false);
        return;
      }

      const formattedValues: any = {
        ho_ten: values.ho_ten,
        gioi_tinh: values.gioi_tinh, // Luôn gửi giá trị này lên backend
        cccd: values.cccd && values.cccd.trim() ? values.cccd.trim() : null,
        cap_bac: values.cap_bac || null,
        ngay_sinh: values.ngay_sinh ? values.ngay_sinh.format('YYYY-MM-DD') : null,
        ngay_nhap_ngu: values.ngay_nhap_ngu ? values.ngay_nhap_ngu.format('YYYY-MM-DD') : null,
        ngay_xuat_ngu: values.ngay_xuat_ngu ? values.ngay_xuat_ngu.format('YYYY-MM-DD') : null,
        que_quan_2_cap: values.que_quan_2_cap || null,
        que_quan_3_cap: values.que_quan_3_cap || null,
        tru_quan: values.tru_quan || null,
        cho_o_hien_nay: values.cho_o_hien_nay || null,
        ngay_vao_dang: values.ngay_vao_dang ? values.ngay_vao_dang.format('YYYY-MM-DD') : null,
        ngay_vao_dang_chinh_thuc: values.ngay_vao_dang_chinh_thuc
          ? values.ngay_vao_dang_chinh_thuc.format('YYYY-MM-DD')
          : null,
        so_the_dang_vien: values.so_the_dang_vien || null,
        so_dien_thoai: values.so_dien_thoai || null,
        chuc_vu_id: values.chuc_vu_id,
      };

      // Manager không thể thay đổi đơn vị, giữ nguyên đơn vị hiện tại
      // Không gửi co_quan_don_vi_id và don_vi_truc_thuoc_id

      const response = await apiClient.updatePersonnel(personnelId, formattedValues);

      if (response.success) {
        message.success('Cập nhật quân nhân thành công');
        router.push(`/manager/personnel/${personnelId}`);
      } else {
        message.error(
          (response as { message?: string }).message || 'Lỗi khi cập nhật quân nhân'
        );
      }
    } catch (error: unknown) {
      message.error(getApiErrorMessage(error, 'Lỗi khi cập nhật quân nhân'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ConfigProvider
      theme={{
        algorithm: theme === 'dark' ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
      }}
    >
      <div className="space-y-6 p-6">
        {/* Breadcrumb */}
        <Breadcrumb
          items={[
            { title: <Link href="/manager/dashboard">Dashboard</Link> },
            { title: <Link href="/manager/personnel">Quân nhân</Link> },
            { title: <Link href={`/manager/personnel/${personnelId}`}>#{personnelId}</Link> },
            { title: 'Chỉnh sửa' },
          ]}
        />

        {loadingData ? (
          <div className="flex justify-center items-center min-h-[400px]">
            <Spin size="large" />
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-center gap-4">
              <Link href={`/manager/personnel/${personnelId}`}>
                <Button icon={<ArrowLeftOutlined />}>Quay lại</Button>
              </Link>
              <Title level={2} className="!mb-0">
                Chỉnh sửa Quân nhân
              </Title>
            </div>

            {/* Form */}
            <Card className="shadow-sm">
              <Form
                form={form}
                layout="vertical"
                onFinish={onFinish}
                onFinishFailed={errorInfo => {
                  message.error('Vui lòng kiểm tra lại các trường bắt buộc');
                }}
                autoComplete="off"
                requiredMark="optional"
              >
                {/* Thông tin cơ bản */}
                <Title level={5} className="!mb-4 !mt-0 border-b pb-2">
                  Thông tin cơ bản
                </Title>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <Form.Item
                    name="ho_ten"
                    label="Họ và tên"
                    rules={[{ required: true, message: 'Vui lòng nhập họ tên' }]}
                  >
                    <Input size="large" placeholder="Nhập họ và tên" disabled={loading} />
                  </Form.Item>

                  <Form.Item
                    name="cccd"
                    label="CCCD"
                    rules={[{ len: 12, message: 'CCCD phải có 12 số', whitespace: false }]}
                  >
                    <Input
                      size="large"
                      placeholder="Nhập số CCCD (tùy chọn)"
                      disabled={loading}
                      maxLength={12}
                    />
                  </Form.Item>

                  <Form.Item
                    name="gioi_tinh"
                    label="Giới tính"
                    rules={[
                      { required: true, message: 'Vui lòng chọn giới tính' },
                      {
                        validator: (_, value) => {
                          if (!value) {
                            return Promise.reject(new Error('Vui lòng chọn giới tính'));
                          }
                          if (value !== 'NAM' && value !== 'NU') {
                            return Promise.reject(new Error('Giới tính phải là Nam hoặc Nữ'));
                          }
                          return Promise.resolve();
                        },
                      },
                    ]}
                  >
                    <Select
                      placeholder="Chọn giới tính"
                      disabled={loading}
                      size="large"
                      allowClear={false}
                    >
                      <Select.Option value="NAM">Nam</Select.Option>
                      <Select.Option value="NU">Nữ</Select.Option>
                    </Select>
                  </Form.Item>

                  <Form.Item name="ngay_sinh" label="Ngày sinh">
                    <DatePicker
                      size="large"
                      placeholder="Chọn ngày sinh"
                      format="DD/MM/YYYY"
                      disabled={loading}
                      style={{ width: '100%' }}
                    />
                  </Form.Item>

                  <Form.Item name="so_dien_thoai" label="Số điện thoại">
                    <Input
                      size="large"
                      placeholder="Nhập số điện thoại"
                      disabled={loading}
                      maxLength={15}
                    />
                  </Form.Item>
                </div>

                {/* Địa chỉ */}
                <Title level={5} className="!mb-4 !mt-0 border-b pb-2">
                  Thông tin địa chỉ
                </Title>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <Form.Item name="que_quan_2_cap" label="Quê quán (2 cấp)">
                    <Input
                      size="large"
                      placeholder="VD: Xã Hoà An, tỉnh Ninh Bình"
                      disabled={loading}
                    />
                  </Form.Item>

                  <Form.Item name="que_quan_3_cap" label="Quê quán (3 cấp)">
                    <Input
                      size="large"
                      placeholder="VD: Xã An Hoà, huyện Yên Bình, tỉnh Nam Định"
                      disabled={loading}
                    />
                  </Form.Item>

                  <Form.Item name="tru_quan" label="Trú quán">
                    <Input
                      size="large"
                      placeholder="VD: Xã Hoà An, tỉnh Ninh Bình"
                      disabled={loading}
                    />
                  </Form.Item>

                  <Form.Item name="cho_o_hien_nay" label="Chỗ ở hiện nay">
                    <Input
                      size="large"
                      placeholder="VD: Xã Hoà An, tỉnh Ninh Bình"
                      disabled={loading}
                    />
                  </Form.Item>
                </div>

                {/* Thông tin đơn vị và chức vụ */}
                <Title level={5} className="!mb-4 !mt-0 border-b pb-2">
                  Thông tin đơn vị & chức vụ
                </Title>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  {/* Nghề nghiệp quân đội */}
                  <Form.Item
                    name="ngay_nhap_ngu"
                    label="Ngày nhập ngũ"
                    rules={[{ required: true, message: 'Vui lòng chọn ngày nhập ngũ' }]}
                  >
                    <DatePicker
                      size="large"
                      placeholder="Chọn ngày nhập ngũ"
                      format="DD/MM/YYYY"
                      disabled={loading}
                      style={{ width: '100%' }}
                    />
                  </Form.Item>

                  <Form.Item name="ngay_xuat_ngu" label="Ngày xuất ngũ">
                    <DatePicker
                      size="large"
                      placeholder="Chọn ngày xuất ngũ"
                      format="DD/MM/YYYY"
                      disabled={loading}
                      style={{ width: '100%' }}
                    />
                  </Form.Item>
                </div>

                {/* Thông tin Đảng */}
                <Title level={5} className="!mb-4 !mt-0 border-b pb-2">
                  Thông tin Đảng
                </Title>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <Form.Item name="ngay_vao_dang" label="Ngày vào Đảng">
                    <DatePicker
                      size="large"
                      placeholder="Chọn ngày vào Đảng"
                      format="DD/MM/YYYY"
                      disabled={loading}
                      style={{ width: '100%' }}
                    />
                  </Form.Item>

                  <Form.Item name="ngay_vao_dang_chinh_thuc" label="Ngày vào Đảng chính thức">
                    <DatePicker
                      size="large"
                      placeholder="Chọn ngày vào Đảng chính thức"
                      format="DD/MM/YYYY"
                      disabled={loading}
                      style={{ width: '100%' }}
                    />
                  </Form.Item>

                  <Form.Item name="so_the_dang_vien" label="Số thẻ Đảng viên">
                    <Input
                      size="large"
                      placeholder="Nhập số thẻ Đảng viên"
                      disabled={loading}
                      maxLength={50}
                    />
                  </Form.Item>
                </div>

                {/* Phân công công tác */}
                <Title level={5} className="!mb-4 !mt-0 border-b pb-2">
                  Phân công công tác
                </Title>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Manager không thể thay đổi đơn vị */}
                  <Form.Item label="Đơn vị" tooltip="Chỉ Admin mới có thể thay đổi đơn vị">
                    <Input size="large" value={currentUnitName} disabled placeholder="Đơn vị" />
                  </Form.Item>

                  <Form.Item name="cap_bac" label="Cấp bậc" required={false}>
                    <Select placeholder="Chọn cấp bậc" disabled={loading} size="large" allowClear>
                      {MILITARY_RANKS.map(rank => (
                        <Select.Option key={rank} value={rank}>
                          {rank}
                        </Select.Option>
                      ))}
                    </Select>
                  </Form.Item>

                  <Form.Item
                    name="chuc_vu_id"
                    label="Chức vụ"
                    rules={[{ required: true, message: 'Vui lòng chọn chức vụ' }]}
                  >
                    <Select
                      size="large"
                      placeholder={
                        loadingData
                          ? 'Đang tải...'
                          : filteredPositions.length === 0
                            ? isManagerPersonnel
                              ? 'Vui lòng chọn cơ quan đơn vị trước'
                              : 'Vui lòng chọn đơn vị trực thuộc trước'
                            : 'Chọn chức vụ'
                      }
                      disabled={loading}
                      showSearch
                      optionFilterProp="children"
                      onChange={value => {
                        // Update currentPositionId khi user chọn chức vụ mới
                        setCurrentPositionId(value);
                      }}
                    >
                      {filteredPositions.map((pos: any) => (
                        <Select.Option key={pos.id} value={pos.id}>
                          {pos.ten_chuc_vu}
                        </Select.Option>
                      ))}
                    </Select>
                  </Form.Item>
                </div>

                <div className="flex justify-end gap-2 mt-6 pt-4 border-t">
                  <Link href={`/manager/personnel/${personnelId}`}>
                    <Button disabled={loading}>Hủy</Button>
                  </Link>
                  <Button
                    type="primary"
                    htmlType="submit"
                    loading={loading}
                    icon={<SaveOutlined />}
                  >
                    Lưu thay đổi
                  </Button>
                </div>
              </Form>
            </Card>
          </>
        )}
      </div>
    </ConfigProvider>
  );
}
