import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  // 행사 기능은 2차 QA에서 뺐다. 옛 주소는 일정으로 보낸다
  async redirects() {
    return [
      { source: "/events", destination: "/schedule", permanent: false },
      { source: "/events/:path*", destination: "/schedule", permanent: false },
      { source: "/admin/team-tasks", destination: "/team-tasks", permanent: true },
    ];
  },
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
