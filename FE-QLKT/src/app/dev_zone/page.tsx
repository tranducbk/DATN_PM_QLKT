'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Button,
  Input,
  Switch,
  Space,
  Typography,
  message,
  Select,
  Divider,
  Alert,
  Spin,
  ConfigProvider,
  theme,
} from 'antd';
import {
  LockOutlined,
  ThunderboltOutlined,
  ClockCircleOutlined,
  CloudUploadOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import Image from 'next/image';
import axiosInstance from '@/utils/axiosInstance';
import {
  DEV_ZONE_API,
  DEV_SESSION_KEY,
  DEV_SESSION_DURATION,
  CRON_PRESETS,
  AWARD_TYPE_OPTIONS,
  SYSTEM_FEATURE_OPTIONS,
  DEFAULT_CRON_SCHEDULE,
} from '@/constants/devZone.constants';

const { Title, Text, Paragraph } = Typography;

function FeatureRow({
  icon,
  title,
  description,
  checked,
  onChange,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  checked?: boolean;
  onChange: (v: boolean) => void;
}) {
  const isChecked = checked ?? false;
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <Space>
        {icon}
        <div>
          <Text strong>{title}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 12 }}>
            {description}
          </Text>
        </div>
      </Space>
      <Switch
        checked={isChecked}
        onChange={onChange}
        checkedChildren="BẬT"
        unCheckedChildren="TẮT"
      />
    </div>
  );
}

interface DevStatus {
  cron: {
    enabled: boolean;
    schedule: string;
    lastRun: string | null;
    lastResult: {
      status: string;
      time: string;
      success?: number;
      errors?: number;
      message?: string;
    } | null;
  };
  features: {
    import_enabled: boolean;
    template_enabled: boolean;
  };
}

function saveSession(pwd: string) {
  sessionStorage.setItem(
    DEV_SESSION_KEY,
    JSON.stringify({ pwd, expires: Date.now() + DEV_SESSION_DURATION })
  );
}

function loadSession(): string | null {
  try {
    const raw = sessionStorage.getItem(DEV_SESSION_KEY);
    if (!raw) return null;
    const { pwd, expires } = JSON.parse(raw);
    if (Date.now() > expires) {
      sessionStorage.removeItem(DEV_SESSION_KEY);
      return null;
    }
    return pwd;
  } catch {
    return null;
  }
}

function clearSession() {
  sessionStorage.removeItem(DEV_SESSION_KEY);
}

export default function DevZonePage() {
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [devPassword, setDevPassword] = useState('');

  const [status, setStatus] = useState<DevStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [triggerLoading, setTriggerLoading] = useState(false);

  const [cronPreset, setCronPreset] = useState('');
  const [customCron, setCustomCron] = useState('');

  // Khôi phục session khi mở lại trang (trong 5 phút)
  useEffect(() => {
    const saved = loadSession();
    if (saved) {
      setAuthenticated(true);
      setDevPassword(saved);
      fetchStatus(saved);
    }
  }, []);

  const fetchStatus = useCallback(async (pwd: string) => {
    try {
      setLoading(true);
      const res = await axiosInstance.get(DEV_ZONE_API + '/status', {
        headers: { 'x-dev-password': pwd },
      });
      if (res.data.success) {
        setStatus(res.data.data);
        // Sync cron preset
        const schedule = res.data.data.cron.schedule;
        const preset = CRON_PRESETS.find(p => p.value === schedule);
        if (preset) {
          setCronPreset(schedule);
        } else {
          setCronPreset('custom');
          setCustomCron(schedule);
        }
      }
    } catch (err: any) {
      if (err.response?.status === 401) {
        setAuthenticated(false);
        setDevPassword('');
        clearSession();
      } else {
        message.error('Không thể tải trạng thái');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const handleAuth = async () => {
    if (!password.trim()) {
      message.warning('Vui lòng nhập mật khẩu');
      return;
    }
    try {
      setAuthLoading(true);
      const res = await axiosInstance.post(DEV_ZONE_API + '/auth', { password });
      if (res.data.success) {
        setAuthenticated(true);
        setDevPassword(password);
        saveSession(password);
        setPassword('');
        fetchStatus(password);
      }
    } catch {
      message.error('Mật khẩu không đúng');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleTriggerCron = async () => {
    try {
      setTriggerLoading(true);
      const res = await axiosInstance.post(
        DEV_ZONE_API + '/cron/trigger',
        {},
        {
          headers: { 'x-dev-password': devPassword },
        }
      );
      if (res.data.success) {
        message.success(
          `Hoàn tất! Thành công: ${res.data.data.success}, Lỗi: ${res.data.data.errors}`
        );
        fetchStatus(devPassword);
      }
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Lỗi khi chạy cron job');
    } finally {
      setTriggerLoading(false);
    }
  };

  const handleUpdateCron = async (enabled?: boolean, schedule?: string) => {
    // Optimistic update cho toggle bật/tắt
    const prevEnabled = status?.cron.enabled;
    if (typeof enabled === 'boolean') {
      setStatus(prev => (prev ? { ...prev, cron: { ...prev.cron, enabled } } : prev));
    }

    try {
      const body: Record<string, unknown> = {};
      if (typeof enabled === 'boolean') body.enabled = enabled;
      if (schedule) body.schedule = schedule;

      const res = await axiosInstance.put(DEV_ZONE_API + '/cron/schedule', body, {
        headers: { 'x-dev-password': devPassword },
      });
      if (res.data.success) {
        fetchStatus(devPassword);
      }
    } catch (err: any) {
      // Revert nếu lỗi
      if (typeof enabled === 'boolean' && prevEnabled !== undefined) {
        setStatus(prev =>
          prev ? { ...prev, cron: { ...prev.cron, enabled: prevEnabled } } : prev
        );
      }
      message.error(err.response?.data?.message || 'Cập nhật thất bại');
    }
  };

  const handleToggleFeature = async (key: string, value: boolean) => {
    // Optimistic update — chuyển Switch ngay lập tức
    setStatus(prev =>
      prev
        ? {
            ...prev,
            features: { ...prev.features, [key]: value },
          }
        : prev
    );

    try {
      await axiosInstance.put(
        DEV_ZONE_API + '/features',
        { [key]: value },
        {
          headers: { 'x-dev-password': devPassword },
        }
      );
    } catch {
      // Revert nếu lỗi
      setStatus(prev =>
        prev
          ? {
              ...prev,
              features: { ...prev.features, [key]: !value },
            }
          : prev
      );
      message.error('Cập nhật thất bại');
    }
  };

  // Login screen
  if (!authenticated) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'radial-gradient(ellipse at 50% 0%, #1a2940 0%, #0a1628 60%, #050d1a 100%)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Background decoration */}
        <div
          style={{
            position: 'absolute',
            top: '20%',
            left: '50%',
            transform: 'translateX(-50%)',
            width: 500,
            height: 500,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(59,130,246,0.08) 0%, transparent 70%)',
            pointerEvents: 'none',
          }}
        />

        <Card
          style={{
            width: 400,
            textAlign: 'center',
            borderRadius: 20,
            border: '1px solid rgba(255,255,255,0.08)',
            background: 'rgba(255,255,255,0.95)',
            backdropFilter: 'blur(20px)',
            boxShadow: '0 25px 80px rgba(0,0,0,0.4), 0 0 40px rgba(59,130,246,0.1)',
          }}
          styles={{ body: { padding: '48px 36px 40px' } }}
        >
          <div
            style={{
              width: 100,
              height: 100,
              margin: '0 auto 20px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #f0f4ff 0%, #dbeafe 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 20px rgba(59,130,246,0.15)',
            }}
          >
            <Image
              src="/logo-msa.png"
              alt="MSA"
              width={70}
              height={70}
              style={{ objectFit: 'contain' }}
            />
          </div>

          <Title level={3} style={{ marginBottom: 4, letterSpacing: 1 }}>
            Developer Zone
          </Title>
          <Paragraph type="secondary" style={{ marginBottom: 28, fontSize: 14 }}>
            Khu vực quản trị hệ thống QLKT
          </Paragraph>

          <Input.Password
            prefix={<LockOutlined style={{ color: '#9ca3af' }} />}
            placeholder="Nhập mật khẩu truy cập"
            size="large"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onPressEnter={handleAuth}
            style={{
              marginBottom: 20,
              borderRadius: 10,
              height: 48,
            }}
          />

          <Button
            type="primary"
            size="large"
            block
            loading={authLoading}
            onClick={handleAuth}
            style={{
              height: 48,
              borderRadius: 10,
              fontWeight: 600,
              fontSize: 16,
              background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
              border: 'none',
              boxShadow: '0 4px 15px rgba(59,130,246,0.4)',
            }}
          >
            Truy cập
          </Button>
        </Card>
      </div>
    );
  }

  // Main dashboard — dùng Ant Design ConfigProvider dark theme
  return (
    <ConfigProvider
      theme={{
        algorithm: theme.darkAlgorithm,
        token: {
          colorBgContainer: 'rgba(255,255,255,0.06)',
          colorBorderSecondary: 'rgba(255,255,255,0.1)',
          borderRadius: 12,
        },
      }}
    >
      <div
        style={{
          minHeight: '100vh',
          background: 'radial-gradient(ellipse at 50% 0%, #1a2940 0%, #0a1628 60%, #050d1a 100%)',
          padding: '32px 16px',
        }}
      >
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <div style={{ display: 'inline-block', marginBottom: 12 }}>
              <Image src="/logo-msa.png" alt="MSA" width={56} height={56} />
            </div>
            <Title level={3} style={{ color: '#f1f5f9', margin: '0 0 4px', letterSpacing: 1 }}>
              Developer Zone
            </Title>
            <Text style={{ color: '#64748b', fontSize: 13 }}>Quản trị hệ thống QLKT</Text>
          </div>

          <Spin spinning={loading && !status}>
            <Space direction="vertical" size={20} style={{ width: '100%' }}>
              {/* Cron Job Control */}
              <Card
                title={
                  <Space>
                    <ClockCircleOutlined />
                    <span>Cron Job — Tính toán hồ sơ</span>
                  </Space>
                }
                extra={
                  <Button
                    icon={<ReloadOutlined />}
                    size="small"
                    onClick={() => fetchStatus(devPassword)}
                  >
                    Làm mới
                  </Button>
                }
                style={{ borderRadius: 16 }}
              >
                <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                  {/* Toggle */}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <Text strong>Bật/Tắt tự động</Text>
                    <Switch
                      checked={status?.cron.enabled ?? true}
                      onChange={v => handleUpdateCron(v)}
                      checkedChildren="BẬT"
                      unCheckedChildren="TẮT"
                    />
                  </div>

                  <Divider style={{ margin: '8px 0', borderColor: 'rgba(255,255,255,0.08)' }} />

                  {/* Schedule */}
                  <div>
                    <Text strong style={{ display: 'block', marginBottom: 8, color: '#e2e8f0' }}>
                      Lịch chạy
                    </Text>
                    <Space direction="vertical" size={8} style={{ width: '100%' }}>
                      <Select
                        style={{ width: '100%' }}
                        value={cronPreset}
                        onChange={v => {
                          setCronPreset(v);
                          if (v === 'custom') {
                            setCustomCron(status?.cron.schedule || '');
                          }
                        }}
                        options={CRON_PRESETS.map(p => ({ value: p.value, label: p.label }))}
                      />
                      {cronPreset === 'custom' && (
                        <Input
                          placeholder="Cron expression (ví dụ: */5 * * * *)"
                          value={customCron}
                          onChange={e => setCustomCron(e.target.value)}
                        />
                      )}
                      {/* Hiện nút Lưu chỉ khi đã load xong VÀ user thay đổi giá trị */}
                      {status &&
                        cronPreset &&
                        ((cronPreset !== 'custom' && cronPreset !== status.cron.schedule) ||
                          (cronPreset === 'custom' &&
                            customCron &&
                            customCron !== status.cron.schedule)) && (
                          <Button
                            type="primary"
                            block
                            onClick={() => {
                              const schedule = cronPreset === 'custom' ? customCron : cronPreset;
                              handleUpdateCron(undefined, schedule);
                            }}
                          >
                            Lưu lịch chạy
                          </Button>
                        )}
                    </Space>
                  </div>

                  <Divider style={{ margin: '8px 0', borderColor: 'rgba(255,255,255,0.08)' }} />

                  {/* Trigger */}
                  <Button
                    type="primary"
                    icon={<ThunderboltOutlined />}
                    loading={triggerLoading}
                    onClick={handleTriggerCron}
                    block
                    size="large"
                    style={{ background: '#d97706' }}
                  >
                    {triggerLoading ? 'Đang chạy...' : 'Chạy ngay bây giờ'}
                  </Button>

                  {/* Last run result */}
                  {status?.cron.lastResult && (
                    <Alert
                      type={status.cron.lastResult.status === 'success' ? 'success' : 'error'}
                      message={
                        <Space>
                          {status.cron.lastResult.status === 'success' ? (
                            <CheckCircleOutlined />
                          ) : (
                            <CloseCircleOutlined />
                          )}
                          Lần chạy gần nhất:{' '}
                          {status.cron.lastRun
                            ? new Date(status.cron.lastRun).toLocaleString('vi-VN')
                            : 'Chưa chạy'}
                        </Space>
                      }
                      description={
                        status.cron.lastResult.status === 'success'
                          ? `Thành công: ${status.cron.lastResult.success}, Lỗi: ${status.cron.lastResult.errors}`
                          : status.cron.lastResult.message
                      }
                      showIcon={false}
                    />
                  )}
                </Space>
              </Card>

              {/* Feature Toggles */}
              <Card
                title={
                  <Space>
                    <CloudUploadOutlined />
                    <span>Bật/Tắt tính năng</span>
                  </Space>
                }
                style={{ borderRadius: 16 }}
              >
                <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                  {AWARD_TYPE_OPTIONS.map(({ key, label, description }) => (
                    <FeatureRow
                      key={key}
                      icon={<CloudUploadOutlined />}
                      title={label}
                      description={description}
                      checked={(status?.features as any)?.[`allow_${key}`]}
                      onChange={v => handleToggleFeature(`allow_${key}`, v)}
                    />
                  ))}
                </Space>
              </Card>

              {/* System Feature Toggles */}
              <Card
                title={
                  <Space>
                    <ThunderboltOutlined />
                    <span>Tính năng hệ thống</span>
                  </Space>
                }
                style={{ borderRadius: 16 }}
              >
                <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                  {SYSTEM_FEATURE_OPTIONS.map(({ key, label, description }) => (
                    <FeatureRow
                      key={key}
                      icon={<ThunderboltOutlined />}
                      title={label}
                      description={description}
                      checked={(status?.features as any)?.[`allow_${key}`]}
                      onChange={v => handleToggleFeature(`allow_${key}`, v)}
                    />
                  ))}
                </Space>
              </Card>

              {/* Logout */}
              <div style={{ textAlign: 'center', paddingTop: 8, paddingBottom: 32 }}>
                <Button
                  type="text"
                  onClick={() => {
                    setAuthenticated(false);
                    setDevPassword('');
                    setStatus(null);
                    clearSession();
                  }}
                  style={{ color: '#94a3b8' }}
                >
                  Đăng xuất Dev Zone
                </Button>
              </div>
            </Space>
          </Spin>
        </div>
      </div>
    </ConfigProvider>
  );
}
