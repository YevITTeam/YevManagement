// Stock layout verified on the IT room's ZD230: one feed = one row of two labels on a pre-cut roll,
// so @page must match a single row exactly or the driver rescales the content.
export const ZEBRA_LABELS_PER_ROW = 2;
export const ZEBRA_PAGE_WIDTH_CM = 10.6;
export const ZEBRA_PAGE_HEIGHT_CM = 3.3;
export const ZEBRA_LABEL_WIDTH_CM = 5.2;
export const ZEBRA_LABEL_HEIGHT_CM = 3.1;
export const ZEBRA_ROW_GAP_CM = ZEBRA_PAGE_WIDTH_CM - ZEBRA_LABEL_WIDTH_CM * ZEBRA_LABELS_PER_ROW;

export function escapeHtml(value: string) {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

// Printing right after document.write races the image decode in the new window and prints blank QR codes.
export function waitForImagesToLoad(doc: Document) {
    const images = Array.from(doc.images);
    if (images.length === 0) return Promise.resolve();

    return Promise.all(
        images.map(
            (img) =>
                new Promise<void>((resolve) => {
                    if (img.complete) {
                        resolve();
                        return;
                    }
                    img.addEventListener("load", () => resolve(), { once: true });
                    img.addEventListener("error", () => resolve(), { once: true });
                })
        )
    );
}
