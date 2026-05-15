import type { Metadata, Viewport } from "next";
import { Inter, Barlow_Condensed } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/Header";
import { Sidebar } from "@/components/Sidebar";
import { ClientProviders } from "@/components/ClientProviders";
import { DestinyProfileProvider } from "@/components/DestinyProfileProvider";
import { DestinyWrapped } from "@/components/Wrapped";

// Primary font - clean and modern
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

// Condensed font - for headers and labels (industrial feel)
const barlowCondensed = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-condensed",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL('https://warmind.app'), // Replace with your actual domain
  title: {
    default: "Warmind - Destiny 2 Companion",
    template: "%s | Warmind",
  },
  description: "A minimalist Destiny 2 companion app for gear, vault, and clan management. Manage your inventory, view activities, and track progress.",
  applicationName: "Warmind",
  keywords: ["Destiny 2", "Companion", "Inventory", "Vault", "Clan", "Warmind", "Bungie", "Game", "Manager"],
  authors: [{ name: "Warmind Team" }],
  creator: "Warmind Team",
  publisher: "Warmind",
  formatDetection: {
    telephone: false,
    address: false,
    email: false,
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Warmind",
    startupImage: [], // Add startup images if available
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://warmind.app",
    title: "Warmind - Destiny 2 Companion",
    description: "Manage your Destiny 2 inventory, vault, and clan with ease. A minimalist companion app designed for speed and simplicity.",
    siteName: "Warmind",
    images: [
      {
        url: "/og-image.jpg", // Add an OG image to your public folder
        width: 1200,
        height: 630,
        alt: "Warmind - Destiny 2 Companion",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Warmind - Destiny 2 Companion",
    description: "Manage your Destiny 2 inventory, vault, and clan with ease.",
    images: ["/og-image.jpg"], // Same as OG image usually
    creator: "@WarmindApp", // Replace with actual handle
  },
  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: '/favicon-32.ico', sizes: '32x32' },
      { url: '/favicon-64.ico', sizes: '64x64' },
    ],
    shortcut: ['/favicon.ico'],
    apple: [
      // Add apple touch icon if available, e.g. { url: '/apple-icon.png', sizes: '180x180' }
    ],
    other: [
      {
        rel: 'apple-touch-icon-precomposed',
        url: '/apple-touch-icon-precomposed.png',
      },
    ],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  verification: {
    google: "verification_token", // Replace with your verification token
    yandex: "yandex_verification_token",
    yahoo: "yahoo_verification_token",
    other: {
      me: ["my-email"],
    },
  },
  alternates: {
    canonical: "https://warmind.app",
    languages: {
      'en-US': 'https://warmind.app/en-US',
    },
  },
  category: 'game',
};

export const viewport: Viewport = {
  themeColor: "#020617",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`dark ${inter.variable} ${barlowCondensed.variable}`}>
      <head>
        {/* Preconnect to external domains for faster resource loading */}
        <link rel="preconnect" href="https://www.bungie.net" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://images.contentstack.io" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://www.bungie.net" />
        <link rel="dns-prefetch" href="https://images.contentstack.io" />
      </head>
      <body
        className={`antialiased min-h-screen flex flex-col font-sans`}
      >
        <DestinyProfileProvider>
          <ClientProviders>
            <Header />
            <div className="flex flex-1">
              <Sidebar />
            <main className="flex-1 w-full px-4 sm:px-8 py-8 md:pl-24 transition-all">
              {children}
            </main>
            </div>
            <DestinyWrapped />
          </ClientProviders>
        </DestinyProfileProvider>
      </body>
    </html>
  );
}
