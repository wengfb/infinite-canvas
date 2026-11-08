import { isEmbeddedCanvas } from "@/lib/embedded-canvas";

// The host uses its authenticated HTTP client; tokens and API keys stay in the host.
export function isPoopiiEmbedded() {
    return isEmbeddedCanvas() && document.documentElement.dataset.poopiiEmbed === "true";
}

export function requestPoopiiImage<T>(operation: "generations" | "edits", body: Record<string, unknown> | FormData, signal: AbortSignal | undefined, timeout: number): Promise<T> {
    return new Promise((resolve, reject) => {
        if (signal?.aborted) {
            reject(new DOMException("Aborted", "AbortError"));
            return;
        }
        const channel = new MessageChannel();
        const close = () => {
            signal?.removeEventListener("abort", abort);
            channel.port1.close();
        };
        const abort = () => {
            channel.port1.postMessage("abort");
            close();
            reject(new DOMException("Aborted", "AbortError"));
        };
        channel.port1.onmessage = (event) => {
            close();
            if (typeof event.data?.error === "string") reject(new Error(event.data.error));
            else resolve(event.data.data as T);
        };
        signal?.addEventListener("abort", abort, { once: true });
        window.parent.postMessage({ type: "poopii:canvas-image", operation, timeout, body: body instanceof FormData ? [...body.entries()] : body }, window.location.origin, [channel.port2]);
    });
}
