import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import "./globals.css";

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
  const host = forwardedHost || requestHeaders.get("host") || "localhost:3000";
  const forwardedProtocol = requestHeaders.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const protocol = forwardedProtocol || (host.startsWith("localhost") ? "http" : "https");
  const imageUrl = `${protocol}://${host}/og-v16.png`;
  return {
    title: "人間時価総額 CALCULATOR",
    description: "60職業・学歴・資産・金融判断から、あなたの残りのキャリア価値をDCF的に査定します。",
    openGraph: {
      title: "人間時価総額 CALCULATOR",
      description: "あなたの価値を、数字にする。",
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
  return <html lang="ja"><body>{children}</body></html>;
}
