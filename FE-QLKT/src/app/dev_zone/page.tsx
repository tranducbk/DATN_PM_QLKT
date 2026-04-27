'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Button,
  Input,
  InputNumber,
  Switch,
  Space,
  message,
  Select,
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
  DeleteOutlined,
  ToolOutlined,
  DatabaseOutlined,
} from '@ant-design/icons';
import Image from 'next/image';
import { isAxiosError } from 'axios';
import axiosInstance from '@/lib/axiosInstance';
import { getApiErrorMessage } from '@/lib/apiError';
import {
  DEV_ZONE_API,
  DEV_SESSION_KEY,
  DEV_SESSION_DURATION,
  CRON_PRESETS,
  BACKUP_CRON_PRESETS,
  AWARD_TYPE_OPTIONS,
  SYSTEM_FEATURE_OPTIONS,
} from '@/constants/devZone.constants';
import './dev-zone.css';

const DEFAULT_RETENTION_DAYS = 15;

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
  return (
    <div className="dz-feature-row">
      <div className="dz-feature-info">
        <span className="dz-feature-icon">{icon}</span>
        <div>
          <div className="dz-feature-label">{title}</div>
          <div className="dz-feature-desc">{description}</div>
        </div>
      </div>
      <Switch
        checked={checked ?? false}
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
  } & Record<string, boolean | undefined>;
}

interface BackupStatus {
  enabled: boolean;
  schedule: string;
  retentionDays: number;
  lastRun: string | null;
  totalFiles: number;
}

function saveSession(pwd: string) {
  sessionStorage.setItem(
    DEV_SESSION_KEY,
    JSON.stringify({ t: btoa(encodeURIComponent(pwd)), e: Date.now() + DEV_SESSION_DURATION }),
  );
}

function loadSession(): string | null {
  try {
    const raw = sessionStorage.getItem(DEV_SESSION_KEY);
    if (!raw) return null;
    const { t, e } = JSON.parse(raw);
    if (Date.now() > e) {
      sessionStorage.removeItem(DEV_SESSION_KEY);
      return null;
    }
    return decodeURIComponent(atob(t));
  } catch {
    sessionStorage.removeItem(DEV_SESSION_KEY);
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
  const [recalcLoading, setRecalcLoading] = useState(false);

  const [backupStatus, setBackupStatus] = useState<BackupStatus | null>(null);
  const [backupPreset, setBackupPreset] = useState('');
  const [backupCustomCron, setBackupCustomCron] = useState('');
  const [backupRetention, setBackupRetention] = useState<number>(15);
  const [backupTriggerLoading, setBackupTriggerLoading] = useState(false);

  const fetchBackupStatus = useCallback(async (pwd: string) => {
    try {
      const res = await axiosInstance.get(DEV_ZONE_API + '/backup/status', {
        headers: { 'x-dev-password': pwd },
      });
      if (res.data.success) {
        const data: BackupStatus = res.data.data;
        setBackupStatus(data);
        setBackupRetention(data.retentionDays);
        const preset = BACKUP_CRON_PRESETS.find(p => p.value === data.schedule);
        if (preset) {
          setBackupPreset(data.schedule);
        } else {
          setBackupPreset('custom');
          setBackupCustomCron(data.schedule);
        }
      }
    } catch {
      // non-critical
    }
  }, []);

  const fetchStatus = useCallback(async (pwd: string) => {
    try {
      setLoading(true);
      const [statusRes] = await Promise.all([
        axiosInstance.get(DEV_ZONE_API + '/status', { headers: { 'x-dev-password': pwd } }),
        fetchBackupStatus(pwd),
      ]);
      if (statusRes.data.success) {
        setStatus(statusRes.data.data);
        const schedule = statusRes.data.data.cron.schedule;
        const preset = CRON_PRESETS.find(p => p.value === schedule);
        if (preset) {
          setCronPreset(schedule);
        } else {
          setCronPreset('custom');
          setCustomCron(schedule);
        }
      }
    } catch (err: unknown) {
      if (isAxiosError(err) && err.response?.status === 401) {
        setAuthenticated(false);
        setDevPassword('');
        clearSession();
      } else {
        message.error('Không thể tải trạng thái');
      }
    } finally {
      setLoading(false);
    }
  }, [fetchBackupStatus]);

  useEffect(() => {
    const saved = loadSession();
    if (saved) {
      setAuthenticated(true);
      setDevPassword(saved);
      fetchStatus(saved);
    }
  }, [fetchStatus]);

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
        { headers: { 'x-dev-password': devPassword } },
      );
      if (res.data.success) {
        message.success(
          `Hoàn tất! Thành công: ${res.data.data.success}, Lỗi: ${res.data.data.errors}`,
        );
        fetchStatus(devPassword);
      }
    } catch (err: unknown) {
      message.error(getApiErrorMessage(err, 'Lỗi khi chạy cron job'));
    } finally {
      setTriggerLoading(false);
    }
  };

  const handleRecalculateUnitCount = async () => {
    try {
      setRecalcLoading(true);
      const res = await axiosInstance.post(
        DEV_ZONE_API + '/recalculate-unit-count',
        {},
        { headers: { 'x-dev-password': devPassword } },
      );
      if (res.data.success) {
        message.success(`Đã cập nhật quân số cho ${res.data.data.updated} đơn vị`);
      }
    } catch (err: unknown) {
      message.error(getApiErrorMessage(err, 'Lỗi khi tính lại quân số'));
    } finally {
      setRecalcLoading(false);
    }
  };

  const handleUpdateCron = async (enabled?: boolean, schedule?: string) => {
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
    } catch (err: unknown) {
      if (typeof enabled === 'boolean' && prevEnabled !== undefined) {
        setStatus(prev =>
          prev ? { ...prev, cron: { ...prev.cron, enabled: prevEnabled } } : prev,
        );
      }
      message.error(getApiErrorMessage(err, 'Cập nhật thất bại'));
    }
  };

  const handleTriggerBackup = async () => {
    try {
      setBackupTriggerLoading(true);
      const res = await axiosInstance.post(
        DEV_ZONE_API + '/backup/trigger',
        {},
        { headers: { 'x-dev-password': devPassword } },
      );
      if (res.data.success) {
        message.success(`Backup thành công: ${res.data.data.filename} (${res.data.data.sizeKB} KB)`);
        fetchBackupStatus(devPassword);
      }
    } catch (err: unknown) {
      message.error(getApiErrorMessage(err, 'Backup thất bại'));
    } finally {
      setBackupTriggerLoading(false);
    }
  };

  const handleUpdateBackupSchedule = async (
    enabled?: boolean,
    schedule?: string,
    retentionDays?: number,
  ) => {
    try {
      const body: Record<string, unknown> = {};
      if (typeof enabled === 'boolean') body.enabled = enabled;
      if (schedule) body.schedule = schedule;
      if (retentionDays !== undefined) body.retentionDays = retentionDays;

      const res = await axiosInstance.put(DEV_ZONE_API + '/backup/schedule', body, {
        headers: { 'x-dev-password': devPassword },
      });
      if (res.data.success) {
        fetchBackupStatus(devPassword);
      }
    } catch (err: unknown) {
      message.error(getApiErrorMessage(err, 'Cập nhật thất bại'));
    }
  };

  const handleToggleFeature = async (key: string, value: boolean) => {
    setStatus(prev =>
      prev ? { ...prev, features: { ...prev.features, [key]: value } } : prev,
    );

    try {
      await axiosInstance.put(
        DEV_ZONE_API + '/features',
        { [key]: value },
        { headers: { 'x-dev-password': devPassword } },
      );
    } catch {
      setStatus(prev =>
        prev ? { ...prev, features: { ...prev.features, [key]: !value } } : prev,
      );
      message.error('Cập nhật thất bại');
    }
  };

  // Login screen
  if (!authenticated) {
    return (
      <div className="dz-page">
        <div className="dz-bg">
          <div className="dz-orb dz-orb-1"></div>
          <div className="dz-orb dz-orb-2"></div>
        </div>

        <div className="dz-auth">
          <div className="dz-auth-card">
            <div className="dz-auth-logo">
              <Image src="/logo-msa.png" alt="MSA" width={52} height={52} style={{ objectFit: 'contain' }} />
            </div>
            <h1 className="dz-auth-title">Developer Zone</h1>
            <p className="dz-auth-sub">Khu vực quản trị hệ thống QLKT</p>

            <Input.Password
              prefix={<LockOutlined />}
              placeholder="Nhập mật khẩu truy cập"
              size="large"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onPressEnter={handleAuth}
              className="dz-auth-input"
            />

            <Button
              type="primary"
              size="large"
              block
              loading={authLoading}
              onClick={handleAuth}
              className="dz-auth-btn"
            >
              Truy cập
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const showSaveBtn =
    status &&
    cronPreset &&
    ((cronPreset !== 'custom' && cronPreset !== status.cron.schedule) ||
      (cronPreset === 'custom' && customCron && customCron !== status.cron.schedule));

  // Dashboard
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
      <div className="dz-page">
        <div className="dz-bg">
          <div className="dz-orb dz-orb-1"></div>
          <div className="dz-orb dz-orb-2"></div>
        </div>

        <div className="dz-dashboard">
          {/* Header */}
          <div className="dz-header">
            <div className="dz-header-logo">
              <Image src="/logo-msa.png" alt="MSA" width={48} height={48} />
            </div>
            <h1 className="dz-header-title">Developer Zone</h1>
            <p className="dz-header-sub">Quản trị hệ thống QLKT</p>
          </div>

          <Spin spinning={loading && !status}>
            {/* Cron Job */}
            <div className="dz-card">
              <div className="dz-card-title">
                <ClockCircleOutlined />
                <span>Cron Job — Tính toán hồ sơ</span>
                <div style={{ marginLeft: 'auto' }}>
                  <Button
                    icon={<ReloadOutlined />}
                    size="small"
                    type="text"
                    className="dz-refresh-btn"
                    onClick={() => fetchStatus(devPassword)}
                  />
                </div>
              </div>

              {/* Toggle */}
              <div className="dz-feature-row">
                <span className="dz-feature-label">Bật/Tắt tự động</span>
                <Switch
                  checked={status?.cron.enabled ?? true}
                  onChange={v => handleUpdateCron(v)}
                  checkedChildren="BẬT"
                  unCheckedChildren="TẮT"
                />
              </div>

              <div className="dz-divider" />

              {/* Schedule */}
              <div>
                <div className="dz-schedule-label">Lịch chạy</div>
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
                  {showSaveBtn && (
                    <Space style={{ width: '100%' }} styles={{ item: { flex: 1 } }}>
                      <Button
                        block
                        onClick={() => {
                          const saved = status?.cron.schedule ?? '';
                          const preset = CRON_PRESETS.find(p => p.value === saved);
                          if (preset) {
                            setCronPreset(saved);
                          } else {
                            setCronPreset('custom');
                            setCustomCron(saved);
                          }
                        }}
                      >
                        Huỷ
                      </Button>
                      <Button
                        type="primary"
                        block
                        className="dz-save-btn"
                        onClick={() => {
                          const schedule = cronPreset === 'custom' ? customCron : cronPreset;
                          handleUpdateCron(undefined, schedule);
                        }}
                      >
                        Lưu lịch chạy
                      </Button>
                    </Space>
                  )}
                </Space>
              </div>

              <div className="dz-divider" />

              {/* Trigger */}
              <Button
                type="primary"
                icon={<ThunderboltOutlined />}
                loading={triggerLoading}
                onClick={handleTriggerCron}
                block
                className="dz-trigger-btn"
              >
                {triggerLoading ? 'Đang chạy...' : 'Chạy ngay bây giờ'}
              </Button>

              {/* Last run result */}
              {status?.cron.lastResult && (
                <div style={{ marginTop: 12 }}>
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
                        ? `Thành công: ${status.cron.lastResult.success ?? 0}, Lỗi: ${status.cron.lastResult.errors ?? 0}`
                        : status.cron.lastResult.message
                    }
                    showIcon={false}
                  />
                </div>
              )}
            </div>

            {/* Feature Toggles */}
            <div className="dz-card">
              <div className="dz-card-title">
                <CloudUploadOutlined />
                <span>Bật/Tắt tính năng</span>
              </div>
              {AWARD_TYPE_OPTIONS.map(({ key, label, description }) => (
                <FeatureRow
                  key={key}
                  icon={<CloudUploadOutlined />}
                  title={label}
                  description={description}
                  checked={Boolean(status?.features?.[`allow_${key}`])}
                  onChange={v => handleToggleFeature(`allow_${key}`, v)}
                />
              ))}
            </div>

            {/* System Feature Toggles */}
            <div className="dz-card">
              <div className="dz-card-title">
                <ThunderboltOutlined />
                <span>Tính năng hệ thống</span>
              </div>
              {SYSTEM_FEATURE_OPTIONS.map(({ key, label, description }) => (
                <FeatureRow
                  key={key}
                  icon={<ThunderboltOutlined />}
                  title={label}
                  description={description}
                  checked={Boolean(status?.features?.[`allow_${key}`])}
                  onChange={v => handleToggleFeature(`allow_${key}`, v)}
                />
              ))}
            </div>

            {/* Tính toán lại */}
            <div className="dz-card">
              <div className="dz-card-title">
                <ReloadOutlined />
                <span>Tính toán lại</span>
              </div>
              <div className="dz-util-row">
                <div className="dz-util-info">
                  <ReloadOutlined className="dz-feature-icon" />
                  <div>
                    <div className="dz-feature-label">Quân số đơn vị</div>
                    <div className="dz-feature-desc">Đồng bộ lại số lượng quân nhân từng đơn vị từ dữ liệu thực tế</div>
                  </div>
                </div>
                <Button
                  type="primary"
                  icon={<ReloadOutlined />}
                  loading={recalcLoading}
                  onClick={handleRecalculateUnitCount}
                >
                  {recalcLoading ? 'Đang tính...' : 'Tính lại'}
                </Button>
              </div>
            </div>

            {/* Backup */}
            <div className="dz-card">
              <div className="dz-card-title">
                <DatabaseOutlined />
                <span>Sao lưu dữ liệu</span>
                <div style={{ marginLeft: 'auto', fontSize: 12, opacity: 0.6 }}>
                  {backupStatus ? `${backupStatus.totalFiles} file` : ''}
                </div>
              </div>

              <div className="dz-feature-row">
                <span className="dz-feature-label">Tự động backup</span>
                <Switch
                  checked={backupStatus?.enabled ?? false}
                  onChange={v => {
                    setBackupStatus(prev => prev ? { ...prev, enabled: v } : prev);
                    handleUpdateBackupSchedule(v);
                  }}
                  checkedChildren="BẬT"
                  unCheckedChildren="TẮT"
                />
              </div>

              <div className="dz-divider" />

              <div>
                <div className="dz-schedule-label">Lịch backup</div>
                <Space direction="vertical" size={8} style={{ width: '100%' }}>
                  <Select
                    style={{ width: '100%' }}
                    value={backupPreset}
                    onChange={v => {
                      setBackupPreset(v);
                      if (v === 'custom') setBackupCustomCron(backupStatus?.schedule || '');
                    }}
                    options={BACKUP_CRON_PRESETS.map(p => ({ value: p.value, label: p.label }))}
                  />
                  {backupPreset === 'custom' && (
                    <Input
                      placeholder="Cron expression (ví dụ: 0 3 * * *)"
                      value={backupCustomCron}
                      onChange={e => setBackupCustomCron(e.target.value)}
                    />
                  )}
                  {backupPreset &&
                    ((backupPreset !== 'custom' && backupPreset !== backupStatus?.schedule) ||
                      (backupPreset === 'custom' && backupCustomCron && backupCustomCron !== backupStatus?.schedule)) && (
                    <Space style={{ width: '100%' }} styles={{ item: { flex: 1 } }}>
                      <Button
                        block
                        onClick={() => {
                          const saved = backupStatus?.schedule ?? '';
                          const preset = BACKUP_CRON_PRESETS.find(p => p.value === saved);
                          if (preset) {
                            setBackupPreset(saved);
                          } else {
                            setBackupPreset('custom');
                            setBackupCustomCron(saved);
                          }
                        }}
                      >
                        Huỷ
                      </Button>
                      <Button
                        type="primary"
                        block
                        className="dz-save-btn"
                        onClick={() => {
                          const schedule = backupPreset === 'custom' ? backupCustomCron : backupPreset;
                          handleUpdateBackupSchedule(undefined, schedule);
                        }}
                      >
                        Lưu lịch backup
                      </Button>
                    </Space>
                  )}
                </Space>
              </div>

              <div className="dz-divider" />

              <div>
                <div className="dz-schedule-label">Giữ backup trong (ngày)</div>
                <Space size={8}>
                  <InputNumber
                    min={1}
                    max={365}
                    value={backupRetention}
                    onChange={v => setBackupRetention(v ?? DEFAULT_RETENTION_DAYS)}
                    style={{ width: 100 }}
                  />
                  {backupRetention !== backupStatus?.retentionDays && (
                    <Space styles={{ item: { flex: 1 } }}>
                      <Button
                        block
                        onClick={() => setBackupRetention(backupStatus?.retentionDays ?? DEFAULT_RETENTION_DAYS)}
                      >
                        Huỷ
                      </Button>
                      <Button
                        type="primary"
                        block
                        className="dz-save-btn"
                        onClick={() => handleUpdateBackupSchedule(undefined, undefined, backupRetention)}
                      >
                        Lưu
                      </Button>
                    </Space>
                  )}
                </Space>
              </div>

              <div className="dz-divider" />

              <Button
                type="primary"
                icon={<DatabaseOutlined />}
                loading={backupTriggerLoading}
                onClick={handleTriggerBackup}
                block
                className="dz-trigger-btn"
              >
                {backupTriggerLoading ? 'Đang backup...' : 'Backup ngay'}
              </Button>

              {backupStatus?.lastRun && (
                <div style={{ marginTop: 12 }}>
                  <Alert
                    type="info"
                    message={`Lần backup gần nhất: ${new Date(backupStatus.lastRun).toLocaleString('vi-VN')}`}
                    showIcon={false}
                  />
                </div>
              )}
            </div>

            {/* Tiện ích */}
            <div className="dz-card">
              <div className="dz-card-title">
                <ToolOutlined />
                <span>Tiện ích</span>
              </div>
              <div className="dz-util-row">
                <div className="dz-util-info">
                  <DeleteOutlined className="dz-feature-icon" />
                  <div>
                    <div className="dz-feature-label">Xoá localStorage</div>
                    <div className="dz-feature-desc">Xoá toàn bộ dữ liệu lưu trữ cục bộ trên trình duyệt</div>
                  </div>
                </div>
                <Button
                  className="dz-delete-btn"
                  onClick={() => {
                    localStorage.clear();
                    message.success('Đã xoá toàn bộ localStorage');
                  }}
                >
                  Xoá
                </Button>
              </div>
            </div>

            {/* Logout */}
            <div className="dz-logout">
              <Button
                type="text"
                className="dz-logout-btn"
                onClick={() => {
                  setAuthenticated(false);
                  setDevPassword('');
                  setStatus(null);
                  clearSession();
                          }}
              >
                Đăng xuất Dev Zone
              </Button>
            </div>
          </Spin>
        </div>
      </div>
    </ConfigProvider>
  );
}
