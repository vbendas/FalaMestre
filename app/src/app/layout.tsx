import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Press_Start_2P, VT323 } from "next/font/google";
import "./globals.css";
import "./pixel-art.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const pressStart2P = Press_Start_2P({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-pixel",
  display: "swap",
});

const vt323 = VT323({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-retro",
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
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${pressStart2P.variable} ${vt323.variable} antialiased bg-[#012169]`}
      >
        <OnboardingGuard>
          {children}
        </OnboardingGuard>
      </body>
    </html>
  );
}

function OnboardingGuard({ children }: { children: React.ReactNode }) {
  return children;
}
