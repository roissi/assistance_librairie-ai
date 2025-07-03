import { Cabin, Inter } from "next/font/google";

export const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-inter",
});

export const cabin = Cabin({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-cabin",
});
