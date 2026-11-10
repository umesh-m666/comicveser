/** @type {import('next').NextConfig} */
const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  {
    key: "Content-Security-Policy-Report-Only",
    value: "default-src 'self'; img-src 'self' https: data: blob:; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://accounts.google.com; style-src 'self' 'unsafe-inline'; connect-src 'self' https: http://localhost:4000; frame-src https://accounts.google.com; frame-ancestors 'none'; base-uri 'self'; object-src 'none'",
  },
];

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    unoptimized: true,
  },
  trailingSlash: false,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
  async rewrites() {
    const target = process.env.API_INTERNAL_URL?.replace(/\/+$/, "");
    return target ? [{ source: "/api/:path*", destination: `${target}/:path*` }] : [];
  },
};

export default nextConfig;
