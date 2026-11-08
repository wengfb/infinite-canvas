// Embedded canvases expose image creation tools; the standalone app keeps its full UI.
export function isEmbeddedCanvas() {
    return window.parent !== window;
}

export function canCreateCanvasNode(type: string) {
    return !isEmbeddedCanvas() || type === "image" || type === "text" || type === "group";
}
