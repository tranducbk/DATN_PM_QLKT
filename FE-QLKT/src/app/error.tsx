'use client';

import { useEffect } from 'react';
import { Button, Result } from 'antd';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Application error:', error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <Result
        status="500"
        title="Đã xảy ra lỗi"
        subTitle="Hệ thống gặp sự cố. Vui lòng thử lại."
        extra={
          <Button type="primary" onClick={reset}>
            Thử lại
          </Button>
        }
      />
    </div>
  );
}
