"use strict";

// next.config.js
var nextConfig = {
  // ...your existing configuration
  // Externalize certain packages for Server Components
  // (moved from experimental.serverComponentsExternalPackages in Next.js 15)
  serverExternalPackages: ["@google/genai"],
  // Disable ESLint during builds to prevent CI/build failures from lint warnings/errors
  eslint: {
    ignoreDuringBuilds: true
  }
};
module.exports = nextConfig;
