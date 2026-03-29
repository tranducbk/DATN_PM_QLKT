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
import { ArrowLeftOutlined, SaveOutlined, HomeOutlined } from '@ant-design/icons';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { useTheme } from '@/components/ThemeProvider';
import { apiClient } from '@/lib/apiClient';
import { getApiErrorMessage } from '@/lib/apiError';
import dayjs from 'dayjs';
import { MILITARY_RANKS } from '@/lib/constants/military-ranks';
import { useAuth } from '@/contexts/AuthContext';
import { ROLES } from '@/constants/roles.constants';
import { VietnamAddressCascader } from '@/components/VietnamAddressCascader';

const { Title } = Typography;

const parseAddressToArray = (addressString: string | null): string[] | undefined => {
  if (!addressString) return undefined;
  const parts = addressString.split(',').map(part => part.trim());
  if (parts.length !== 3) return undefined;
  const [ward, district, province] = parts;
  return [province, district, ward];
};

const formatAddressToString = (addressArray: string[]): string => {
  if (!addressArray || addressArray.length !== 3) return '';
  const [province, district, ward] = addressArray;
  return `${ward}, ${district}, ${province}`;
};

const formatAddressInput = (input: string): string => {
  if (!input || !input.trim()) return input;

  const singleAdminWords = ['tỉnh', 'tp', 'tp.', 'huyện', 'quận', 'xã', 'phường', 'tt', 'tt.'];
  const doubleAdminWords = ['thành phố', 'thị xã', 'thị trấn'];

  const parts = input.split(',').map(part => part.trim());

  const formattedParts = parts.map((part, partIndex) => {
    const words = part.split(/\s+/).filter(w => w.length > 0);
    if (words.length === 0) return '';

    const firstWord = words[0].toLowerCase();
    const secondWord = words[1]?.toLowerCase();

    let adminLength = 0;
    let formattedAdmin = '';

    if (secondWord && doubleAdminWords.includes(`${firstWord} ${secondWord}`)) {
      adminLength = 2;
      if (partIndex === 0) {
        const formattedFirst = firstWord.charAt(0).toUpperCase() + firstWord.slice(1);
        formattedAdmin = `${formattedFirst} ${secondWord}`;
      } else {
        formattedAdmin = `${firstWord} ${secondWord}`;
      }
    } else if (singleAdminWords.includes(firstWord)) {
      adminLength = 1;
      if (partIndex === 0) {
        formattedAdmin = firstWord.charAt(0).toUpperCase() + firstWord.slice(1);
      } else {
        formattedAdmin = firstWord;
      }
    }

    const capitalizeWord = (word: string) => {
      if (word.length === 0) return word;
      const idx = word.search(
        /[a-zA-ZàáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđĐ]/i
      );
      if (idx === -1) return word;
      return word.substring(0, idx) + word[idx].toUpperCase() + word.substring(idx + 1).toLowerCase();
    };

    if (adminLength > 0) {
      const placeNameWords = words.slice(adminLength);
      const formattedPlaceName = placeNameWords.map(capitalizeWord).join(' ');
      return `${formattedAdmin} ${formattedPlaceName}`;
    }

    return words.map(capitalizeWord).join(' ');
  });

  return formattedParts.join(', ');
};

export default function PersonnelEditPage() {
  const { theme } = useTheme();
  const router = useRouter();
  const params = useParams();
  const personnelId = params?.id as string;
  const [personnel, setPersonnel] = useState<any>(null);
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [coQuanDonViList, setCoQuanDonViList] = useState<any[]>([]);
  const [donViTrucThuocList, setDonViTrucThuocList] = useState<any[]>([]);
  const [positions, setPositions] = useState([]);

  const { user } = useAuth();
  const currentUserRole = user?.role || '';
  const [currentUnitName, setCurrentUnitName] = useState<string>('');
  const [personnelRole, setPersonnelRole] = useState<string>(''); // Role của personnel đang edit
  const [selectedCoQuanDonViId, setSelectedCoQuanDonViId] = useState<string | undefined>(undefined);
  const [selectedDonViTrucThuocId, setSelectedDonViTrucThuocId] = useState<string | undefined>(
    undefined
  );
  const [currentPositionId, setCurrentPositionId] = useState<string | undefined>(undefined); // Chức vụ hiện tại để luôn hiển thị

  useEffect(() => {
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
          setPersonnel(personnel);

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
            que_quan_3_cap: parseAddressToArray(personnel.que_quan_3_cap),
            tru_quan: personnel.tru_quan || '',
            cho_o_hien_nay: personnel.cho_o_hien_nay || '',
            ngay_vao_dang: personnel.ngay_vao_dang ? dayjs(personnel.ngay_vao_dang) : undefined,
            ngay_vao_dang_chinh_thuc: personnel.ngay_vao_dang_chinh_thuc
              ? dayjs(personnel.ngay_vao_dang_chinh_thuc)
              : undefined,
            so_the_dang_vien: personnel.so_the_dang_vien || '',
            so_dien_thoai: personnel.so_dien_thoai || '',
            co_quan_don_vi_id:
              personnel.co_quan_don_vi_id ||
              personnel.DonViTrucThuoc?.co_quan_don_vi_id ||
              undefined,
            don_vi_truc_thuoc_id: personnel.don_vi_truc_thuoc_id || undefined,
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

  const handleAddressBlur = (fieldName: string) => {
    const currentValue = form.getFieldValue(fieldName);
    if (currentValue && typeof currentValue === 'string') {
      const formatted = formatAddressInput(currentValue);
      if (formatted !== currentValue) {
        form.setFieldValue(fieldName, formatted);
      }
    }
  };

  const onFinish = async (values: any) => {
    try {
      setLoading(true);

      const formattedValues: any = {
        ho_ten: values.ho_ten,
        gioi_tinh: values.gioi_tinh,
        cccd: values.cccd && values.cccd.trim() ? values.cccd.trim() : null,
        cap_bac: values.cap_bac || null,
        ngay_sinh: values.ngay_sinh ? values.ngay_sinh.format('YYYY-MM-DD') : null,
        ngay_nhap_ngu: values.ngay_nhap_ngu ? values.ngay_nhap_ngu.format('YYYY-MM-DD') : null,
        ngay_xuat_ngu: values.ngay_xuat_ngu ? values.ngay_xuat_ngu.format('YYYY-MM-DD') : null,
        que_quan_2_cap: values.que_quan_2_cap || null,
        que_quan_3_cap: values.que_quan_3_cap ? formatAddressToString(values.que_quan_3_cap) : null,
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

      if (currentUserRole !== ROLES.MANAGER) {
        // Xác định đơn vị: hoặc là cơ quan đơn vị hoặc là đơn vị trực thuộc
        if (isManagerPersonnel) {
          // Nếu personnel có role MANAGER, chỉ lưu cơ quan đơn vị
          formattedValues.co_quan_don_vi_id = values.co_quan_don_vi_id;
          formattedValues.don_vi_truc_thuoc_id = null;
        } else if (values.don_vi_truc_thuoc_id) {
          // Nếu chọn đơn vị trực thuộc, gửi cả co_quan_don_vi_id và don_vi_truc_thuoc_id
          // BE sẽ tự động lấy co_quan_don_vi_id từ đơn vị cha của don_vi_truc_thuoc_id
          formattedValues.don_vi_truc_thuoc_id = values.don_vi_truc_thuoc_id;
          formattedValues.co_quan_don_vi_id = values.co_quan_don_vi_id;
        } else if (values.co_quan_don_vi_id) {
          // Nếu chỉ chọn cơ quan đơn vị
          formattedValues.co_quan_don_vi_id = values.co_quan_don_vi_id;
          formattedValues.don_vi_truc_thuoc_id = null;
        }
      }

      const response = await apiClient.updatePersonnel(personnelId, formattedValues);

      if (response.success) {
        message.success('Cập nhật quân nhân thành công');
        router.push(`/admin/personnel/${personnelId}`);
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
            { title: <Link href="/admin/dashboard"><HomeOutlined /></Link> },
            { title: <Link href="/admin/personnel">Quân nhân</Link> },
            { title: <Link href={`/admin/personnel/${personnelId}`}>{personnel?.ho_ten}</Link> },
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
              <Link href={`/admin/personnel/${personnelId}`}>
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
                autoComplete="off"
                requiredMark="optional"
                size="large"
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
                    <Input placeholder="Nhập họ và tên" disabled={loading} />
                  </Form.Item>

                  <Form.Item
                    name="cccd"
                    label="CCCD"
                    rules={[{ len: 12, message: 'CCCD phải có 12 số', whitespace: false }]}
                  >
                    <Input
                      placeholder="Nhập số CCCD (tùy chọn)"
                      disabled={loading}
                      maxLength={12}
                    />
                  </Form.Item>

                  <Form.Item
                    name="gioi_tinh"
                    label="Giới tính"
                    rules={[{ required: true, message: 'Vui lòng chọn giới tính' }]}
                  >
                    <Select placeholder="Chọn giới tính" disabled={loading}>
                      <Select.Option value="NAM">Nam</Select.Option>
                      <Select.Option value="NU">Nữ</Select.Option>
                    </Select>
                  </Form.Item>

                  <Form.Item
                    name="ngay_sinh"
                    label="Ngày sinh"
                    rules={[{ required: false }]}
                  >
                    <DatePicker
                      placeholder="Chọn ngày sinh"
                      format="DD/MM/YYYY"
                      disabled={loading}
                      style={{ width: '100%' }}
                    />
                  </Form.Item>

                  <Form.Item name="cap_bac" label="Cấp bậc" required={false}>
                    <Select placeholder="Chọn cấp bậc" disabled={loading} allowClear>
                      {MILITARY_RANKS.map(rank => (
                        <Select.Option key={rank} value={rank}>
                          {rank}
                        </Select.Option>
                      ))}
                    </Select>
                  </Form.Item>

                  <Form.Item name="so_dien_thoai" label="Số điện thoại">
                    <Input placeholder="Nhập số điện thoại" disabled={loading} maxLength={15} />
                  </Form.Item>
                </div>

                {/* Địa chỉ */}
                <Title level={5} className="!mb-4 !mt-0 border-b pb-2">
                  Thông tin địa chỉ
                </Title>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <Form.Item
                    name="que_quan_2_cap"
                    label="Quê quán (2 cấp)"
                    tooltip="Nhập địa chỉ, hệ thống sẽ tự động định dạng"
                  >
                    <Input
                      placeholder="VD: xã hoà an, tỉnh ninh bình"
                      disabled={loading}
                      onBlur={() => handleAddressBlur('que_quan_2_cap')}
                    />
                  </Form.Item>

                  <Form.Item name="que_quan_3_cap" label="Quê quán (3 cấp)">
                    <VietnamAddressCascader
                      placeholder="Chọn Tỉnh/Thành phố, Quận/Huyện, Xã/Phường"
                      disabled={loading}
                    />
                  </Form.Item>

                  <Form.Item
                    name="tru_quan"
                    label="Trú quán"
                    tooltip="Nhập địa chỉ, hệ thống sẽ tự động định dạng"
                  >
                    <Input
                      placeholder="VD: xã hoà an, tỉnh ninh bình"
                      disabled={loading}
                      onBlur={() => handleAddressBlur('tru_quan')}
                    />
                  </Form.Item>

                  <Form.Item
                    name="cho_o_hien_nay"
                    label="Chỗ ở hiện nay"
                    tooltip="Nhập địa chỉ, hệ thống sẽ tự động định dạng"
                  >
                    <Input
                      placeholder="VD: xã hoà an, tỉnh ninh bình"
                      disabled={loading}
                      onBlur={() => handleAddressBlur('cho_o_hien_nay')}
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
                      placeholder="Chọn ngày nhập ngũ"
                      format="DD/MM/YYYY"
                      disabled={loading}
                      style={{ width: '100%' }}
                    />
                  </Form.Item>

                  <Form.Item name="ngay_xuat_ngu" label="Ngày xuất ngũ">
                    <DatePicker
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
                      placeholder="Chọn ngày vào Đảng"
                      format="DD/MM/YYYY"
                      disabled={loading}
                      style={{ width: '100%' }}
                    />
                  </Form.Item>

                  <Form.Item name="ngay_vao_dang_chinh_thuc" label="Ngày vào Đảng chính thức">
                    <DatePicker
                      placeholder="Chọn ngày vào Đảng chính thức"
                      format="DD/MM/YYYY"
                      disabled={loading}
                      style={{ width: '100%' }}
                    />
                  </Form.Item>

                  <Form.Item name="so_the_dang_vien" label="Số thẻ Đảng viên">
                    <Input placeholder="Nhập số thẻ Đảng viên" disabled={loading} maxLength={50} />
                  </Form.Item>
                </div>

                {/* Phân công công tác */}
                <Title level={5} className="!mb-4 !mt-0 border-b pb-2">
                  Phân công công tác
                </Title>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {currentUserRole === ROLES.MANAGER ? (
                    <Form.Item label="Đơn vị" tooltip="Chỉ Admin mới có thể thay đổi đơn vị">
                      <Input value={currentUnitName} disabled placeholder="Đơn vị" />
                    </Form.Item>
                  ) : (
                    <>
                      {/* Cơ quan đơn vị */}
                      <Form.Item
                        name="co_quan_don_vi_id"
                        label="Cơ quan đơn vị"
                        rules={[{ required: true, message: 'Vui lòng chọn cơ quan đơn vị' }]}
                        tooltip={
                          isManagerPersonnel
                            ? 'Quân nhân MANAGER trực thuộc cơ quan đơn vị.'
                            : 'Chọn cơ quan đơn vị để xem các đơn vị trực thuộc.'
                        }
                      >
                        <Select
                          placeholder="Chọn cơ quan đơn vị"
                          disabled={loading}
                          showSearch
                          optionFilterProp="children"
                          onChange={value => {
                            setSelectedCoQuanDonViId(value);
                            setSelectedDonViTrucThuocId(undefined);
                            setCurrentPositionId(undefined); // Clear chức vụ hiện tại khi đổi đơn vị
                            // Reset đơn vị trực thuộc và chức vụ khi đổi cơ quan đơn vị
                            form.setFieldsValue({
                              don_vi_truc_thuoc_id: undefined,
                              chuc_vu_id: undefined,
                            });
                          }}
                        >
                          {coQuanDonViList.map((unit: any) => (
                            <Select.Option key={unit.id} value={unit.id}>
                              {unit.ten_don_vi} ({unit.ma_don_vi})
                            </Select.Option>
                          ))}
                        </Select>
                      </Form.Item>

                      {/* Đơn vị trực thuộc - Chỉ hiện nếu không phải MANAGER */}
                      {!isManagerPersonnel && (
                        <Form.Item
                          name="don_vi_truc_thuoc_id"
                          label="Đơn vị trực thuộc"
                          rules={[{ required: true, message: 'Vui lòng chọn đơn vị trực thuộc' }]}
                          tooltip="Quân nhân USER phải thuộc một đơn vị trực thuộc cụ thể."
                        >
                          <Select
                            placeholder={
                              !selectedCoQuanDonViId
                                ? 'Vui lòng chọn cơ quan đơn vị trước'
                                : 'Chọn đơn vị trực thuộc'
                            }
                            disabled={loading || !selectedCoQuanDonViId}
                            showSearch
                            optionFilterProp="children"
                            onChange={value => {
                              setSelectedDonViTrucThuocId(value);
                              setCurrentPositionId(undefined); // Clear chức vụ hiện tại khi đổi đơn vị
                              // Reset chức vụ khi đổi đơn vị trực thuộc
                              form.setFieldsValue({ chuc_vu_id: undefined });
                            }}
                          >
                            {donViTrucThuocList
                              .filter(
                                (unit: any) => unit.co_quan_don_vi_id === selectedCoQuanDonViId
                              )
                              .map((unit: any) => (
                                <Select.Option key={unit.id} value={unit.id}>
                                  {unit.ten_don_vi} ({unit.ma_don_vi})
                                </Select.Option>
                              ))}
                          </Select>
                        </Form.Item>
                      )}
                    </>
                  )}

                  <Form.Item
                    name="chuc_vu_id"
                    label="Chức vụ"
                    rules={[{ required: true, message: 'Vui lòng chọn chức vụ' }]}
                  >
                    <Select
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
                  <Link href={`/admin/personnel/${personnelId}`}>
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
