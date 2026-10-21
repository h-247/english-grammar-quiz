import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/components/Toast";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const viewport: Viewport = {
  colorScheme: "dark",
  themeColor: "#212121",
};

export const metadata: Metadata = {
  title: "English Grammar Timed Quiz",
  description: "Full-stack interactive timed quiz application for English grammar",
  other: {
    "darkreader-lock": "",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} h-full dark`} suppressHydrationWarning>
      <head>
        <meta name="darkreader-lock" content="" />
        <meta name="color-scheme" content="dark" />
      </head>
      <body
        className="min-h-full flex flex-col bg-[#212121] text-[#ECECEC] antialiased"
        suppressHydrationWarning
      >
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
