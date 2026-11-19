import type { MetadataRoute } from "next";

const SITE = (process.env.APP_BASE_URL || "https://creatuburger.com").replace(/\/$/, "");

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/api/", "/pedido"] },
    sitemap: `${SITE}/sitemap.xml`,
    host: SITE,
  };
}
