import type { Metadata } from "next";
import Image from "next/image";
import { Geist, Geist_Mono } from "next/font/google";
import { Providers } from "./providers";
import { UserMenu } from "@/components/auth/user-menu";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "QuillBot - Content Authoring Platform",
  description:
    "AI-powered content authoring platform for marketing and copywriting",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground h-screen overflow-hidden`}
      >
        <div className="flex flex-col h-full">
          <header className="flex-shrink-0 bg-gradient-to-r from-blue-600 via-blue-500 to-purple-600 dark:from-blue-900 dark:via-blue-800 dark:to-purple-900 border-b border-white/10 shadow-sm">
            <div className="px-4 sm:px-6 lg:px-8">
              <div className="flex items-center justify-between h-14">
                <div className="flex items-center gap-3">
                  <Image
                    src="/quillbot-logo.png"
                    alt="QuillBot logo"
                    width={44}
                    height={44}
                    priority
                    className="h-11 w-11 rounded-sm"
                  />
                  <span className="text-xl font-bold text-white">QuillBot</span>
                </div>
                <UserMenu />
              </div>
            </div>
          </header>
          <main className="flex-1 w-full overflow-y-auto">
            <Providers>{children}</Providers>
          </main>
        </div>
      </body>
    </html>
  );
}
