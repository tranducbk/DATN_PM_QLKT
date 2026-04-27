'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Card,
  Typography,
  Button,
  Steps,
  Space,
  Breadcrumb,
  Alert,
  Radio,
  message as antMessage,
  Descriptions,
  Tag,
  Table,
  Input,
  Empty,
} from 'antd';
import { getApiErrorMessage } from '@/lib/apiError';

import {
  HomeOutlined,
  TrophyOutlined,
  TeamOutlined,
  CheckCircleOutlined,
  ArrowLeftOutlined,
  EditOutlined,
  FileTextOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import Link from 'next/link';
import type { ColumnsType } from 'antd/es/table';
import { apiClient } from '@/lib/apiClient';
import { getDanhHieuName } from '@/constants/danhHieu.constants';
import { Step2SelectPersonnelNienHan } from '@/components/proposals/bulk/Step2SelectPersonnelNienHan';
import { Step3SetTitlesNienHan } from '@/components/proposals/bulk/Step3SetTitlesNienHan';
import { DecisionModal } from '@/components/DecisionModal';
import type { DateInput } from '@/lib/types/common';

const { Title, Paragraph, Text } = Typography;

interface Personnel {
  id: string;
  ho_ten: string;
  cccd: string;
  ngay_nhap_ngu?: DateInput;
  ngay_xuat_ngu?: DateInput;
  ChucVu?: {
    id: string;
    ten_chuc_vu: string;
  };
  cap_bac?: string;
  CoQuanDonVi?: {
    ten_don_vi: string;
  };
  DonViTrucThuoc?: {
    ten_don_vi: string;
  };
}

export default function SuperAdminAddAwardsPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);

  // Step 1: Select Personnel
  const [nam, setNam] = useState(new Date().getFullYear());
  const [thang, setThang] = useState(new Date().getMonth() + 1);
  const [selectedPersonnelIds, setSelectedPersonnelIds] = useState<string[]>([]);

  // Step 2: Set Titles
  const [titleData, setTitleData] = useState<any[]>([]);

  // Step 3: Personnel details for review
  const [personnelDetails, setPersonnelDetails] = useState<Personnel[]>([]);

  // Step 3: Note
  const [note, setNote] = useState<string>('');

  // Step 4: Decision data
  const [decisionDataMap, setDecisionDataMap] = useState<
    Record<string, { so_quyet_dinh: string; decision?: any }>
  >({});
  const [decisionModalVisible, setDecisionModalVisible] = useState(false);
  const [selectedPersonnelForDecision, setSelectedPersonnelForDecision] = useState<string[]>([]);

  const steps = [
    { title: 'Chọn loại', icon: <TrophyOutlined /> },
    { title: 'Chọn quân nhân', icon: <TeamOutlined /> },
    { title: 'Chọn danh hiệu', icon: <ClockCircleOutlined /> },
    { title: 'Xem lại thông tin', icon: <FileTextOutlined /> },
    { title: 'Số quyết định', icon: <FileTextOutlined /> },
    { title: 'Thêm khen thưởng', icon: <CheckCircleOutlined /> },
  ];

  useEffect(() => {
    if (currentStep === 0) {
      setSelectedPersonnelIds([]);
      setTitleData([]);
      setPersonnelDetails([]);
      setNote('');
      setDecisionDataMap({});
    }
  }, [currentStep]);

  // Fetch personnel details when reaching review step
  useEffect(() => {
    if (currentStep === 3 && selectedPersonnelIds.length > 0) {
      fetchPersonnelDetails();
    }
  }, [currentStep, selectedPersonnelIds]);

  const fetchPersonnelDetails = async () => {
    try {
      const promises = selectedPersonnelIds.map(id => apiClient.getPersonnelById(id));
      const responses = await Promise.all(promises);
      const personnelData = responses.filter(r => r.success).map(r => r.data);
      setPersonnelDetails(personnelData);
    } catch (error) {
      antMessage.error(getApiErrorMessage(error));
    }
  };

  // Validate current step
  const canProceedToNextStep = () => {
    switch (currentStep) {
      case 0:
        return true;
      case 1:
        return selectedPersonnelIds.length > 0;
      case 2: {
        const expectedLength = selectedPersonnelIds.length;
        if (titleData.length !== expectedLength) return false;
        return titleData.every(d => d.danh_hieu && d.cap_bac?.trim() && d.chuc_vu?.trim());
      }
      case 3:
        return true; // Review step
      case 4: {
        // All personnel must have a decision number before submitting
        return selectedPersonnelIds.every(id => decisionDataMap[id]?.so_quyet_dinh?.trim());
      }
      default:
        return false;
    }
  };

  // Handle next step
  const handleNext = async () => {
    if (canProceedToNextStep()) {
      setCurrentStep(currentStep + 1);
    } else {
      switch (currentStep) {
        case 1:
          antMessage.warning('Vui lòng chọn ít nhất một quân nhân!');
          break;
        case 2:
          antMessage.warning(
            'Vui lòng chọn danh hiệu và nhập đầy đủ cấp bậc/chức vụ cho tất cả quân nhân!'
          );
          break;
        case 4:
          antMessage.warning('Vui lòng nhập số quyết định cho tất cả quân nhân!');
          break;
      }
    }
  };

  // Handle previous step
  const handlePrev = () => {
    if (currentStep === 2) {
      setTitleData([]);
    }
    setCurrentStep(currentStep - 1);
  };

  // Handle submit
  const handleSubmit = async () => {
    try {
      const missingDecision = selectedPersonnelIds.some(
        id => !decisionDataMap[id]?.so_quyet_dinh?.trim()
      );
      if (missingDecision) {
        antMessage.error(
          'Vui lòng nhập số quyết định cho tất cả quân nhân trước khi thêm khen thưởng!'
        );
        return;
      }

      setLoading(true);

      const titleDataWithDecisions = titleData.map(item => {
        const personnelId = item.personnel_id;
        const decisionInfo = decisionDataMap[personnelId];
        return {
          ...item,
          so_quyet_dinh: decisionInfo?.so_quyet_dinh || null,
        };
      });

      const formData = new FormData();
      formData.append('type', 'NIEN_HAN');
      formData.append('nam', String(nam));
      formData.append('selected_personnel', JSON.stringify(selectedPersonnelIds));
      formData.append('title_data', JSON.stringify(titleDataWithDecisions));

      if (note.trim()) {
        formData.append('ghi_chu', note.trim());
      }

      const result = await apiClient.bulkCreateAwards(formData);

      if (result.success) {
        const data = result.data || {};
        const importedCount = data.importedCount || 0;
        const errorCount = data.errorCount || 0;

        const message =
          importedCount > 0
            ? `Đã thêm thành công ${importedCount} khen thưởng HCCSVV${
                errorCount > 0 ? `, ${errorCount} lỗi` : ''
              }`
            : 'Thêm khen thưởng thành công!';

        if (errorCount > 0 && data.errors) {
          antMessage.warning(message);
        } else {
          antMessage.success(message);
        }

        setTimeout(() => {
          router.push('/admin/awards');
        }, 1000);
      } else {
        throw new Error(result.message || 'Thêm khen thưởng thất bại');
      }
    } catch (error: unknown) {
      antMessage.error(getApiErrorMessage(error, 'Lỗi khi thêm khen thưởng'));
    } finally {
      setLoading(false);
    }
  };

  // Render step content
  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <div>
            <Alert
              message="Bước 1: Chọn loại khen thưởng"
              description="Chọn loại khen thưởng cần thêm vào hệ thống"
              type="info"
              showIcon
              style={{ marginBottom: 24 }}
            />
            <Radio.Group value="HCCSVV" size="large" style={{ width: '100%' }}>
              <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                <Radio.Button
                  value="HCCSVV"
                  style={{ width: '100%', height: 'auto', padding: '16px' }}
                >
                  <Space direction="vertical" size="small">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 20, color: '#1890ff' }}>
                        <ClockCircleOutlined />
                      </span>
                      <Text strong style={{ fontSize: 16 }}>
                        Huy chương Chiến sĩ vẻ vang
                      </Text>
                    </div>
                    <Text
                      type="secondary"
                      style={{ fontSize: 13, display: 'block', marginLeft: 28 }}
                    >
                      Huy chương Chiến sĩ vẻ vang 3 hạng (hạng Ba, Nhì, Nhất) - Không kiểm tra điều
                      kiện thời gian phục vụ
                    </Text>
                  </Space>
                </Radio.Button>
              </Space>
            </Radio.Group>
          </div>
        );

      case 1: // Step 2: Select Personnel (with bypassEligibility)
        return (
          <Step2SelectPersonnelNienHan
            selectedPersonnelIds={selectedPersonnelIds}
            onPersonnelChange={setSelectedPersonnelIds}
            nam={nam}
            onNamChange={setNam}
            thang={thang}
            onThangChange={setThang}
            onTitleDataChange={setTitleData}
            onNextStep={() => setCurrentStep(prev => prev + 1)}
            bypassEligibility={true}
          />
        );

      case 2: // Step 3: Set Titles (with bypassEligibility)
        return (
          <Step3SetTitlesNienHan
            selectedPersonnelIds={selectedPersonnelIds}
            onPersonnelChange={setSelectedPersonnelIds}
            titleData={titleData}
            onTitleDataChange={setTitleData}
            nam={nam}
            thang={thang}
            bypassEligibility={true}
          />
        );

      case 3: {
        // Step 4: Review
        const reviewTableData = personnelDetails.map(p => {
          const titleInfo = titleData.find(t => String(t.personnel_id) === String(p.id));
          return {
            ...p,
            ...titleInfo,
            cap_bac: titleInfo?.cap_bac || '',
            chuc_vu: titleInfo?.chuc_vu || '',
          };
        });

        const reviewColumns: ColumnsType<any> = [
          {
            title: 'STT',
            key: 'index',
            width: 60,
            align: 'center',
            render: (_, __, index) => index + 1,
          },
          {
            title: 'Họ và tên',
            dataIndex: 'ho_ten',
            key: 'ho_ten',
            width: 200,
            align: 'center',
            render: (text: string) => <Text strong>{text}</Text>,
          },
          {
            title: 'Cấp bậc / Chức vụ',
            key: 'cap_bac_chuc_vu',
            width: 200,
            align: 'center',
            render: (_, record: any) => (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <Text strong style={{ marginBottom: '4px' }}>
                  {record.cap_bac || '-'}
                </Text>
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  {record.chuc_vu || '-'}
                </Text>
              </div>
            ),
          },
          {
            title: 'Danh hiệu',
            key: 'danh_hieu',
            width: 250,
            align: 'center',
            render: (_, record) => {
              const titleInfo = titleData.find(t => String(t.personnel_id) === String(record.id));
              const danh_hieu = titleInfo?.danh_hieu;
              const fullName = getDanhHieuName(danh_hieu);
              return <Text>{fullName || '-'}</Text>;
            },
          },
        ];

        return (
          <div>
            <Alert
              message="Xem lại thông tin"
              description="Kiểm tra kỹ thông tin trước khi tiếp tục"
              type="success"
              showIcon
              style={{ marginBottom: 24 }}
            />

            <Card title="Tóm tắt" style={{ marginBottom: 16 }}>
              <Descriptions bordered column={2}>
                <Descriptions.Item label="Loại khen thưởng" span={2}>
                  <Tag icon={<ClockCircleOutlined />}>Huy chương Chiến sĩ vẻ vang</Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Năm">
                  <Text strong>{nam}</Text>
                </Descriptions.Item>
                <Descriptions.Item label="Số quân nhân">
                  <Text strong>{selectedPersonnelIds.length}</Text>
                </Descriptions.Item>
              </Descriptions>
            </Card>

            <Card title="Danh sách quân nhân và danh hiệu">
              <Table
                columns={reviewColumns}
                dataSource={reviewTableData}
                rowKey="id"
                pagination={false}
                size="small"
                bordered
                scroll={{ x: 800 }}
                locale={{ emptyText: <Empty description="Không có dữ liệu" /> }}
              />
            </Card>

            <Card
              title={
                <Space>
                  <EditOutlined />
                  <span>Ghi chú (tùy chọn)</span>
                </Space>
              }
              style={{ marginTop: 16 }}
            >
              <Input.TextArea
                placeholder="Nhập ghi chú (không bắt buộc)..."
                value={note}
                onChange={e => setNote(e.target.value)}
                rows={3}
                maxLength={1000}
                showCount
              />
            </Card>
          </div>
        );
      }

      case 4: {
        // Step 5: Decision numbers
        const decisionColumns: ColumnsType<any> = [
          {
            title: 'STT',
            key: 'index',
            width: 60,
            align: 'center',
            render: (_, __, index) => index + 1,
          },
          {
            title: 'Họ và tên',
            dataIndex: 'ho_ten',
            key: 'ho_ten',
            width: 200,
            align: 'center',
            render: (text: string) => <Text strong>{text}</Text>,
          },
          {
            title: 'Số quyết định',
            key: 'so_quyet_dinh',
            width: 300,
            align: 'center',
            render: (_, record) => {
              const id = record.id;
              const decisionInfo = decisionDataMap[id];
              const soQuyetDinh = decisionInfo?.so_quyet_dinh;

              return (
                <Space>
                  {soQuyetDinh ? (
                    <Tag
                      color="green"
                      closable
                      onClose={() => {
                        const newMap = { ...decisionDataMap };
                        delete newMap[id];
                        setDecisionDataMap(newMap);
                      }}
                    >
                      {soQuyetDinh}
                    </Tag>
                  ) : (
                    <Text type="secondary">Chưa có số quyết định</Text>
                  )}
                  <Button
                    size="small"
                    type="link"
                    onClick={() => {
                      setSelectedPersonnelForDecision([id]);
                      setDecisionModalVisible(true);
                    }}
                  >
                    {soQuyetDinh ? 'Sửa' : 'Thêm'}
                  </Button>
                </Space>
              );
            },
          },
        ];

        return (
          <div>
            <Alert
              message="Thêm số quyết định"
              description="Thêm số quyết định cho từng quân nhân (tùy chọn)"
              type="info"
              showIcon
              style={{ marginBottom: 24 }}
            />

            <Card
              title="Danh sách quân nhân"
              extra={
                <Button
                  type="primary"
                  onClick={() => {
                    setSelectedPersonnelForDecision(selectedPersonnelIds);
                    setDecisionModalVisible(true);
                  }}
                >
                  Thêm số quyết định cho tất cả
                </Button>
              }
            >
              <Table
                columns={decisionColumns}
                dataSource={personnelDetails}
                rowKey="id"
                pagination={false}
                size="small"
                bordered
              />
            </Card>
          </div>
        );
      }

      case 5: {
        // Step 6: Final confirm
        const finalColumns: ColumnsType<any> = [
          {
            title: 'STT',
            key: 'index',
            width: 60,
            align: 'center',
            render: (_, __, index) => index + 1,
          },
          {
            title: 'Họ và tên',
            dataIndex: 'ho_ten',
            key: 'ho_ten',
            width: 200,
            align: 'center',
            render: (text: string) => <Text strong>{text}</Text>,
          },
          {
            title: 'Danh hiệu',
            key: 'danh_hieu',
            width: 250,
            align: 'center',
            render: (_, record) => {
              const titleInfo = titleData.find(t => String(t.personnel_id) === String(record.id));
              const danh_hieu = titleInfo?.danh_hieu;
              const fullName = getDanhHieuName(danh_hieu);
              return <Text>{fullName || '-'}</Text>;
            },
          },
          {
            title: 'Số quyết định',
            key: 'so_quyet_dinh',
            width: 200,
            align: 'center',
            render: (_, record) => {
              const id = record.id;
              const decisionInfo = decisionDataMap[id];
              return decisionInfo?.so_quyet_dinh ? (
                <Tag color="green">{decisionInfo.so_quyet_dinh}</Tag>
              ) : (
                <Text type="secondary">Chưa có</Text>
              );
            },
          },
        ];

        return (
          <div>
            <Alert
              message="Xác nhận và thêm khen thưởng"
              description="Kiểm tra lại thông tin trước khi thêm khen thưởng vào hệ thống. Lưu ý: Chức năng này thêm trực tiếp vào cơ sở dữ liệu mà không kiểm tra điều kiện thời gian phục vụ."
              type="warning"
              showIcon
              style={{ marginBottom: 24 }}
            />

            <Card title="Danh sách khen thưởng sẽ được thêm">
              <Table
                columns={finalColumns}
                dataSource={personnelDetails}
                rowKey="id"
                pagination={false}
                size="small"
                bordered
                scroll={{ x: 800 }}
              />
            </Card>
          </div>
        );
      }

      default:
        return null;
    }
  };

  // Handle decision modal success
  const handleDecisionSuccess = (decision: any) => {
    const newMap = { ...decisionDataMap };
    selectedPersonnelForDecision.forEach(id => {
      newMap[id] = {
        so_quyet_dinh: decision.so_quyet_dinh,
        decision: decision,
      };
    });
    setDecisionDataMap(newMap);
    setDecisionModalVisible(false);
    setSelectedPersonnelForDecision([]);
    antMessage.success('Đã thêm số quyết định thành công');
  };

  return (
    <div style={{ padding: '24px' }}>
      {/* Breadcrumb */}
      <Breadcrumb
        style={{ marginBottom: 16 }}
        items={[
          {
            title: (
              <Link href="/super-admin/dashboard">
                <HomeOutlined />
              </Link>
            ),
          },
          {
            title: 'Thêm khen thưởng HCCSVV',
          },
        ]}
      />

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 8 }}>
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => {
              if (currentStep === 0) {
                router.push('/admin/awards');
              } else {
                setCurrentStep(0);
              }
            }}
            style={{ marginBottom: 0 }}
          >
            {currentStep === 0 ? 'Quay lại' : 'Quay lại chọn loại'}
          </Button>
        </div>
        <Title level={2} style={{ marginBottom: 8 }}>
          Thêm khen thưởng đồng loạt
        </Title>
        <Paragraph type="secondary">
          Theo dõi các bước bên dưới để thêm khen thưởng vào hệ thống. Không kiểm tra điều kiện thời
          gian phục vụ, dùng để bổ sung dữ liệu quá khứ.
        </Paragraph>
      </div>

      {/* Steps Progress */}
      <Card style={{ marginBottom: 24 }}>
        <Steps current={currentStep} items={steps} />
      </Card>

      {/* Step Content */}
      <Card style={{ marginBottom: 24, minHeight: 400 }}>{renderStepContent()}</Card>

      {/* Navigation */}
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <Button size="large" onClick={handlePrev} disabled={currentStep === 0}>
            Quay lại
          </Button>
          <div>
            {currentStep < steps.length - 1 ? (
              <Button
                type="primary"
                size="large"
                onClick={handleNext}
                disabled={!canProceedToNextStep()}
              >
                Tiếp tục
              </Button>
            ) : (
              <Button
                type="primary"
                size="large"
                onClick={handleSubmit}
                loading={loading}
                disabled={loading}
                icon={<CheckCircleOutlined />}
              >
                Thêm khen thưởng
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Decision Modal */}
      <DecisionModal
        visible={decisionModalVisible}
        onClose={() => {
          setDecisionModalVisible(false);
          setSelectedPersonnelForDecision([]);
        }}
        onSuccess={handleDecisionSuccess}
        loaiKhenThuong="NIEN_HAN"
      />
    </div>
  );
}
