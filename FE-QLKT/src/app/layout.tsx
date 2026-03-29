import './globals.css';
import { ThemeProvider } from '@/components/ThemeProvider';
import AntdRegistry from '@/lib/AntdRegistry';
import { Toaster } from '@/components/ui/toaster';
import { AuthProvider } from '@/contexts/AuthContext';
import { Be_Vietnam_Pro, Inter } from 'next/font/google';
import type { Metadata } from 'next';

const beVietnamPro = Be_Vietnam_Pro({
  subsets: ['vietnamese', 'latin'],
  weight: ['300', '400', '500', '600', '700', '800'],
  variable: '--font-be-vietnam',
  display: 'swap',
});

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

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
      <body className={`${beVietnamPro.variable} ${inter.variable} font-sans antialiased`}>
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
