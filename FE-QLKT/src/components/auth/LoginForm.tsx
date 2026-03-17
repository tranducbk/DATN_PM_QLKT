'use client';

import { useState } from 'react';
import { Form, Input, Button, Alert } from 'antd';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/contexts/AuthContext';
import Image from 'next/image';
import './login-form.css';

export function LoginForm() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  const { login } = useAuth();

  const handleLogin = async (values: { username: string; password: string }) => {
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
        });

        if (role === 'SUPER_ADMIN') {
          router.push('/super-admin/dashboard');
        } else if (role === 'ADMIN') {
          router.push('/admin/dashboard');
        } else if (role === 'MANAGER') {
          router.push('/manager/dashboard');
        } else if (role === 'USER') {
          router.push('/user/dashboard');
        }
      } else {
        const errorMessage =
          response.message || 'Đăng nhập thất bại. Vui lòng kiểm tra lại tài khoản và mật khẩu.';
        setError(errorMessage);
        setLoading(false);
        return;
      }
    } catch (err: any) {
      const errorMessage =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
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
        <div className="bg-grid"></div>
      </div>

      {/* Header */}
      <header className="login-header">
        <nav className="login-nav">
          <Link href="/" className="logo-link">
            <div className="logo-glow"></div>
            <Image
              src="/logo-msa.png"
              alt="Logo"
              width={48}
              height={48}
              className="logo-img"
              priority
            />
            <div className="logo-text">
              <span className="logo-title">HỌC VIỆN KHOA HỌC QUÂN SỰ</span>
            </div>
          </Link>

          <div className="nav-links">
            <Link href="/#features" className="nav-link">
              Tính năng
            </Link>
            <Link href="/#stats" className="nav-link">
              Thống kê
            </Link>
            <Link href="/#contact" className="nav-link">
              Liên hệ
            </Link>
            <Link href="/" className="nav-btn">
              Trang chủ
            </Link>
          </div>
        </nav>
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
            <p className="card-subtitle">Hệ thống Quản lý Khen thưởng</p>
          </div>

          {/* Error Alert */}
          {error && (
            <Alert
              message={error}
              type="error"
              showIcon
              className="login-alert"
              closable
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

            <Form.Item className="mb-0">
              <Button
                type="primary"
                htmlType="submit"
                block
                size="large"
                loading={loading}
                className="login-button"
              >
                {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
              </Button>
            </Form.Item>
          </Form>

          {/* Footer */}
          <div className="card-footer">
            <p className="footer-text">© 2025 Học viện Khoa học Quân sự</p>
          </div>
        </div>
      </div>
    </div>
  );
}
