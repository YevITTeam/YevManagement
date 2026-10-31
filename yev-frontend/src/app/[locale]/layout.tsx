import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { hasLocale } from "next-intl";
import { NextIntlClientProvider } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import "./globals.css";

import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import Header from "@/modules/common/components/Header";
import { AuthProvider } from "@/modules/auth/context/AuthContext";
import AuthGuard from "@/modules/auth/components/AuthGuard";
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
      {/* The app's only height frame and scroll container: body is h-screen + overflow-hidden, <main> scrolls (min-h-0).
          Child layouts must not declare h-screen or their own overflow-y-auto, only min-h-full (DESIGN_SYSTEM.md §3). */}
      <body className={`${inter.className} bg-gray-50 flex h-screen flex-col overflow-hidden print:h-auto print:overflow-visible`}>
        <NextIntlClientProvider>
          <AuthProvider>
            <Header />

            <main className="min-h-0 flex-1 overflow-y-auto print:overflow-visible">
              <AuthGuard>{children}</AuthGuard>
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