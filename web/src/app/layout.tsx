import type { Metadata } from "next";
import localFont from "next/font/local";
import { Shell } from "@/components/Shell";
import "./globals.css";

// Sockabus type (spec §4.1): Archivo for UI, Archivo Black for display, JetBrains Mono for data.
// Self-hosted (from @fontsource, OFL) so builds don't depend on fetching Google Fonts.
const archivo = localFont({
  variable: "--font-archivo",
  src: [
    { path: "./fonts/archivo-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./fonts/archivo-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "./fonts/archivo-latin-600-normal.woff2", weight: "600", style: "normal" },
    { path: "./fonts/archivo-latin-700-normal.woff2", weight: "700", style: "normal" },
  ],
});

const archivoBlack = localFont({
  variable: "--font-archivo-black",
  src: "./fonts/archivo-black-latin-400-normal.woff2",
  weight: "400",
});

const jetbrainsMono = localFont({
  variable: "--font-jetbrains-mono",
  src: [
    { path: "./fonts/jetbrains-mono-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./fonts/jetbrains-mono-latin-500-normal.woff2", weight: "500", style: "normal" },
  ],
});

export const metadata: Metadata = {
  title: { default: "Sockabus Console", template: "%s · Sockabus" },
  description: "Scam intelligence network for Southeast Asia",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${archivo.variable} ${archivoBlack.variable} ${jetbrainsMono.variable}`}>
      <body>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
