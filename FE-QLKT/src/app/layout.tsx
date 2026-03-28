import './globals.css';
import { ThemeProvider } from '@/components/ThemeProvider';
import AntdRegistry from '@/lib/AntdRegistry';
import { Toaster } from '@/components/ui/toaster';
import { AuthProvider } from '@/contexts/AuthContext';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Quản lý Khen thưởng',
  description: 'Hệ thống quản lý khen thưởng',
  icons: {
    icon: '/logo-msa.png',
    apple: '/logo-msa.png',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <AntdRegistry>
          <AuthProvider>
            <ThemeProvider>
              {children}
              <Toaster />
            </ThemeProvider>
          </AuthProvider>
        </AntdRegistry>
      </body>
    </html>
  );
}
