import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Eu Tô On!",
    short_name: "Eu Tô On!",
    description: "Sua pelada organizada num link só.",
    start_url: "/",
    display: "standalone",
    background_color: "#0b1530",
    theme_color: "#0b1530",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
