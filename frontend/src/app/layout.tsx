import type { Metadata } from "next";
import { Inter, Oswald } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const oswald = Oswald({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-oswald",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Retake Roulette — Daily Valorant Tactical Puzzle",
  description:
    "One post-plant scenario per day. Draw your retake plan on the minimap, execute, and see how it plays out. Can you out-think the community?",
  keywords: ["Valorant", "retake", "tactical puzzle", "daily challenge", "minimap"],
  openGraph: {
    title: "Retake Roulette",
    description: "Daily Valorant retake puzzle — plan your retake, execute, compare with the community",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${oswald.variable} font-body antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
