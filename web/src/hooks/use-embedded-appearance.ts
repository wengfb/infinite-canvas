import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { useThemeStore } from "@/stores/use-theme-store";

const colorTokens = [
    "background", "foreground", "card", "card-foreground", "popover", "popover-foreground",
    "primary", "primary-foreground", "secondary", "secondary-foreground", "muted", "muted-foreground",
    "accent", "accent-foreground", "border", "input", "ring", "destructive",
] as const;

export type EmbeddedAppearance = {
    colors: Partial<Record<(typeof colorTokens)[number], string>>;
    fontFamily: string;
    fontSize: number;
    radius: number;
    controlHeight: number;
};

// Same-origin host appearance only; credentials never cross this bridge.
export function useEmbeddedAppearance() {
    const [appearance, setAppearance] = useState<EmbeddedAppearance | null>(null);
    const { i18n } = useTranslation();

    useEffect(() => {
        if (window.parent === window) return;
        const receive = (event: MessageEvent) => {
            if (event.origin !== window.location.origin || event.source !== window.parent) return;
            const data = event.data;
            if (!data || data.type !== "poopii:canvas-appearance" || !["light", "dark"].includes(data.theme)) return;
            if (!data.colors || typeof data.fontFamily !== "string" || typeof data.language !== "string") return;
            if (![data.fontSize, data.radius, data.controlHeight].every((value) => typeof value === "number" && Number.isFinite(value) && value >= 0)) return;
            const colors: EmbeddedAppearance["colors"] = {};
            const root = document.documentElement;
            root.dataset.poopiiEmbed = "true";
            for (const token of colorTokens) {
                const value = data.colors[token];
                if (typeof value !== "string" || !CSS.supports("color", value)) continue;
                colors[token] = value;
                root.style.setProperty(`--${token}`, value);
                root.style.setProperty(`--poopii-${token}`, value);
            }
            root.style.setProperty("--radius", `${data.radius}px`);
            root.style.setProperty("--poopii-radius", `${data.radius}px`);
            root.style.setProperty("--poopii-font-size", `${data.fontSize}px`);
            root.style.setProperty("--font-sans", data.fontFamily);
            root.style.setProperty("--spacing", `${data.controlHeight / 8}px`);
            root.style.fontFamily = data.fontFamily;
            root.style.setProperty("--text-sm", `${data.fontSize}px`);
            useThemeStore.setState({ theme: data.theme });
            void i18n.changeLanguage(data.language.startsWith("zh") ? "zh-CN" : "en-US");
            setAppearance({ colors, fontFamily: data.fontFamily, fontSize: data.fontSize, radius: data.radius, controlHeight: data.controlHeight });
        };
        window.addEventListener("message", receive);
        window.parent.postMessage({ type: "infinite-canvas:ready" }, window.location.origin);
        return () => window.removeEventListener("message", receive);
    }, [i18n]);

    return appearance;
}
