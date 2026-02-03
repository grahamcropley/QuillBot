import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Providers } from "./providers";
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
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-gray-50 h-screen overflow-hidden`}
      >
        <div className="flex flex-col h-full">
          <header className="flex-shrink-0 bg-white border-b border-gray-200">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex items-center justify-between h-16">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">✍️</span>
                  <span className="text-xl font-bold text-gray-900">
                    QuillBot
                  </span>
                </div>
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
