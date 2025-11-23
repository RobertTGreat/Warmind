import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Header } from "@/components/Header";
import { Sidebar } from "@/components/Sidebar";
import { Toaster } from "sonner";
import { FirstLoadWarning } from "@/components/FirstLoadWarning";
import { ClientManifestManager } from "@/components/ClientManifestManager";

export const metadata: Metadata = {
  title: "Warmind - Destiny 2 Companion",
  description: "A minimalist Destiny 2 companion app for gear, vault, and clan management.",
  applicationName: "Warmind",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Warmind",
  },
  formatDetection: {
    telephone: false,
  },
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
    <html lang="en" className="dark">
      <head>
        <link rel="stylesheet" href="https://use.typekit.net/uvz3adx.css" />
      </head>
      <body
        className={`antialiased min-h-screen flex flex-col`}
      >
        <Header />
        <div className="flex flex-1">
            <Sidebar />
            {/* 
                We add pl-16 (64px) on desktop to account for the fixed sidebar if it exists. 
                However, the sidebar is conditional. We might need a better layout strategy.
                But since Sidebar returns null if no items, we can't strictly rely on CSS padding unless we know it's there.
                Wait, sidebar is fixed left-0 w-16.
                If we just add pl-16 to main always, it might look weird on pages without sidebar.
                But consistency is key. Or we can make sidebar not fixed but relative.
                The prompt said "like the screenshot" which implies a fixed strip.
                For now, let's make the Sidebar relative in the flex container if we want to avoid fixed overlap,
                or keep it fixed and add padding. 
                Actually, let's rely on the Sidebar component handling its display and checking if we need padding.
                Since Sidebar is a client component (uses usePathname), we can't easily conditionally class the server rendered body/main based on it without context.
                
                Alternative: Make Sidebar sticky.
            */}
            <main className="flex-1 w-full px-4 sm:px-8 py-8 md:pl-24 transition-all">
              {children}
            </main>
        </div>
        <FirstLoadWarning />
        <ClientManifestManager />
        <Toaster position="bottom-center" theme="system" closeButton />
      </body>
    </html>
  );
}
