import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";
import "./pixel-art.css";
import { Providers } from "@/components/Providers";
import { VintageBackground } from "@/components/ui/VintageBackground";

export const metadata: Metadata = {
  title: "Fala Mestre! - Demo for Socios",
  description: "Conversational football management game powered by AI. Manage your team, play matches, and earn Socios Points!",
  keywords: ["football", "soccer", "game", "AI", "management", "Socios", "Brazil"],
  authors: [{ name: "Fala Mestre Team" }],
  openGraph: {
    title: "Fala Mestre!",
    description: "The future of football gaming is in a conversation",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#009739",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className="dark">
      <head>
        <Script 
          src="https://aframe.io/releases/1.5.0/aframe.min.js" 
          strategy="beforeInteractive"
          crossOrigin="anonymous"
        />
      </head>
      <body className="antialiased bg-[#006400]">
        <VintageBackground />
        <Providers>
          <OnboardingGuard>
            <div className="relative" style={{ zIndex: 5 }}>
              {children}
            </div>
          </OnboardingGuard>
        </Providers>
      </body>
    </html>
  );
}

function OnboardingGuard({ children }: { children: React.ReactNode }) {
  return children;
}
