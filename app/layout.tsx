import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import ClientPopupWrapper from "./components/ClientPopupWrapper";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const siteUrl = "https://tv.shajon.dev";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#070414" },
    { media: "(prefers-color-scheme: light)", color: "#070414" },
  ],
};

export const metadata: Metadata = {
  title: "LoopinLive - Watch 6500+ Live TV Channels Free",
  description:
    "Stream 6500+ live TV channels from Bangladesh, India, and worldwide. Premium LoopinLive web player with HLS streaming, custom playlist support, and a modern UI. No app install needed.",
  keywords: [
    "LoopinLive",
    "live TV",
    "streaming",
    "HLS player",
    "TV channels",
    "Bangladesh TV",
    "sports live",
    "T Sports",
    "free TV",
    "online TV",
    "IPTV player",
    "m3u player",
    "web TV player",
  ],
  authors: [{ name: "Mitab Sany", url: "https://github.com/thewiztanvir" }],
  creator: "Mitab Sany",
  publisher: "Mitab Sany",
  metadataBase: new URL(siteUrl),
  alternates: {
    canonical: "/",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteUrl,
    siteName: "LoopinLive",
    title: "LoopinLive - Watch 6500+ Live TV Channels Free",
    description:
      "Stream 6500+ live TV channels from Bangladesh, India, and worldwide. Premium LoopinLive web player with HLS streaming, custom playlist support, and a modern UI.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "LoopinLive - Live TV streaming with 6500+ channels",
        type: "image/png",
      },
    ],
  },
  icons: {
    icon: "/Loopin-Live-Logo.png",
    shortcut: "/Loopin-Live-Logo.png",
    apple: "/Loopin-Live-Logo.png",
  },
  manifest: "/manifest.json",
  category: "entertainment",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const showPopup = process.env.SHOW_POPUP?.toLowerCase() === "true";

  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <head>
        <link rel="icon" href="/Loopin-Live-Logo.png" sizes="any" />
        <link rel="shortcut icon" href="/Loopin-Live-Logo.png" />
        <link rel="apple-touch-icon" href="/Loopin-Live-Logo.png" />
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        {children}
        <ClientPopupWrapper showPopup={showPopup} />
      </body>
    </html>
  );
}
