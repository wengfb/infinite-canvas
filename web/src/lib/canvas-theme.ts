export type CanvasColorTheme = "light" | "dark";
export type CanvasBackgroundMode = "dots" | "lines" | "blank";

export const canvasThemes = {
    light: {
        canvas: {
            background: "var(--poopii-background, #f4f2ed)",
            dot: "var(--poopii-border, rgba(68,64,60,.28))",
            line: "var(--poopii-border, rgba(68,64,60,.12))",
            selectionStroke: "var(--poopii-primary, #1c1917)",
            selectionFill: "var(--poopii-accent, rgba(28,25,23,.06))",
        },
        node: {
            label: "var(--poopii-muted-foreground, #57534e)",
            fill: "var(--poopii-muted, #e7e5df)",
            panel: "var(--poopii-card, #fbfaf7)",
            stroke: "var(--poopii-border, #d6d3ca)",
            activeStroke: "var(--poopii-primary, #1c1917)",
            placeholder: "var(--poopii-muted-foreground, #8a8479)",
            text: "var(--poopii-foreground, #292524)",
            muted: "var(--poopii-muted-foreground, #78716c)",
            faint: "var(--poopii-muted-foreground, #a8a29e)",
        },
        toolbar: {
            panel: "var(--poopii-card, rgba(251,250,247,.96))",
            border: "var(--poopii-border, #d6d3ca)",
            item: "var(--poopii-foreground, #57534e)",
            itemHover: "var(--poopii-accent, #e7e5df)",
            activeBg: "var(--poopii-accent, #e7e5df)",
            activeText: "var(--poopii-accent-foreground, #292524)",
        },
    },
    dark: {
        canvas: {
            background: "var(--poopii-background, #181715)",
            dot: "var(--poopii-border, rgba(245,245,244,.24))",
            line: "var(--poopii-border, rgba(245,245,244,.10))",
            selectionStroke: "var(--poopii-primary, #fafaf9)",
            selectionFill: "var(--poopii-accent, rgba(250,250,249,.10))",
        },
        node: {
            label: "var(--poopii-muted-foreground, #d6d3d1)",
            fill: "var(--poopii-muted, #292524)",
            panel: "var(--poopii-card, #1f1d1a)",
            stroke: "var(--poopii-border, #44403c)",
            activeStroke: "var(--poopii-primary, #fafaf9)",
            placeholder: "var(--poopii-muted-foreground, #a8a29e)",
            text: "var(--poopii-foreground, #f5f5f4)",
            muted: "var(--poopii-muted-foreground, #d6d3d1)",
            faint: "var(--poopii-muted-foreground, #78716c)",
        },
        toolbar: {
            panel: "var(--poopii-card, rgba(31,29,26,.96))",
            border: "var(--poopii-border, #44403c)",
            item: "var(--poopii-foreground, #d6d3d1)",
            itemHover: "var(--poopii-accent, #292524)",
            activeBg: "var(--poopii-accent, #3a3631)",
            activeText: "var(--poopii-accent-foreground, #f5f5f4)",
        },
    },
} as const;

export type CanvasTheme = (typeof canvasThemes)[CanvasColorTheme];
