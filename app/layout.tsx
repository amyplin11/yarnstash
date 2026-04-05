import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Navbar } from "./components/navigation/Navbar";
import { AuthProvider } from "@/lib/auth/AuthContext";
import { UploadProvider } from "@/lib/upload/UploadContext";
import { UploadStatusBar } from "./components/ui/UploadStatusBar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "YarnStash - Knitting Project Manager",
  description: "Manage your knitting projects and yarn stash",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <AuthProvider>
          <UploadProvider>
            <Navbar />
            {children}
            <UploadStatusBar />
          </UploadProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
