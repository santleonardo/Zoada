import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#F7F7FB",
};

export const metadata: Metadata = {
  title: "Zôada — Música. Sem Rótulos.",
  description:
    "Zôada é um app social de streaming de música. Descubra, compartilhe e conecte-se através da música.",
  keywords: [
    "Zôada",
    "música",
    "streaming",
    "social",
    "playlist",
    "chat",
    "curtidas",
  ],
  authors: [{ name: "Zôada Team" }],
  icons: {
    icon: "/zoada-logo.png",
    apple: "/zoada-logo.png",
  },
  manifest: "/manifest.json",
  openGraph: {
    title: "Zôada — Música. Sem Rótulos.",
    description: "Descubra, compartilhe e conecte-se através da música.",
    type: "website",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Zôada",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <link rel="apple-touch-icon" href="/zoada-logo.png" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        style={{
          backgroundColor: '#F7F7FB',
          color: '#1A1B25',
          minHeight: '100vh',
          minHeight: '100dvh',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
