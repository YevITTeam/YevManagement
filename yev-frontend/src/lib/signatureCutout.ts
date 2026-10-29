// Mirrored by yev-backend Attendance.Application/Services/SignatureCutout.cs (Excel import); change both together.
const MAX_WIDTH = 800;
const PADDING = 8;
const PAPER_RADIUS = 20;
const MERGE_RADIUS = 10;
const INK_ALPHA_MIN = 40;
const CLUSTER_ALPHA_MIN = 128;
const PAPER_FLOOR = 60;

// Square max filter (separable): a window wider than any stroke only sees paper, so it tracks local lighting.
function maxFilter(src: Uint8Array, w: number, h: number, r: number) {
    const tmp = new Uint8Array(src.length);
    const out = new Uint8Array(src.length);
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            let m = 0;
            for (let k = Math.max(0, x - r); k <= Math.min(w - 1, x + r); k++) m = Math.max(m, src[y * w + k]);
            tmp[y * w + x] = m;
        }
    }
    for (let x = 0; x < w; x++) {
        for (let y = 0; y < h; y++) {
            let m = 0;
            for (let k = Math.max(0, y - r); k <= Math.min(h - 1, y + r); k++) m = Math.max(m, tmp[k * w + x]);
            out[y * w + x] = m;
        }
    }
    return out;
}

function boxBlur(src: Uint8Array, w: number, h: number, r: number) {
    const tmp = new Float32Array(src.length);
    const out = new Uint8Array(src.length);
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const a = Math.max(0, x - r);
            const b = Math.min(w - 1, x + r);
            let s = 0;
            for (let k = a; k <= b; k++) s += src[y * w + k];
            tmp[y * w + x] = s / (b - a + 1);
        }
    }
    for (let x = 0; x < w; x++) {
        for (let y = 0; y < h; y++) {
            const a = Math.max(0, y - r);
            const b = Math.min(h - 1, y + r);
            let s = 0;
            for (let k = a; k <= b; k++) s += tmp[k * w + x];
            out[y * w + x] = Math.round(s / (b - a + 1));
        }
    }
    return out;
}

// Rewrites RGBA in place: paper -> transparent, ink keeps its colour, and only the heaviest cluster of
// strokes survives (stamps, table lines, bleed-through elsewhere on the page are dropped).
// Returns the bounding box of what is kept, or null when no ink was found.
export function cutOutPixels(px: Uint8ClampedArray, w: number, h: number) {
    const n = w * h;
    const lum = new Uint8Array(n);
    for (let p = 0; p < n; p++) lum[p] = (0.299 * px[p * 4] + 0.587 * px[p * 4 + 1] + 0.114 * px[p * 4 + 2]) | 0;
    const paper = boxBlur(maxFilter(lum, w, h, PAPER_RADIUS), w, h, PAPER_RADIUS);

    const alpha = new Uint8Array(n);
    const ink = new Uint8Array(n);
    for (let p = 0; p < n; p++) {
        const ratio = lum[p] / Math.max(paper[p], PAPER_FLOOR);
        alpha[p] = Math.round(Math.min(1, Math.max(0, (0.88 - ratio) / 0.33)) * 255);
        ink[p] = alpha[p] >= CLUSTER_ALPHA_MIN ? 1 : 0;
    }

    // Letters of one signature are close together; dilate so they form one cluster, then keep the heaviest.
    // Only strong ink counts here so faint bleed-through from the other side of the page can't bridge clusters.
    const near = maxFilter(ink, w, h, MERGE_RADIUS);
    const label = new Int32Array(n);
    const weight: number[] = [0];
    const stack = new Int32Array(n);
    let best = 0;
    for (let start = 0; start < n; start++) {
        if (!near[start] || label[start]) continue;
        const id = weight.length;
        weight.push(0);
        let top = 0;
        stack[top++] = start;
        label[start] = id;
        while (top > 0) {
            const p = stack[--top];
            if (ink[p]) weight[id] += alpha[p];
            const x = p % w;
            const y = (p - x) / w;
            for (let dy = -1; dy <= 1; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                    const nx = x + dx;
                    const ny = y + dy;
                    if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
                    const q = ny * w + nx;
                    if (near[q] && !label[q]) {
                        label[q] = id;
                        stack[top++] = q;
                    }
                }
            }
        }
        if (weight[id] > weight[best]) best = id;
    }
    if (best === 0) return null;

    let minX = w, minY = h, maxX = -1, maxY = -1;
    for (let p = 0; p < n; p++) {
        const o = p * 4;
        if (label[p] !== best || alpha[p] < 5) {
            px[o + 3] = 0;
            continue;
        }
        const a = alpha[p] / 255;
        const bg = Math.max(paper[p], PAPER_FLOOR);
        // Un-blend the ink colour from the paper so soft edges keep the pen colour.
        for (let c = 0; c < 3; c++) px[o + c] = ((px[o + c] * 255) / bg - 255 * (1 - a)) / a;
        px[o + 3] = alpha[p];
        if (alpha[p] >= INK_ALPHA_MIN) {
            const x = p % w;
            const y = (p - x) / w;
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
        }
    }
    return { minX, minY, maxX, maxY };
}

// Photo/scan of a handwritten signature -> transparent PNG cropped to the strokes (pure base64, no data: prefix).
export async function cutOutSignature(file: File): Promise<string> {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_WIDTH / bitmap.width);
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();

    const image = ctx.getImageData(0, 0, w, h);
    const box = cutOutPixels(image.data, w, h);
    // No ink detected (blank or unusual image): return the untouched picture rather than an empty one.
    if (!box) return toBase64(canvas);
    ctx.putImageData(image, 0, 0);

    const sx = Math.max(0, box.minX - PADDING);
    const sy = Math.max(0, box.minY - PADDING);
    const sw = Math.min(w, box.maxX + PADDING + 1) - sx;
    const sh = Math.min(h, box.maxY + PADDING + 1) - sy;
    const out = document.createElement("canvas");
    out.width = sw;
    out.height = sh;
    out.getContext("2d")!.drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh);

    return toBase64(out);
}

function toBase64(canvas: HTMLCanvasElement) {
    const dataUrl = canvas.toDataURL("image/png");
    return dataUrl.slice(dataUrl.indexOf(",") + 1);
}
