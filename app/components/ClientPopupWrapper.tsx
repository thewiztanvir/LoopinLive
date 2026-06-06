"use client";

import dynamic from "next/dynamic";

const WorldCupPopup = dynamic(() => import("./WorldCupPopup"), {
  ssr: false,
});

interface ClientPopupWrapperProps {
  showPopup: boolean;
}

export default function ClientPopupWrapper({ showPopup }: ClientPopupWrapperProps) {
  return <WorldCupPopup showPopup={showPopup} />;
}
