import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Zarman Exchange",
    short_name: "Zarman",
    description:
      "Premium AUD/IRT remittance service with transparent rates and enterprise-grade reliability.",
    start_url: "/",
    display: "standalone",
    background_color: "#080B12",
    theme_color: "#080B12",
    icons: [
      {
        src: "/favicon.ico",
        sizes: "48x48",
        type: "image/x-icon",
      },
    ],
  };
}