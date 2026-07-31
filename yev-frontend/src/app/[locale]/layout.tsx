import type { Metadata } from "next";
import { Inter } from "next/font/google"; // Dùng font Inter cho đẹp
import { hasLocale } from "next-intl";
import { NextIntlClientProvider } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import "./globals.css";

import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import Header from "@/modules/common/components/Header";
import { AuthProvider } from "@/modules/auth/context/AuthContext";
import { routing } from "@/i18n/routing";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "YEV Management",
  description: "Hệ thống quản lý nội bộ",
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function RootLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  setRequestLocale(locale);

  return (
    <html lang={locale}>
      {/* Khung chiều cao của TOÀN App nằm ở đây và CHỈ ở đây: body cao đúng 1 màn hình, Header chiếm
          phần của nó, <main> ăn hết phần còn lại và là vùng cuộn DUY NHẤT của app.
          - `h-screen` + `overflow-hidden` ở body: chặn document tự cuộn. Trước đây body dùng
            `min-h-screen` (không chặn) trong khi layout con lại khai `100vh`, làm tổng chiều cao trang
            thành 100vh + chiều cao Header → document sinh thêm 1 thanh cuộn nữa, chồng lên thanh cuộn
            của layout con → 2 thanh cuộn lệch nhau, nội dung bị cắt/che (lỗi thật người dùng gặp).
          - `min-h-0` ở <main>: flex item mặc định `min-height:auto` nên không chịu co theo cha.
          Layout con (pc-manager/ot-manager) TUYỆT ĐỐI không được tự khai `h-screen`/`max-h-screen` hay
          tự mở thêm `overflow-y-auto` nữa — chỉ dùng `min-h-full`. Xem DESIGN_SYSTEM.md §3. */}
      <body className={`${inter.className} bg-gray-50 flex h-screen flex-col overflow-hidden print:h-auto print:overflow-visible`}>
        <NextIntlClientProvider>
          <AuthProvider>
            <Header />

            <main className="min-h-0 flex-1 overflow-y-auto print:overflow-visible">
              {children}
            </main>
          </AuthProvider>

          <ToastContainer
            position="top-right"
            autoClose={3000}
            hideProgressBar={false}
            newestOnTop={true}
            closeOnClick
            pauseOnHover
            theme="light"
          />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}