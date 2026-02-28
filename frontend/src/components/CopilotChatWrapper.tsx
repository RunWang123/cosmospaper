"use client";

import dynamic from "next/dynamic";

const CopilotChat = dynamic(
    () => import("@/components/CopilotChat").then((mod) => mod.CopilotChat),
    { ssr: false }
);

export function CopilotChatWrapper() {
    return <CopilotChat />;
}
