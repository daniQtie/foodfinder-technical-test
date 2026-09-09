import type { NextConfig } from "next";
import dotenv from "dotenv";

dotenv.config({ path: new URL("../../.env", import.meta.url) });

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.openfoodfacts.org" },
      { protocol: "https", hostname: "static.openfoodfacts.org" },
    ],
  },
};

export default nextConfig;
