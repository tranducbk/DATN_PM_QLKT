'use client';

import React from 'react';
import { Button, Result } from 'antd';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * ErrorBoundary - Error Boundary Pattern
 *
 * Bắt lỗi trong component tree và hiển thị fallback UI thay vì crash toàn bộ app.
 * Sử dụng: wrap quanh page content trong layout files.
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div style={{ padding: '48px', display: 'flex', justifyContent: 'center' }}>
          <Result
            status="error"
            title="Đã xảy ra lỗi"
            subTitle={
              process.env.NODE_ENV === 'development'
                ? this.state.error?.message
                : 'Vui lòng thử lại hoặc liên hệ quản trị viên.'
            }
            extra={[
              <Button type="primary" key="retry" onClick={this.handleReset}>
                Thử lại
              </Button>,
              <Button key="home" onClick={() => (window.location.href = '/')}>
                Về trang chủ
              </Button>,
            ]}
          />
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
