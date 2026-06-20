import type { Metadata, Viewport } from "next";
import { Press_Start_2P } from "next/font/google";
import "./globals.css";
import "./pixel-art.css";
import "./crt-effects.css";
import { Providers } from "@/components/Providers";

const fontPixel = Press_Start_2P({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-pixel",
  display: "swap",
});

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
  themeColor: "#00381a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={`dark ${fontPixel.variable}`}>
      <body className="antialiased bg-black">
        <Providers>
          <OnboardingGuard>
            {children}
          </OnboardingGuard>
        </Providers>
      </body>
    </html>
  );
}

function OnboardingGuard({ children }: { children: React.ReactNode }) {
  return children;
}
