import type { ReactNode } from "react";

import { AgentPanel } from "@/components/agent/agent-panel";
import { AppTopNav } from "@/components/layout/app-top-nav";
import { isEmbeddedCanvas } from "@/lib/embedded-canvas";

export default function UserLayout({ children }: { children: ReactNode }) {
    const embedded = isEmbeddedCanvas();
    return (
        <div className="flex h-dvh overflow-hidden bg-background text-foreground">
            <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
                {!embedded ? <AppTopNav /> : null}
                <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
            </div>
            {!embedded ? <AgentPanel /> : null}
        </div>
    );
}
