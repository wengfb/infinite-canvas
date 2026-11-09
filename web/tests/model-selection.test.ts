import { afterAll, expect, test } from "bun:test";
import type { AiConfig, ModelCapability } from "../src/stores/use-config-store";
import type { CanvasNodeData } from "../src/types/canvas";

// Config and i18n use browser storage during module initialization.
const values = new Map<string, string>();
const originalStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
        removeItem: (key: string) => values.delete(key),
    },
});
afterAll(() => {
    if (originalStorage) Object.defineProperty(globalThis, "localStorage", originalStorage);
    else Reflect.deleteProperty(globalThis, "localStorage");
});

const { defaultConfig, resolveModelForCapability, useConfigStore, embeddedImageConfig, encodeChannelModel, resolveModelRequestConfig, selectableModelsByCapability, modelMatchesCapability } = await import("../src/stores/use-config-store");
const { buildGenerationConfig } = await import("../src/lib/canvas/canvas-generation-helpers");
const { CanvasNodeType } = await import("../src/types/canvas");

const config: AiConfig = {
    ...defaultConfig,
    videoModel: "replacement::video-b",
    channels: [
        {
            id: "replacement",
            name: "Replacement",
            baseUrl: "https://example.com",
            apiKey: "test-key",
            apiFormat: "openai",
            models: [
                { name: "video-b", capability: "video" },
                { name: "video-a", capability: "video" },
                { name: "image-a", capability: "image" },
            ],
        },
    ],
};
const ready = useConfigStore.getState().isAiConfigReady;
const videoNode = (model: string): CanvasNodeData => ({
    id: "saved-video",
    type: CanvasNodeType.Video,
    title: "Saved video",
    position: { x: 0, y: 0 },
    width: 320,
    height: 180,
    metadata: { model, videoTaskId: "original-task", videoTaskProvider: "openai", seconds: "4" },
});

test("a saved video on a removed provider is not replaced by the default video model", () => {
    const selected = buildGenerationConfig(config, videoNode("removed::video-a"), "video");
    expect(selected.model).toBe("removed::video-a");
    expect(ready(selected, selected.model)).toBe(false);
});

test("removing a model from an existing provider prevents retry even with valid credentials", () => {
    const selected = buildGenerationConfig(config, videoNode("replacement::deleted-video"), "video");
    expect(selected.model).toBe("replacement::deleted-video");
    expect(ready(selected, selected.model)).toBe(false);
});

test("task recovery rejects a missing provider instead of querying the first provider", () => {
    expect(ready(config, "removed::video-a")).toBe(false);
    expect(ready(config, "unknown-video")).toBe(false);
});

test("an explicitly selected unavailable default is not replaced by the built-in default", () => {
    const selected = buildGenerationConfig({ ...config, videoModel: "removed::video-a" }, undefined, "video");
    expect(selected.model).toBe("removed::video-a");
    expect(ready(selected, selected.model)).toBe(false);
});

test("a new node without a selection still uses its configured default", () => {
    const selected = buildGenerationConfig(config, undefined, "video");
    expect(selected.model).toBe("replacement::video-b");
    expect(ready(selected, selected.model)).toBe(true);
});

test("switching generation capability still selects a model of the new capability", () => {
    expect(resolveModelForCapability(config, "replacement::image-a", "video")).toBe("replacement::video-b");
});

test("changing only the key on the same provider preserves the saved model and task", () => {
    const node = videoNode("replacement::video-a");
    const selected = buildGenerationConfig({ ...config, channels: [{ ...config.channels[0], apiKey: "rotated-key" }] }, node, "video");
    expect(selected.model).toBe("replacement::video-a");
    expect(ready(selected, selected.model)).toBe(true);
    expect(node.metadata?.videoTaskId).toBe("original-task");
    expect(ready({ ...selected, channels: [{ ...config.channels[0], apiKey: "" }] }, selected.model)).toBe(false);
});

test("unavailable explicit selections are preserved for every generation capability", () => {
    for (const capability of ["image", "video", "text", "audio"] as ModelCapability[]) {
        expect(resolveModelForCapability(config, `removed::${capability}`, capability)).toBe(`removed::${capability}`);
    }
});

const embeddedConfig = embeddedImageConfig(defaultConfig, {
    defaultGroup: "images",
    groups: [
        { name: "images", description: "Image creation", models: ["gpt-image-2", "dall-e-3"] },
        { name: "premium / image", description: "Premium", models: ["gpt-image-2"] },
        { name: "empty", description: "No image models", models: [] },
    ],
});

test("embedded defaults use the authenticated catalog without replacing standalone settings", () => {
    expect(embeddedConfig.imageModel).toBe("poopii:images::gpt-image-2");
    expect(ready(embeddedConfig, embeddedConfig.imageModel)).toBe(true);
    expect(embeddedConfig.channels.every((channel) => !channel.apiKey && !channel.baseUrl)).toBe(true);
    expect(useConfigStore.getState().config.channels).toEqual(defaultConfig.channels);
    expect(resolveModelForCapability(embeddedConfig, defaultConfig.imageModel, "image")).toBe(embeddedConfig.imageModel);
});

test("identical model names retain their explicit group when resolving a request", () => {
    const model = encodeChannelModel("poopii:" + encodeURIComponent("premium / image"), "gpt-image-2");
    const selected = resolveModelRequestConfig({ ...embeddedConfig, model }, model);
    expect(selected.model).toBe("gpt-image-2");
    expect(selected.group).toBe("premium / image");
    expect(resolveModelForCapability(embeddedConfig, model, "image")).toBe(model);
});

test("empty catalogs and removed embedded selections block generation without switching groups", () => {
    const removed = "poopii:removed::gpt-image-2";
    expect(resolveModelForCapability(embeddedConfig, removed, "image")).toBe(removed);
    expect(ready(embeddedConfig, removed)).toBe(false);
    expect(ready(embeddedConfig, "poopii:empty::")).toBe(false);
    const unloaded = embeddedImageConfig(defaultConfig, null);
    expect(ready(unloaded, unloaded.model)).toBe(false);
});

test("embedded generation and multipart editing send the node's selected group and raw model", async () => {
    const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
    const originalDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
    const requests: { operation: string; body: Record<string, unknown> | [string, string | File][] }[] = [];
    Object.defineProperty(globalThis, "document", { configurable: true, value: { documentElement: { dataset: { poopiiEmbed: "true" } } } });
    Object.defineProperty(globalThis, "window", { configurable: true, value: {
        location: { origin: "http://host.test" },
        parent: { postMessage: (message: typeof requests[number], _origin: string, ports: MessagePort[]) => {
            requests.push(message);
            ports[0].postMessage({ error: "request captured" });
            ports[0].close();
        } },
    } });
    try {
        const { requestGeneration, requestEdit } = await import("../src/services/api/image");
        const model = encodeChannelModel("poopii:" + encodeURIComponent("premium / image"), "gpt-image-2");
        const selected = { ...embeddedConfig, model, count: "1" };
        await expect(requestGeneration(selected, "A blue cup")).rejects.toThrow("request captured");
        expect(requests[0].operation).toBe("generations");
        expect(requests[0].body).toMatchObject({ group: "premium / image", model: "gpt-image-2", n: 1 });
        await expect(requestEdit(selected, "Make it blue", [{ id: "reference", name: "reference.png", type: "image/png", dataUrl: "data:image/png;base64,aW1hZ2U=" }])).rejects.toThrow("request captured");
        const fields = new Map(requests[1].body as [string, string | File][]);
        expect(requests[1].operation).toBe("edits");
        expect(fields.get("group")).toBe("premium / image");
        expect(fields.get("model")).toBe("gpt-image-2");
        expect(fields.get("n")).toBe("1");
        expect(fields.get("image")).toBeInstanceOf(File);
    } finally {
        if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
        else Reflect.deleteProperty(globalThis, "window");
        if (originalDocument) Object.defineProperty(globalThis, "document", originalDocument);
        else Reflect.deleteProperty(globalThis, "document");
    }
});

const multiConfig = embeddedImageConfig(defaultConfig, {
 defaultGroup: "all", groups: [{ name: "all", description: "All", models: ["multi"], capabilities: { text: ["multi", "gpt-text"], audio: ["tts-1"], video: ["sora-2"] } }],
});
test("each embedded capability has filtered defaults and preserves shared model capabilities", () => {
 for (const mode of ["text", "audio", "video", "image"] as const) {
   const value = multiConfig[`${mode}Model`];
   expect(ready(multiConfig, value)).toBe(true);
   expect(selectableModelsByCapability(multiConfig, mode)).toContain(value);
   expect(resolveModelForCapability(multiConfig, defaultConfig[`${mode}Model`], mode)).toBe(value);
   expect(modelMatchesCapability(multiConfig, value, mode)).toBe(true);
   expect(resolveModelRequestConfig(multiConfig, value).group).toBe("all");
   expect(resolveModelForCapability(multiConfig, `poopii:deleted::${mode}`, mode)).toBe(`poopii:deleted::${mode}`);
 }
 expect(modelMatchesCapability(multiConfig, "poopii:all::multi", "text")).toBe(true);
 expect(modelMatchesCapability(multiConfig, "poopii:all::multi", "image")).toBe(true);
 expect(modelMatchesCapability(multiConfig, "poopii:all::tts-1", "video")).toBe(false);
});

test("embedded text streams, speech blobs and resumable video tasks use the selected group", async () => {
 const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
 const originalDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
 const captured: Record<string, any>[] = [];
 Object.defineProperty(globalThis, "document", { configurable: true, value: { documentElement: { dataset: { poopiiEmbed: "true" } } } });
 Object.defineProperty(globalThis, "window", { configurable: true, value: {
  location: { origin: "http://host.test" },
  parent: { postMessage: (message: Record<string, any>, _origin: string, ports: MessagePort[]) => {
   captured.push(message);
   const port = ports[0];
   if (message.operation === "text") {
    port.postMessage({ chunk: 'data: {"choices":[{"delta":{"content":"Hello"}}]}\n' });
    port.postMessage({ chunk: '\ndata: {"choices":[{"delta":{"content":" canvas"}}]}\n\ndata: [DONE]\n\n' });
    port.postMessage({ data: null });
   } else if (message.operation === "speech") port.postMessage({ data: new Blob(["audio"], { type: "audio/mpeg" }) });
   else if (message.operation === "video-create") port.postMessage({ data: { id: "saved-video", status: "queued" } });
   else if (message.operation === "video-status") port.postMessage({ data: { id: "saved-video", status: "completed", url: "/v1/videos/saved-video/content" } });
   else port.postMessage({ data: new Blob(["video"], { type: "video/mp4" }) });
   port.close();
  } },
 } });
 try {
  const { requestImageQuestion } = await import("../src/services/api/image");
  const { requestAudioGeneration } = await import("../src/services/api/audio");
  const { createVideoGenerationTask, pollVideoGenerationTask } = await import("../src/services/api/video");
  const deltas: string[] = [];
  expect(await requestImageQuestion({ ...multiConfig, model: multiConfig.textModel }, [{ role: "user", content: "Hi" }], (text) => deltas.push(text))).toBe("Hello canvas");
  expect(deltas).toEqual(["Hello", "Hello canvas"]);
  const audio = await requestAudioGeneration({ ...multiConfig, model: multiConfig.audioModel }, "Hello");
  expect(audio.type).toBe("audio/mpeg");
  const task = await createVideoGenerationTask({ ...multiConfig, model: multiConfig.videoModel }, "A cat");
  expect(task).toEqual({ id: "saved-video", provider: "openai", model: multiConfig.videoModel });
  const result = await pollVideoGenerationTask(multiConfig, task);
  expect(result.status).toBe("completed");
  expect(captured[0].body).toMatchObject({ group: "all", model: "multi", stream: true });
  expect(captured[1].body).toMatchObject({ group: "all", model: "tts-1", input: "Hello" });
  expect(new Map(captured[2].body).get("group")).toBe("all");
  expect(new Map(captured[2].body).get("model")).toBe("sora-2");
  expect(captured.slice(3).map((entry) => [entry.operation, entry.taskId])).toEqual([["video-status", "saved-video"], ["video-content", "saved-video"]]);
 } finally {
  if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow); else Reflect.deleteProperty(globalThis, "window");
  if (originalDocument) Object.defineProperty(globalThis, "document", originalDocument); else Reflect.deleteProperty(globalThis, "document");
 }
});
