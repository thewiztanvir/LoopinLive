"use client";

import dynamic from "next/dynamic";

const BackgroundScene = dynamic(
  () => import("./components/BackgroundScene"),
  { ssr: false }
);

const Header = dynamic(() => import("./components/Header"), { ssr: false });

const LoopinLiveStream = dynamic(
  () => import("./components/LoopinLiveStream"),
  { ssr: false }
);

export default function Home() {
  return (
    <main className="relative min-h-screen">
      <BackgroundScene />
      <div className="relative z-10">
        <Header />
        <LoopinLiveStream />
      </div>
    </main>
  );
}
