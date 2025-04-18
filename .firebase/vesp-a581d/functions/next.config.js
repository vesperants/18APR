"use strict";

// next.config.js
var nextConfig = {
  // ...your existing configuration
  experimental: {
    // ...your existing experimental config
    serverComponentsExternalPackages: ["@google/genai"]
  }
};
module.exports = nextConfig;
