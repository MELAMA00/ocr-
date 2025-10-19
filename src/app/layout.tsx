import type { Metadata } from "next";
import { Inter, Silkscreen } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });
const silkscreen = Silkscreen({ subsets: ["latin"], weight: "700", variable: "--font-silkscreen" });

export const metadata: Metadata = {
  title: "OCR App",
  description: "convert images to text using OCR technology",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className={`${inter.className} ${silkscreen.variable} bg-white text-neutral-900`}>
        {children}
      </body>
    </html>
  );
}
