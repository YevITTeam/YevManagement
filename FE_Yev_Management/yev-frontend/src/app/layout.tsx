import type { Metadata } from "next";
import { Inter } from "next/font/google"; // Dùng font Inter cho đẹp
import "./globals.css";

import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import Header from "@/modules/common/components/Header";
import { AuthProvider } from "@/modules/auth/context/AuthContext";

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

        <AuthProvider>
          <Header />

          <main className="flex-grow">
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

      </body>
    </html>
  );
}