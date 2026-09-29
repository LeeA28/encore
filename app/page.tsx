"use client";

import dynamic from "next/dynamic";

// Next.js normally renders pages on the server first, but the server has no localStorage.
// ssr: false means "only render EncoreApp in the browser", so saved concerts load right away.
const EncoreApp = dynamic(() => import("@/components/EncoreApp"), { ssr: false });

export default function HomePage() {
  return <EncoreApp />;
}
