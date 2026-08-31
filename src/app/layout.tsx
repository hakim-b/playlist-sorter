import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { env } from "~/env";
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
  metadataBase: new URL(env.BETTER_AUTH_URL),
  title: {
    default: "Spotify Release Date sorter",
    template: "%s | Spotify Release Date sorter",
  },
  description:
    "Sort playlist by release date. Built using Next.js, Better Auth, and Hero UI",
  openGraph: {
    type: "website",
    siteName: "Spotify Release Date sorter",
  },
  twitter: {
    card: "summary_large_image",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
