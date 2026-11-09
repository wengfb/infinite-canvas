import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";
import { chromium, type Browser, type Page } from "playwright";
import { expect as browserExpect } from "playwright/test";

// Run against Vite: CANVAS_TEST_URL=http://127.0.0.1:5174/canvas-app/ bun test ./tests/poopii-model-picker/selection.browser.test.ts
// Set CANVAS_TEST_CHANNEL=msedge to use an installed Edge instead of Playwright Chromium.
const canvasUrl = process.env.CANVAS_TEST_URL;
const catalog = {
    defaultGroup: "images",
    groups: [
        { name: "images", description: "Image creation", models: ["gpt-image-2", "gpt-image-2.5"], capabilities: { text: ["text-a", "text-b"], audio: ["tts-a", "tts-b"], video: ["sora-a", "sora-b"] } },
        { name: "premium", description: "Premium", models: ["gpt-image-2", "dall-e-3"], capabilities: { text: ["text-a", "text-c"], audio: ["tts-a", "tts-c"], video: ["sora-a", "sora-c"] } },
    ],
};

describe.skipIf(!canvasUrl)("embedded image group and model selection", () => {
    let browser: Browser;
    let page: Page;

    beforeAll(async () => {
        browser = await chromium.launch({ channel: process.env.CANVAS_TEST_CHANNEL, headless: true });
    });
    afterEach(async () => { await page?.context().close(); });
    afterAll(async () => { await browser?.close(); });

    test.each([
        { type: "config", theme: "light", scale: 1, width: 340, controlHeight: 32 },
        { type: "config", theme: "dark", scale: 0.67, width: 340, controlHeight: 28 },
        { type: "config", theme: "light", scale: 1.5, width: 340, controlHeight: 40 },
        { type: "config", theme: "dark", scale: 1, width: 280, controlHeight: 36 },
        { type: "image", theme: "light", scale: 1, width: 340, controlHeight: 32 },
        ...(["text", "audio", "video"] as const).flatMap((mode) => [
            { type: "config", mode, theme: "dark", scale: 1, width: 280, controlHeight: 36 },
            { type: mode, mode, theme: "light", scale: 1, width: 340, controlHeight: 32 },
        ]),
    ])("%j keeps generation visible and retains mouse and keyboard choices", async (scenario) => {
        const { type, theme, scale, width, controlHeight } = scenario;
        const mode = "mode" in scenario ? scenario.mode : "image";
        const prefix = { image: "gpt-image-2", text: "text-a", audio: "tts-a", video: "sora-a" }[mode];
        const second = { image: "gpt-image-2.5", text: "text-b", audio: "tts-b", video: "sora-b" }[mode];
        const third = { image: "dall-e-3", text: "text-c", audio: "tts-c", video: "sora-c" }[mode];
        const label = { image: "生图", text: "文本", audio: "音频", video: "视频" }[mode];
        const base = new URL(canvasUrl!);
        page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
        await page.addInitScript(({ catalog, theme, controlHeight }) => {
            if (window.parent !== window) return;
            window.addEventListener("message", (event) => {
                if (event.origin !== window.location.origin) return;
                if (event.data?.type === "poopii:canvas-catalog") {
                    event.ports[0].postMessage({ data: catalog });
                    event.ports[0].close();
                }
                if (event.data?.type === "infinite-canvas:ready") (event.source as Window).postMessage({
                    type: "poopii:canvas-appearance", theme, colors: {}, fontFamily: "sans-serif",
                    fontSize: 14, radius: 8, controlHeight, language: "zh",
                }, event.origin);
            });
        }, { catalog, theme, controlHeight });
        await page.route("**/__picker_test__", (route) => route.fulfill({
            contentType: "text/html",
            body: `<iframe src="${new URL("canvas", base)}" style="width:100%;height:100vh;border:0"></iframe>`,
        }));
        await page.goto(new URL("__picker_test__", base).href);
        const canvas = page.frameLocator("iframe");
        await canvas.getByRole("button", { name: "新建画布", exact: true }).first().waitFor();
        const app = page.frames().find((frame) => frame.parentFrame())!;
        await app.evaluate(async ({ base, catalog, type, mode, prefix, scale, width }) => {
            const { useCanvasStore } = await import(base + "src/stores/canvas/use-canvas-store.ts");
            const { createCanvasNode } = await import(base + "src/lib/canvas/canvas-node-factory.ts");
            useCanvasStore.getState().importProject({
                title: "Picker regression",
                nodes: [{ ...createCanvasNode(type, { x: 450, y: 260 }, { generationMode: mode, model: "poopii:images::" + prefix, prompt: "Selection only" }), width }],
                viewport: { x: 0, y: 0, k: scale },
            });
        }, { base: base.href, catalog, type, mode, prefix, scale, width });
        await page.locator("iframe").evaluate((iframe, appearance) => {
            (iframe as HTMLIFrameElement).contentWindow!.postMessage({
                type: "poopii:canvas-appearance", theme: appearance.theme,
                colors: {}, fontFamily: "sans-serif", fontSize: 14, radius: 8,
                controlHeight: appearance.controlHeight, language: "zh",
            }, window.location.origin);
        }, { theme, controlHeight });
        await canvas.getByText("Picker regression", { exact: true }).click();
        if (type !== "config") await canvas.locator("[data-node-id]").first().click();

        if (type === "config") {
            const generate = canvas.getByRole("button", { name: "开始生成", exact: true });
            await generate.waitFor();
            const visible = await generate.evaluate((button) => {
                const bounds = button.getBoundingClientRect();
                return [bounds.top + 2, bounds.bottom - 2].every((y) => button.contains(document.elementFromPoint(bounds.x + bounds.width / 2, y)));
            });
            expect(visible).toBe(true);
        }

        const modelInput = canvas.getByRole("combobox", { name: label + "模型" });
        const groupInput = canvas.getByRole("combobox", { name: label + "分组" });
        const modelSelect = canvas.locator(".ant-select").filter({ has: modelInput });
        const groupSelect = canvas.locator(".ant-select").filter({ has: groupInput });

        await modelInput.click();
        await canvas.locator(".ant-select-item-option").filter({ hasText: second }).click();
        await modelSelect.getByText(second, { exact: true }).waitFor();
        expect(await modelInput.getAttribute("aria-expanded")).toBe("false");

        await groupInput.fill("prem");
        await canvas.locator(".ant-select-item-option").filter({ hasText: /^premium$/ }).click();
        await groupSelect.getByText("premium", { exact: true }).waitFor();
        await modelSelect.getByText(prefix, { exact: true }).waitFor();

        await modelInput.fill(third);
        await modelInput.press("ArrowDown");
        await modelInput.press("Enter");
        await modelSelect.getByText(third, { exact: true }).waitFor();
        expect(await modelInput.getAttribute("aria-expanded")).toBe("false");

        // Wait for the actual persisted choice before reloading the frame.
        await browserExpect.poll(() => app.evaluate(async (base) => {
            const { localForageStorage } = await import(base + "src/lib/localforage-storage.ts");
            const saved = await localForageStorage.getItem("infinite-canvas:canvas_store");
            return saved && JSON.parse(saved).state.projects[0]?.nodes[0]?.metadata?.model;
        }, base.href)).toBe("poopii:premium::" + third);
        await app.goto(app.url());
        if (type !== "config") await canvas.locator("[data-node-id]").first().click();
        await modelInput.waitFor();
        await groupSelect.getByText("premium", { exact: true }).waitFor();
        await modelSelect.getByText(third, { exact: true }).waitFor();
    }, 30_000);
});
