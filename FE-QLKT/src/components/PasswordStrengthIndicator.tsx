'use client';

import { Progress, Typography, Space } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';

const { Text } = Typography;

interface PasswordStrengthIndicatorProps {
  password: string;
}

export function PasswordStrengthIndicator({ password }: PasswordStrengthIndicatorProps) {
  const getPasswordStrength = (pwd: string) => {
    if (!pwd) return { strength: 0, label: '', color: '#ff4d4f', checks: [] };

    let strength = 0;
    const checks = [];

    // Kiểm tra độ dài
    if (pwd.length >= 6) {
      strength += 1;
      checks.push({ label: 'Ít nhất 6 ký tự', met: true });
    } else {
      checks.push({ label: 'Ít nhất 6 ký tự', met: false });
    }

    if (pwd.length >= 8) {
      strength += 1;
      checks.push({ label: 'Ít nhất 8 ký tự (khuyến nghị)', met: true });
    } else {
      checks.push({ label: 'Ít nhất 8 ký tự (khuyến nghị)', met: false });
    }

    // Kiểm tra chữ hoa
    if (/[A-Z]/.test(pwd)) {
      strength += 1;
      checks.push({ label: 'Có chữ hoa', met: true });
    } else {
      checks.push({ label: 'Có chữ hoa', met: false });
    }

    // Kiểm tra chữ thường
    if (/[a-z]/.test(pwd)) {
      strength += 1;
      checks.push({ label: 'Có chữ thường', met: true });
    } else {
      checks.push({ label: 'Có chữ thường', met: false });
    }

    // Kiểm tra số
    if (/[0-9]/.test(pwd)) {
      strength += 1;
      checks.push({ label: 'Có số', met: true });
    } else {
      checks.push({ label: 'Có số', met: false });
    }

    // Kiểm tra ký tự đặc biệt
    if (/[^A-Za-z0-9]/.test(pwd)) {
      strength += 1;
      checks.push({ label: 'Có ký tự đặc biệt', met: true });
    } else {
      checks.push({ label: 'Có ký tự đặc biệt', met: false });
    }

    // Tính phần trăm và màu sắc
    const percentage = (strength / 6) * 100;
    let color = '#ff4d4f'; // Đỏ
    let label = 'Rất yếu';

    if (percentage >= 83) {
      color = '#52c41a'; // Xanh lá
      label = 'Rất mạnh';
    } else if (percentage >= 67) {
      color = '#73d13d'; // Xanh lá nhạt
      label = 'Mạnh';
    } else if (percentage >= 50) {
      color = '#faad14'; // Vàng
      label = 'Trung bình';
    } else if (percentage >= 33) {
      color = '#ffa940'; // Cam
      label = 'Yếu';
    }

    return { strength: percentage, label, color, checks };
  };

  const { strength, label, color, checks } = getPasswordStrength(password);

  if (!password) return null;

  return (
    <div className="mt-2 space-y-3">
      <div>
        <div className="flex items-center justify-between mb-2">
          <Text strong className="text-sm">
            Độ mạnh mật khẩu:
          </Text>
          <Text strong style={{ color }} className="text-sm">
            {label}
          </Text>
        </div>
        <Progress
          percent={strength}
          strokeColor={color}
          showInfo={false}
          className="mb-2"
        />
      </div>

      <div className="space-y-2">
        {checks.map((check, index) => (
          <div key={index} className="flex items-center gap-2">
            {check.met ? (
              <CheckCircleOutlined style={{ color: '#52c41a', fontSize: '14px' }} />
            ) : (
              <CloseCircleOutlined style={{ color: '#d9d9d9', fontSize: '14px' }} />
            )}
            <Text
              type={check.met ? 'secondary' : 'secondary'}
              style={{
                fontSize: '12px',
                color: check.met ? '#52c41a' : '#8c8c8c',
                textDecoration: check.met ? 'none' : 'none',
              }}
            >
              {check.label}
            </Text>
          </div>
        ))}
      </div>
    </div>
  );
}

