import type { Metadata } from "next";
import { Caveat, Kalam, Patrick_Hand } from "next/font/google";
import "./globals.css";

// "Scribble squared paperblock" type system:
//  - Caveat       → headings / handwriting voice (--font-hand)
//  - Patrick Hand → UI body & labels, the printed hand (--font-print)
//  - Kalam        → numerals & money, so amounts read as jotted figures (--font-num)
const caveat = Caveat({
  variable: "--font-hand",
  weight: ["500", "600", "700"],
  subsets: ["latin"],
});

const patrickHand = Patrick_Hand({
  variable: "--font-print",
  weight: "400",
  subsets: ["latin"],
});

const kalam = Kalam({
  variable: "--font-num",
  weight: ["400", "700"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Culpa",
  description: "Track debts within a small group of people.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${caveat.variable} ${patrickHand.variable} ${kalam.variable} h-full antialiased`}
    >
      <body className="culpa-paper flex min-h-full flex-col">{children}</body>
    </html>
  );
}
