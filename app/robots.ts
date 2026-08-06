import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/api/"],
    },
    sitemap: "https://humanmarketcap.com/sitemap.xml",
    host: "https://humanmarketcap.com",
  };
}
