import "./globals.css";
import { cabin } from "@/lib/fonts";

export const metadata = {
  title: "Assistant Fiche Livre",
  description:
    "Génère des fiches, meta descriptions et newsletters pour libraires",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" className={cabin.className}>
      <body className="min-h-screen flex flex-col items-center justify-between bg-gradient-to-b from-[#ede4f7] to-[#fdfcfb] py-10 antialiased text-gray-900">
        {children}
        <footer className="mt-8 text-sm text-gray-600">
          © Cyril De Graeve / 2025 -{" "}
          <a
            href="https://www.bethere.cyrildegraeve.dev/"
            className="underline hover:text-gray-800"
            target="_blank"
            rel="noopener noreferrer"
          >
            bethere.cyrildegraeve.dev
          </a>{" "}
          - 06 76 04 54 31
        </footer>
      </body>
    </html>
  );
}
