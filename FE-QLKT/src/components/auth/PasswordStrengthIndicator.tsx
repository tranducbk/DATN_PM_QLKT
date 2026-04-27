'use client';

import { Progress, Typography } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';

const { Text } = Typography;

interface PasswordStrengthIndicatorProps {
  password: string;
}

const CHECKS = [
  { test: (p: string) => p.length >= 8, label: 'Ít nhất 8 ký tự (bắt buộc)' },
  { test: (p: string) => /[A-Z]/.test(p), label: 'Có chữ hoa' },
  { test: (p: string) => /[a-z]/.test(p), label: 'Có chữ thường' },
  { test: (p: string) => /[0-9]/.test(p), label: 'Có số' },
  { test: (p: string) => /[^A-Za-z0-9]/.test(p), label: 'Có ký tự đặc biệt' },
];

const STRENGTH_LEVELS = [
  { min: 80, color: '#52c41a', label: 'Rất mạnh' },
  { min: 60, color: '#73d13d', label: 'Mạnh' },
  { min: 40, color: '#faad14', label: 'Trung bình' },
  { min: 20, color: '#ffa940', label: 'Yếu' },
  { min: 0, color: '#ff4d4f', label: 'Rất yếu' },
];

export function PasswordStrengthIndicator({ password }: PasswordStrengthIndicatorProps) {
  if (!password) return null;

  const results = CHECKS.map(c => ({ label: c.label, met: c.test(password) }));
  const percentage = (results.filter(r => r.met).length / CHECKS.length) * 100;
  const level = STRENGTH_LEVELS.find(l => percentage >= l.min) || STRENGTH_LEVELS.at(-1)!;

  return (
    <div className="mt-2 space-y-3">
      <div>
        <div className="flex items-center justify-between mb-2">
          <Text strong className="text-sm">
            Độ mạnh mật khẩu:
          </Text>
          <Text strong style={{ color: level.color }} className="text-sm">
            {level.label}
          </Text>
        </div>
        <Progress
          percent={percentage}
          strokeColor={level.color}
          showInfo={false}
          className="mb-2"
        />
      </div>

      <div className="space-y-2">
        {results.map(check => (
          <div key={check.label} className="flex items-center gap-2">
            {check.met ? (
              <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 14 }} />
            ) : (
              <CloseCircleOutlined style={{ color: '#d9d9d9', fontSize: 14 }} />
            )}
            <Text style={{ fontSize: 12, color: check.met ? '#52c41a' : '#8c8c8c' }}>
              {check.label}
            </Text>
          </div>
        ))}
      </div>
    </div>
  );
}
