/** @type {import('next').NextConfig} */
const nextConfig = {
  // ...your existing configuration
  // Externalize certain packages for Server Components
  // (moved from experimental.serverComponentsExternalPackages in Next.js 15)
  serverExternalPackages: ['@google/genai'],
}

module.exports = nextConfig 