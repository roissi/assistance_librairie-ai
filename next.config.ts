import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Configuration pour les images distantes via Remote Patterns
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "covers.openlibrary.org",
        port: "",
        // Autorise tous les chemins de couvertures ISBN
        pathname: "/b/isbn/**",
      },
    ],
  },
  // Vous pouvez ajouter d'autres options de configuration ici
};

export default nextConfig;
