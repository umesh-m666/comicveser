/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    unoptimized: true,
  },
  trailingSlash: false,
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Optional same-origin proxy: set API_INTERNAL_URL (e.g. https://your-api.onrender.com/api) and NEXT_PUBLIC_API_URL=/api
  // so the browser only talks to the web host. Helps on networks that block the API host and avoids cross-site cookies.
  async rewrites() {
    const target = process.env.API_INTERNAL_URL?.replace(/\/+$/, "");
    return target ? [{ source: "/api/:path*", destination: `${target}/:path*` }] : [];
  },
};

export default nextConfig;
