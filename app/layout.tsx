import type { Metadata } from "next";
import { Figtree, Playfair_Display } from "next/font/google";
import "./globals.css";
import { AppShell } from "./components/navigation/AppShell";
import { AuthProvider } from "@/lib/auth/AuthContext";
import { UploadProvider } from "@/lib/upload/UploadContext";
import { UploadStatusBar } from "./components/ui/UploadStatusBar";
import { FeedbackButton } from "./components/feedback/FeedbackButton";

const figtree = Figtree({
  variable: "--font-figtree",
  subsets: ["latin"],
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  style: ["normal", "italic"],
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
        className={`${figtree.variable} ${playfair.variable} bg-parchment text-ink antialiased`}
      >
        <AuthProvider>
          <UploadProvider>
            <AppShell>{children}</AppShell>
            <UploadStatusBar />
            <FeedbackButton />
          </UploadProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
