// Embedded canvases expose built-in creation tools; the standalone app keeps its full UI.
export function isEmbeddedCanvas() {
    return window.parent !== window;
}

export function canCreateCanvasNode(type: string) {
    return !isEmbeddedCanvas() || ["image", "text", "group", "video", "audio", "config"].includes(type);
}
