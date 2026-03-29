'use client';

import Link from 'next/link';
import Image from 'next/image';
import { PhoneOutlined, MailOutlined, EnvironmentOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import './forgot-password.css';

export default function ForgotPasswordPage() {
  return (
    <div className="forgot-page">
      {/* Background */}
      <div className="forgot-bg">
        <div className="forgot-bg-gradient"></div>
        <div className="forgot-orb forgot-orb-1"></div>
        <div className="forgot-orb forgot-orb-2"></div>
      </div>

      {/* Header */}
      <header className="forgot-header">
        <div className="forgot-header-inner">
          <Link href="/" className="forgot-header-logo">
            <Image
              src="/logo-msa.png"
              alt="Logo Học viện Khoa học Quân sự"
              width={44}
              height={44}
              className="rounded-xl"
              priority
            />
            <div className="forgot-header-logo-text">
              <span className="forgot-header-title">HỌC VIỆN KHOA HỌC QUÂN SỰ</span>
              <span className="forgot-header-sub">Bộ Quốc phòng</span>
            </div>
          </Link>
          <Link href="/login" className="forgot-header-btn">
            Đăng nhập
          </Link>
        </div>
      </header>

      {/* Content */}
      <div className="forgot-container">
        <div className="forgot-card">
          <Link href="/login" className="forgot-back">
            <ArrowLeftOutlined /> Quay lại đăng nhập
          </Link>

          {/* Header */}
          <div className="forgot-card-header">
            <h1 className="forgot-title">Quên mật khẩu?</h1>
            <p className="forgot-desc">
              Vì lý do bảo mật, vui lòng liên hệ đơn vị quản lý để được cấp lại mật khẩu.
            </p>
          </div>

          {/* Steps - inline compact */}
          <div className="forgot-steps">
            <div className="forgot-step">
              <div className="forgot-step-num">1</div>
              <span className="forgot-step-label">Liên hệ Phòng CT hoặc CNTT</span>
            </div>
            <div className="forgot-step-divider"></div>
            <div className="forgot-step">
              <div className="forgot-step-num">2</div>
              <span className="forgot-step-label">Xác minh danh tính</span>
            </div>
            <div className="forgot-step-divider"></div>
            <div className="forgot-step">
              <div className="forgot-step-num">3</div>
              <span className="forgot-step-label">Nhận mật khẩu mới</span>
            </div>
          </div>

          {/* Contact - 2 columns */}
          <div className="forgot-contacts">
            <div className="forgot-contact-card">
              <h3 className="forgot-contact-name">Phòng Chính trị</h3>
              <a href="tel:02412345678" className="forgot-contact-item">
                <PhoneOutlined /> (024) 1234 5678
              </a>
              <a href="mailto:chinhtri@hvkhqs.edu.vn" className="forgot-contact-item">
                <MailOutlined /> chinhtri@hvkhqs.edu.vn
              </a>
            </div>
            <div className="forgot-contact-card">
              <h3 className="forgot-contact-name">Phòng CNTT</h3>
              <a href="tel:02487654321" className="forgot-contact-item">
                <PhoneOutlined /> (024) 8765 4321
              </a>
              <a href="mailto:cntt@hvkhqs.edu.vn" className="forgot-contact-item">
                <MailOutlined /> cntt@hvkhqs.edu.vn
              </a>
            </div>
          </div>

          {/* Footer */}
          <div className="forgot-footer">
            <span className="forgot-address"><EnvironmentOutlined /> 322E Lê Trọng Tấn, Thanh Xuân, Hà Nội</span>
            <p>© 2026 Học viện Khoa học Quân sự</p>
          </div>
        </div>
      </div>
    </div>
  );
}
