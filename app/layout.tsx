import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { Noto_Sans_JP } from "next/font/google";
import "./globals.css";

const notoSans = Noto_Sans_JP({
  variable: "--font-noto-sans",
  weight: ["400", "500", "600", "700", "800"],
  subsets: ["latin"],
  display: "swap",
  preload: true,
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0a0a0a",
  colorScheme: "dark",
};

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const forwardedHost = requestHeaders.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost || requestHeaders.get("host") || "humanmarketcap.com";
  const forwardedProtocol = requestHeaders.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const protocol = forwardedProtocol || (host.startsWith("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;
  const imageUrl = `${origin}/og-v16.png`;
  return {
    metadataBase: new URL(origin),
    title: "人間時価総額 CALCULATOR",
    description: "60職業・学歴・資産・金融判断から、あなたの残りのキャリア価値をDCF的に査定します。",
    alternates: {
      canonical: "/",
    },
    robots: {
      index: true,
      follow: true,
    },
    openGraph: {
      title: "人間時価総額 CALCULATOR",
      description: "あなたの価値を、数字にする。",
      url: origin,
      siteName: "人間時価総額 CALCULATOR",
      images: [{ url: imageUrl, width: 1200, height: 630, alt: "人間時価総額 CALCULATOR" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "人間時価総額 CALCULATOR",
      description: "あなたの価値を、数字にする。",
      images: [imageUrl],
    },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja" className={notoSans.variable}>
      <body>{children}</body>
    </html>
  );
}
