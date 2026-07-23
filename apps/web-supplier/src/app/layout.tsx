import type { Metadata } from 'next';
import { Noto_Sans_Arabic } from 'next/font/google';
import './globals.css';

const notoSansArabic = Noto_Sans_Arabic({
  variable: '--font-arabic',
  subsets: ['arabic'],
});

export const metadata: Metadata = {
  title: 'إيبيكس سورس — بوابة المورد',
  description: 'بوابة المورد لمنصة إيبيكس سورس',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar" dir="rtl" className={`${notoSansArabic.variable} h-full`}>
      <body className="min-h-full bg-slate-50 font-sans text-slate-900 antialiased">{children}</body>
    </html>
  );
}
