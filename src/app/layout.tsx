import type { Metadata } from "next";
import { Figtree, Noto_Sans } from "next/font/google";
import "./globals.css";

const figtree = Figtree({
  variable: "--font-figtree",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const notoSans = Noto_Sans({
  variable: "--font-noto-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "700"],
});

export const metadata: Metadata = {
  title: "GEO Audit | Is Your Business Invisible to AI?",
  description:
    "Find out if ChatGPT and Claude recommend your business or your competitors. Get your free GEO Visibility Report.",
  openGraph: {
    title: "GEO Audit | Is Your Business Invisible to AI?",
    description:
      "Find out if ChatGPT and Claude recommend your business or your competitors.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${figtree.variable} ${notoSans.variable} scroll-smooth`}
    >
      <body className="min-h-screen bg-slate-50 font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
