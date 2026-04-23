import './globals.css';
import { ThemeProvider } from '@/components/ThemeProvider';
import { Toaster } from '@/components/ui/toaster';
import { AuthProvider } from '@/contexts/AuthContext';
import { Roboto } from 'next/font/google';
import type { Metadata } from 'next';

const roboto = Roboto({
  subsets: ['vietnamese', 'latin'],
  weight: ['300', '400', '500', '700', '900'],
  variable: '--font-roboto',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Quản lý khen thưởng',
  description: 'Hệ thống quản lý khen thưởng',
  icons: {
    icon: '/logo-msa.png',
    apple: '/logo-msa.png',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <body className={`${roboto.variable} font-sans antialiased`}>
        <AuthProvider>
          <ThemeProvider>
            {children}
            <Toaster />
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
