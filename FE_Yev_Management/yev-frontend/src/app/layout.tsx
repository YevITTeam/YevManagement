import type { Metadata } from "next";
import { Inter } from "next/font/google"; // Dùng font Inter cho đẹp
import "./globals.css";

import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import Header from "@/modules/common/components/Header";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "YEV Management",
  description: "Hệ thống quản lý nội bộ",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <body className={`${inter.className} bg-gray-50 min-h-screen flex flex-col`}>

        <Header />

        <main className="flex-grow">
          {children}
        </main>

        <ToastContainer
          position="top-right"
          autoClose={3000}
          hideProgressBar={false}
          newestOnTop={true}
          closeOnClick
          pauseOnHover
          theme="light"
        />

      </body>
    </html>
  );
}