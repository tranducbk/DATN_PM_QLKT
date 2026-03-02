/**
 * Ví dụ sử dụng component Loading
 *
 * Component Loading cung cấp 3 biến thể:
 * 1. Loading - Component chính với Lucide icon
 * 2. LoadingSpin - Component sử dụng Ant Design Spin
 * 3. LoadingInline - Component nhỏ cho inline loading
 */

import { Loading, LoadingSpin, LoadingInline } from '@/components/ui/loading';
import { useState, useEffect } from 'react';

// Ví dụ 1: Full screen loading khi tải page
export function PageLoadingExample() {
  const [loading, setLoading] = useState(true);

  if (loading) {
    return <Loading fullScreen message="Đang tải thông tin cá nhân..." size="large" />;
  }

  return <div>Nội dung page...</div>;
}

// Ví dụ 2: Inline loading trong card
export function CardLoadingExample() {
  const [loading, setLoading] = useState(true);

  return (
    <div className="card">
      {loading ? (
        <Loading message="Đang tải dữ liệu..." size="default" />
      ) : (
        <div>Nội dung card...</div>
      )}
    </div>
  );
}

// Ví dụ 3: Sử dụng LoadingSpin (Ant Design)
export function SpinLoadingExample() {
  const [loading, setLoading] = useState(true);

  if (loading) {
    return <LoadingSpin fullScreen message="Đang tải thông tin hệ thống..." size="large" />;
  }

  return <div>Nội dung...</div>;
}

// Ví dụ 4: Loading inline nhỏ (ví dụ trong button hoặc text)
export function InlineLoadingExample() {
  const [saving, setSaving] = useState(false);

  return (
    <div>
      <button onClick={() => setSaving(true)}>
        {saving ? <LoadingInline message="Đang lưu..." size="small" /> : 'Lưu'}
      </button>
    </div>
  );
}

// Ví dụ 5: Sử dụng với message động
export function DynamicMessageExample() {
  const [loading, setLoading] = useState(true);
  const [currentStep, setCurrentStep] = useState('Đang tải thông tin cá nhân...');

  // Giả lập các bước loading
  useEffect(() => {
    const steps = [
      'Đang tải thông tin cá nhân...',
      'Đang tải lịch sử công tác...',
      'Đang tải thành tích...',
      'Hoàn tất!',
    ];

    let index = 0;
    const interval = setInterval(() => {
      if (index < steps.length - 1) {
        setCurrentStep(steps[index]);
        index++;
      } else {
        setLoading(false);
        clearInterval(interval);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return <Loading fullScreen message={currentStep} size="large" />;
  }

  return <div>Nội dung...</div>;
}

// Các props của Loading:
// - message?: string - Thông báo hiển thị (mặc định: "Đang tải...")
// - fullScreen?: boolean - Hiển thị full screen với backdrop (mặc định: false)
// - size?: 'small' | 'default' | 'large' - Kích thước spinner (mặc định: 'large')
// - className?: string - Class CSS tùy chỉnh
