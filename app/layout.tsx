import type { Metadata } from "next";
import { IBM_Plex_Mono, Newsreader, Public_Sans } from "next/font/google";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bursa.ai | Surgical Coding Intelligence",
  description:
    "Frontend prototype for AI-assisted surgical procedure coding gap analysis.",
  icons: {
    icon: "/icon.svg"
  }
};

const newsreader = Newsreader({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["400", "500", "600", "700"],
});

const publicSans = Public_Sans({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["300", "400", "500", "600", "700"],
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-data",
  weight: ["400", "500", "600"],
});

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${newsreader.variable} ${publicSans.variable} ${plexMono.variable}`}>
        {children}
      </body>
    </html>
  );
}
