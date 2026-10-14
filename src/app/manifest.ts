import type { MetadataRoute } from "next";

// Lets the app be added to the home screen and open full screen like an app.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Food Planner",
    short_name: "Food Planner",
    description: "Weekly meal planning with Maia, your AI food assistant.",
    start_url: "/",
    display: "standalone",
    background_color: "#fbfaf7",
    theme_color: "#2f6b4f",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}
