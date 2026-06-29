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
  TimePicker,
  Alert,
  Spin,
  Popconfirm,
  ConfigProvider,
  theme,
} from 'antd';
import dayjs from 'dayjs';
import {
  LockOutlined,
  ThunderboltOutlined,
  ClockCircleOutlined,
  CloudUploadOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ToolOutlined,
  DatabaseOutlined,
  BulbOutlined,
} from '@ant-design/icons';
import Image from 'next/image';
import { isAxiosError } from 'axios';
import axiosInstance from '@/lib/http/axiosInstance';
import { getApiErrorMessage } from '@/lib/http/apiError';
import {
  DEV_ZONE_API,
  CRON_PRESETS,
  BACKUP_CRON_PRESETS,
  BACKUP_FREQUENCY_OPTIONS,
  BACKUP_WEEKDAY_OPTIONS,
  AWARD_TYPE_OPTIONS,
  SYSTEM_FEATURE_OPTIONS,
} from '@/constants/devZone.constants';
import { formatDateTime } from '@/lib/utils';
import { useTheme } from '@/components/ThemeProvider';
import type { DevStatus, BackupStatus } from './types';
import type { BackupScheduleParts } from './helpers';
import {
  DEFAULT_RETENTION_DAYS,
  DEFAULT_BACKUP_PARTS,
  buildBackupCron,
  parseBackupCron,
  saveSession,
  loadSession,
  clearSession,
} from './helpers';
import './dev-zone.css';

function FeatureRow({
  title,
  description,
  checked,
  onChange,
}: {
  title: string;
  description: string;
  checked?: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="dz-feature-row">
      <div className="dz-feature-info">
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

export default function DevZonePage() {
  const { isDark, toggle } = useTheme();
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [devPassword, setDevPassword] = useState('');

  const [status, setStatus] = useState<DevStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [triggerLoading, setTriggerLoading] = useState(false);

  const [cronPreset, setCronPreset] = useState('');
  const [cronCustomParts, setCronCustomParts] = useState<BackupScheduleParts>(DEFAULT_BACKUP_PARTS);
  const [recalcLoading, setRecalcLoading] = useState(false);
  const [recalcPersonnelId, setRecalcPersonnelId] = useState('');
  const [recalcProfileLoading, setRecalcProfileLoading] = useState(false);
  const [recalcAllProfileLoading, setRecalcAllProfileLoading] = useState(false);

  const [backupStatus, setBackupStatus] = useState<BackupStatus | null>(null);
  const [backupPreset, setBackupPreset] = useState('');
  const [backupCustom, setBackupCustom] = useState<BackupScheduleParts>(DEFAULT_BACKUP_PARTS);
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
          setBackupCustom(parseBackupCron(data.schedule));
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
          setCronCustomParts(parseBackupCron(schedule));
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

  const handleRecalculateProfile = async () => {
    const id = recalcPersonnelId.trim();
    if (!id) {
      message.warning('Vui lòng nhập ID quân nhân');
      return;
    }
    try {
      setRecalcProfileLoading(true);
      const res = await axiosInstance.post(
        DEV_ZONE_API + '/recalculate-profile',
        { personnel_id: id },
        { headers: { 'x-dev-password': devPassword } },
      );
      if (res.data.success) {
        message.success(res.data.message || 'Đã tính toán lại hồ sơ quân nhân');
      }
    } catch (err: unknown) {
      message.error(getApiErrorMessage(err, 'Lỗi khi tính lại hồ sơ quân nhân'));
    } finally {
      setRecalcProfileLoading(false);
    }
  };

  const handleRecalculateAllProfiles = async () => {
    try {
      setRecalcAllProfileLoading(true);
      const res = await axiosInstance.post(
        DEV_ZONE_API + '/recalculate-profile',
        {},
        { headers: { 'x-dev-password': devPassword } },
      );
      if (res.data.success) {
        message.success(res.data.message || 'Đã tính toán lại hồ sơ tất cả quân nhân');
      }
    } catch (err: unknown) {
      message.error(getApiErrorMessage(err, 'Lỗi khi tính lại hồ sơ quân nhân'));
    } finally {
      setRecalcAllProfileLoading(false);
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
        message.success(`Sao lưu thành công: ${res.data.data.filename} (${res.data.data.sizeKB} KB)`);
        fetchBackupStatus(devPassword);
      }
    } catch (err: unknown) {
      message.error(getApiErrorMessage(err, 'Sao lưu thất bại'));
    } finally {
      setBackupTriggerLoading(false);
    }
  };

  const handleDeleteBackupFile = async (filename: string) => {
    try {
      const res = await axiosInstance.delete(
        DEV_ZONE_API + '/backup/' + encodeURIComponent(filename),
        { headers: { 'x-dev-password': devPassword } },
      );
      if (res.data.success) {
        message.success('Đã xoá file sao lưu');
        fetchBackupStatus(devPassword);
      }
    } catch (err: unknown) {
      message.error(getApiErrorMessage(err, 'Xoá file sao lưu thất bại'));
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

  const themeToggle = (
    <div className="dz-theme-toggle">
      <Button className="dz-refresh-btn" size="small" icon={<BulbOutlined />} onClick={toggle}>
        {isDark ? 'Sáng' : 'Tối'}
      </Button>
    </div>
  );

  // Login screen
  if (!authenticated) {
    return (
      <div className="dz-page">
        {themeToggle}
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

  const cronCustomCron = buildBackupCron(cronCustomParts);
  const showSaveBtn =
    status &&
    cronPreset &&
    ((cronPreset !== 'custom' && cronPreset !== status.cron.schedule) ||
      (cronPreset === 'custom' && cronCustomCron !== status.cron.schedule));

  const backupCustomCron = buildBackupCron(backupCustom);
  const showBackupSaveBtn =
    backupPreset &&
    ((backupPreset !== 'custom' && backupPreset !== backupStatus?.schedule) ||
      (backupPreset === 'custom' && backupCustomCron !== backupStatus?.schedule));

  // Dashboard
  return (
    <ConfigProvider
      theme={{
        algorithm: isDark ? theme.darkAlgorithm : theme.defaultAlgorithm,
        token: {
          colorPrimary: '#3b82f6',
          borderRadius: 10,
          ...(isDark
            ? {
                colorBgContainer: '#1a2540',
                colorBgElevated: '#16213c',
                colorBorder: '#26334d',
                colorBorderSecondary: '#26334d',
                colorText: '#e2e8f0',
              }
            : {}),
        },
      }}
    >
      <div className="dz-page">
        {themeToggle}
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
                        setCronCustomParts(parseBackupCron(status?.cron.schedule || ''));
                      }
                    }}
                    options={CRON_PRESETS.map(p => ({ value: p.value, label: p.label }))}
                  />
                  {cronPreset === 'custom' && (
                    <div className="dz-backup-builder">
                      <div className="dz-backup-row">
                        <span className="dz-backup-row-label">Tần suất</span>
                        <Select
                          className="dz-backup-row-control"
                          value={cronCustomParts.frequency}
                          onChange={v =>
                            setCronCustomParts(prev => ({
                              ...prev,
                              frequency: v as BackupScheduleParts['frequency'],
                            }))
                          }
                          options={BACKUP_FREQUENCY_OPTIONS.map(o => ({ value: o.value, label: o.label }))}
                        />
                      </div>
                      {cronCustomParts.frequency === 'weekly' && (
                        <div className="dz-backup-row">
                          <span className="dz-backup-row-label">Vào thứ</span>
                          <Select
                            className="dz-backup-row-control"
                            value={cronCustomParts.dayOfWeek}
                            onChange={v => setCronCustomParts(prev => ({ ...prev, dayOfWeek: v }))}
                            options={BACKUP_WEEKDAY_OPTIONS.map(o => ({ value: o.value, label: o.label }))}
                          />
                        </div>
                      )}
                      {cronCustomParts.frequency === 'monthly' && (
                        <div className="dz-backup-row">
                          <span className="dz-backup-row-label">Vào ngày</span>
                          <InputNumber
                            className="dz-backup-row-control"
                            min={1}
                            max={28}
                            value={cronCustomParts.dayOfMonth}
                            onChange={v => setCronCustomParts(prev => ({ ...prev, dayOfMonth: v ?? 1 }))}
                          />
                        </div>
                      )}
                      <div className="dz-backup-row">
                        <span className="dz-backup-row-label">Vào lúc</span>
                        <TimePicker
                          className="dz-backup-row-control"
                          format="HH:mm"
                          allowClear={false}
                          needConfirm={false}
                          value={dayjs().hour(cronCustomParts.hour).minute(cronCustomParts.minute)}
                          onChange={d =>
                            d && setCronCustomParts(prev => ({ ...prev, hour: d.hour(), minute: d.minute() }))
                          }
                        />
                      </div>
                    </div>
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
                            setCronCustomParts(parseBackupCron(saved));
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
                          const schedule = cronPreset === 'custom' ? cronCustomCron : cronPreset;
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
                        {status.cron.lastRun ? formatDateTime(status.cron.lastRun) : 'Chưa chạy'}
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
                  title={label}
                  description={description}
                  checked={Boolean(status?.features?.[`allow_${key}`])}
                  onChange={v => handleToggleFeature(`allow_${key}`, v)}
                />
              ))}
            </div>

            {/* Recalculation */}
            <div className="dz-card">
              <div className="dz-card-title">
                <ReloadOutlined />
                <span>Tính toán lại</span>
              </div>
              <div className="dz-util-row">
                <div className="dz-util-info">
                  <div>
                    <div className="dz-feature-label">Quân số đơn vị</div>
                    <div className="dz-feature-desc">Đồng bộ lại số lượng quân nhân từng đơn vị từ dữ liệu thực tế</div>
                  </div>
                </div>
                <Button
                  type="primary"
                  loading={recalcLoading}
                  onClick={handleRecalculateUnitCount}
                >
                  {recalcLoading ? 'Đang tính...' : 'Tính lại'}
                </Button>
              </div>

              <div className="dz-divider" />

              <div>
                <div className="dz-feature-label">Hồ sơ một quân nhân (theo ID)</div>
                <div className="dz-feature-desc" style={{ marginBottom: 8 }}>
                  Tính lại hồ sơ hằng năm, niên hạn và cống hiến của một quân nhân theo ID
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <Input
                    placeholder="Nhập ID quân nhân"
                    value={recalcPersonnelId}
                    onChange={e => setRecalcPersonnelId(e.target.value)}
                    onPressEnter={handleRecalculateProfile}
                    style={{ flex: 1 }}
                  />
                  <Button
                    type="primary"
                    loading={recalcProfileLoading}
                    onClick={handleRecalculateProfile}
                  >
                    Tính lại
                  </Button>
                </div>
              </div>

              <div className="dz-divider" />

              <div className="dz-util-row">
                <div className="dz-util-info">
                  <div>
                    <div className="dz-feature-label">Tất cả hồ sơ quân nhân</div>
                    <div className="dz-feature-desc">Tính lại cả 3 loại hồ sơ cho toàn bộ quân nhân (có thể mất vài phút)</div>
                  </div>
                </div>
                <Popconfirm
                  title="Tính lại hồ sơ cho tất cả quân nhân?"
                  description="Thao tác có thể mất vài phút với dữ liệu lớn."
                  okText="Tính lại"
                  cancelText="Huỷ"
                  onConfirm={handleRecalculateAllProfiles}
                >
                  <Button type="primary" loading={recalcAllProfileLoading}>
                    {recalcAllProfileLoading ? 'Đang tính...' : 'Tính lại tất cả'}
                  </Button>
                </Popconfirm>
              </div>
            </div>

            {/* Backup */}
            <div className="dz-card">
              <div className="dz-card-title">
                <DatabaseOutlined />
                <span>Sao lưu dữ liệu</span>
                <div style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--dz-text-3)' }}>
                  {backupStatus ? `${backupStatus.totalFiles} file` : ''}
                </div>
              </div>

              <div className="dz-feature-row">
                <span className="dz-feature-label">Tự động sao lưu</span>
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
                <div className="dz-schedule-label">Lịch sao lưu</div>
                <Space direction="vertical" size={8} style={{ width: '100%' }}>
                  <Select
                    style={{ width: '100%' }}
                    value={backupPreset}
                    onChange={v => {
                      setBackupPreset(v);
                      if (v === 'custom') setBackupCustom(parseBackupCron(backupStatus?.schedule || ''));
                    }}
                    options={BACKUP_CRON_PRESETS.map(p => ({ value: p.value, label: p.label }))}
                  />
                  {backupPreset === 'custom' && (
                    <div className="dz-backup-builder">
                      <div className="dz-backup-row">
                        <span className="dz-backup-row-label">Tần suất</span>
                        <Select
                          className="dz-backup-row-control"
                          value={backupCustom.frequency}
                          onChange={v =>
                            setBackupCustom(prev => ({
                              ...prev,
                              frequency: v as BackupScheduleParts['frequency'],
                            }))
                          }
                          options={BACKUP_FREQUENCY_OPTIONS.map(o => ({ value: o.value, label: o.label }))}
                        />
                      </div>
                      {backupCustom.frequency === 'weekly' && (
                        <div className="dz-backup-row">
                          <span className="dz-backup-row-label">Vào thứ</span>
                          <Select
                            className="dz-backup-row-control"
                            value={backupCustom.dayOfWeek}
                            onChange={v => setBackupCustom(prev => ({ ...prev, dayOfWeek: v }))}
                            options={BACKUP_WEEKDAY_OPTIONS.map(o => ({ value: o.value, label: o.label }))}
                          />
                        </div>
                      )}
                      {backupCustom.frequency === 'monthly' && (
                        <div className="dz-backup-row">
                          <span className="dz-backup-row-label">Vào ngày</span>
                          <InputNumber
                            className="dz-backup-row-control"
                            min={1}
                            max={28}
                            value={backupCustom.dayOfMonth}
                            onChange={v => setBackupCustom(prev => ({ ...prev, dayOfMonth: v ?? 1 }))}
                          />
                        </div>
                      )}
                      <div className="dz-backup-row">
                        <span className="dz-backup-row-label">Vào lúc</span>
                        <TimePicker
                          className="dz-backup-row-control"
                          format="HH:mm"
                          allowClear={false}
                          needConfirm={false}
                          value={dayjs().hour(backupCustom.hour).minute(backupCustom.minute)}
                          onChange={d =>
                            d && setBackupCustom(prev => ({ ...prev, hour: d.hour(), minute: d.minute() }))
                          }
                        />
                      </div>
                    </div>
                  )}
                  {showBackupSaveBtn && (
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
                            setBackupCustom(parseBackupCron(saved));
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
                        Lưu lịch sao lưu
                      </Button>
                    </Space>
                  )}
                </Space>
              </div>

              <div className="dz-divider" />

              <div>
                <div className="dz-schedule-label">Giữ bản sao lưu (ngày)</div>
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
                loading={backupTriggerLoading}
                onClick={handleTriggerBackup}
                block
                className="dz-trigger-btn"
              >
                {backupTriggerLoading ? 'Đang sao lưu...' : 'Sao lưu ngay'}
              </Button>

              {backupStatus?.lastRun && (
                <div style={{ marginTop: 12 }}>
                  <Alert
                    type="info"
                    message={`Lần sao lưu gần nhất: ${formatDateTime(backupStatus.lastRun)}`}
                    showIcon={false}
                  />
                </div>
              )}

              {backupStatus?.recentBackups && backupStatus.recentBackups.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <div className="dz-feature-label" style={{ marginBottom: 8 }}>
                    File sao lưu hiện có ({backupStatus.totalFiles})
                  </div>
                  <Space direction="vertical" size={8} style={{ width: '100%' }}>
                    {backupStatus.recentBackups.map(file => (
                      <div key={file.filename} className="dz-util-row">
                        <div className="dz-util-info">
                          <div>
                            <div className="dz-feature-label">{file.filename}</div>
                            <div className="dz-feature-desc">
                              {formatDateTime(file.createdAt)} · {file.sizeKB} KB ·{' '}
                              {file.type === 'manual' ? 'Thủ công' : 'Tự động'}
                            </div>
                          </div>
                        </div>
                        <Popconfirm
                          title="Xoá file sao lưu này?"
                          okText="Xoá"
                          cancelText="Huỷ"
                          onConfirm={() => handleDeleteBackupFile(file.filename)}
                        >
                          <Button className="dz-delete-btn" danger>
                            Xoá
                          </Button>
                        </Popconfirm>
                      </div>
                    ))}
                  </Space>
                </div>
              )}
            </div>

            {/* Utilities */}
            <div className="dz-card">
              <div className="dz-card-title">
                <ToolOutlined />
                <span>Tiện ích</span>
              </div>
              <div className="dz-util-row">
                <div className="dz-util-info">
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
