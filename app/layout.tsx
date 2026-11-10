import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, DM_Sans, Manrope } from "next/font/google";
import { m } from "@/lib/messages";
import "./globals.css";

const bricolage = Bricolage_Grotesque({ variable: "--font-bricolage", subsets: ["latin"] });
const dmSans = DM_Sans({ variable: "--font-dm-sans", subsets: ["latin"] });
const manrope = Manrope({ variable: "--font-manrope", subsets: ["latin"] });

export const metadata: Metadata = {
  // Set NEXT_PUBLIC_SITE_URL in production so link previews get absolute URLs.
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: m.meta.title,
  description: m.meta.description,
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${bricolage.variable} ${dmSans.variable} ${manrope.variable} antialiased`}
    >
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
