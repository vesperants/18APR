/** @type {import('next').NextConfig} */
const nextConfig = {
  // ...your existing configuration
  experimental: {
    // ...your existing experimental config
    serverComponentsExternalPackages: ['@google/genai']
  }
}

module.exports = nextConfig 