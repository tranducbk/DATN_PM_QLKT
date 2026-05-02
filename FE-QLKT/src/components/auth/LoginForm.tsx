'use client';

import { useEffect, useState } from 'react';
import { Form, Input, Button, Alert } from 'antd';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiClient } from '@/lib/apiClient';
import { getApiErrorMessage, getRetryAfterSeconds } from '@/lib/apiError';
import { useAuth } from '@/contexts/AuthContext';
import { ROLES } from '@/constants/roles.constants';
import Image from 'next/image';
import './LoginForm.css';

function formatCooldown(seconds: number): string {
  if (seconds < 60) return `${seconds} giây`;
  const minutes = Math.floor(seconds / 60);
  const remainSeconds = seconds % 60;
  return remainSeconds > 0 ? `${minutes} phút ${remainSeconds} giây` : `${minutes} phút`;
}

export function LoginForm() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const router = useRouter();
  const { login } = useAuth();

  useEffect(() => {
    if (!cooldownUntil) return;
    const tick = () => setNow(Date.now());
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [cooldownUntil]);

  const cooldownSeconds = cooldownUntil
    ? Math.max(0, Math.ceil((cooldownUntil - now) / 1000))
    : 0;
  const isCoolingDown = cooldownSeconds > 0;

  useEffect(() => {
    if (cooldownUntil && cooldownSeconds === 0) {
      setCooldownUntil(null);
      setError('');
    }
  }, [cooldownUntil, cooldownSeconds]);

  const handleLogin = async (values: { username: string; password: string }) => {
    if (loading || isCoolingDown) return;
    setLoading(true);
    setError('');

    try {
      const response = await apiClient.login(values.username, values.password);

      if (response.success && response.data) {
        const payload = response.data;
        const accessToken = payload.accessToken || payload.token;
        const refreshToken = payload.refreshToken;
        const user = payload.user || {};
        const role = user.role;

        login(accessToken || '', refreshToken || '', {
          id: user.id || '',
          username: user.username || user.ten_dang_nhap || '',
          role: user.role,
          quan_nhan_id: user.quan_nhan_id || undefined,
          ho_ten: user.ho_ten || undefined,
          don_vi_id: user.don_vi_id || undefined,
        });

        if (role === ROLES.SUPER_ADMIN) {
          router.push('/super-admin/dashboard');
        } else if (role === ROLES.ADMIN) {
          router.push('/admin/dashboard');
        } else if (role === ROLES.MANAGER) {
          router.push('/manager/dashboard');
        } else if (role === ROLES.USER) {
          router.push('/user/dashboard');
        }
      } else {
        const errorMessage =
          response.message || 'Đăng nhập thất bại. Vui lòng kiểm tra lại tài khoản và mật khẩu.';
        setError(errorMessage);
        setLoading(false);
        return;
      }
    } catch (err: unknown) {
      const retrySeconds = getRetryAfterSeconds(err);
      if (retrySeconds && retrySeconds > 0) {
        setCooldownUntil(Date.now() + retrySeconds * 1000);
      }
      const errorMessage =
        getApiErrorMessage(err) ||
        'Đăng nhập thất bại. Vui lòng kiểm tra lại tài khoản và mật khẩu.';
      setError(errorMessage);
      setLoading(false);
      return;
    }
  };

  return (
    <div className="login-page">
      {/* Animated Background Elements */}
      <div className="login-bg">
        <div className="bg-gradient"></div>
        <div className="bg-orb bg-orb-1"></div>
        <div className="bg-orb bg-orb-2"></div>
        <div className="bg-orb bg-orb-3"></div>
      </div>

      {/* Header */}
      <header className="login-header-bar">
        <div className="login-header-inner">
          <Link href="/" className="login-header-logo">
            <Image
              src="/logo-msa.png"
              alt="Logo Học viện Khoa học Quân sự"
              width={44}
              height={44}
              className="rounded-xl"
              priority
            />
            <div className="login-header-logo-text">
              <span className="login-header-title">HỌC VIỆN KHOA HỌC QUÂN SỰ</span>
              <span className="login-header-sub">Bộ Quốc phòng</span>
            </div>
          </Link>
          <Link href="/" className="login-header-btn">
            Trang chủ
          </Link>
        </div>
      </header>

      {/* Login Card */}
      <div className="login-container">
        <div className="login-card">
          {/* Card Header */}
          <div className="card-header">
            <div className="card-logo">
              <Image
                src="/logo-msa.png"
                alt="Logo"
                width={64}
                height={64}
                className="card-logo-img"
                priority
              />
            </div>
            <h1 className="card-title">Đăng nhập</h1>
            <p className="card-subtitle">Hệ thống quản lý khen thưởng</p>
          </div>

          {/* Error Alert */}
          {(error || isCoolingDown) && (
            <Alert
              message={
                isCoolingDown
                  ? `Quá nhiều yêu cầu. Vui lòng thử lại sau ${formatCooldown(cooldownSeconds)}.`
                  : error
              }
              type="error"
              showIcon
              className="login-alert"
              closable={!isCoolingDown}
              onClose={() => setError('')}
            />
          )}

          {/* Form */}
          <Form
            form={form}
            layout="vertical"
            onFinish={handleLogin}
            onFinishFailed={() => {
              setError('Vui lòng nhập đầy đủ thông tin đăng nhập.');
            }}
            autoComplete="off"
            className="login-form"
            onKeyDown={e => {
              if (e.key === 'Enter' && loading) {
                e.preventDefault();
              }
            }}
          >
            <Form.Item
              name="username"
              label={<span className="form-label">Tài khoản</span>}
              rules={[{ required: true, message: 'Vui lòng nhập tài khoản' }]}
            >
              <Input
                prefix={
                  <svg
                    className="input-icon"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                }
                placeholder="Nhập tài khoản"
                size="large"
                className="login-input"
              />
            </Form.Item>

            <Form.Item
              name="password"
              label={<span className="form-label">Mật khẩu</span>}
              rules={[{ required: true, message: 'Vui lòng nhập mật khẩu' }]}
            >
              <Input.Password
                prefix={
                  <svg
                    className="input-icon"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                }
                placeholder="Nhập mật khẩu"
                size="large"
                className="login-input"
              />
            </Form.Item>

            <div className="forgot-link-wrap">
              <Link href="/forgot-password" className="forgot-password-link">
                Quên mật khẩu?
              </Link>
            </div>

            <Form.Item className="mb-0">
              <Button
                type="primary"
                htmlType="submit"
                block
                size="large"
                loading={loading}
                disabled={loading || isCoolingDown}
                className="login-button"
              >
                {loading
                  ? 'Đang đăng nhập...'
                  : isCoolingDown
                    ? `Thử lại sau ${formatCooldown(cooldownSeconds)}`
                    : 'Đăng nhập'}
              </Button>
            </Form.Item>
          </Form>

          {/* Footer */}
          <div className="card-footer">
            <p className="footer-text">© 2026 Học viện Khoa học Quân sự</p>
          </div>
        </div>
      </div>
    </div>
  );
}
