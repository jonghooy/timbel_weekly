import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Timbel Weekly",
  description: "직원들의 주간 업무 계획 및 실행 결과를 관리하는 웹 애플리케이션",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className={inter.className}>
        <div className="relative flex min-h-screen flex-col">
          <main className="flex-1 bg-background">{children}</main>
        </div>
        <Toaster />
      </body>
    </html>
  );
} 