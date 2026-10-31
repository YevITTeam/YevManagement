import { PAGE_SPECS, type PaperSize } from "./otFormPrintTemplate";

// Converts the otFormPrintTemplate HTML into vector PDF with pdfmake, entirely in the browser.
// pdfmake (~1 MB) and the fonts (~2.8 MB) load on the first export only and stay cached for the session.

// Noto Serif JP covers Vietnamese, Japanese and ✓ in one face; the bold file is Latin/Vietnamese only (Japanese is never bold).
const FONT_FILES = { normal: "/fonts/NotoSerifJP-Regular.subset.otf", bold: "/fonts/NotoSerifJP-Bold.latin.otf" };
const FONT_NAME = "NotoSerifJP";
const CJK = /[　-ヿ㐀-鿿＀-￯]/;

type PdfNode = Record<string, unknown>;
type HtmlToPdfmake = (html: string, options: Record<string, unknown>) => PdfNode | PdfNode[];

interface PdfMake {
    addVirtualFileSystem(vfs: Record<string, string>): void;
    addFonts(fonts: Record<string, Record<string, string>>): void;
    createPdf(doc: PdfNode): { getBlob(): Promise<Blob> };
}

const LINE = 0.6;
const PAD_X = 3;
const PAD_Y = 1;
const GRID_LAYOUT = {
    hLineWidth: () => LINE,
    vLineWidth: () => LINE,
    paddingLeft: () => PAD_X,
    paddingRight: () => PAD_X,
    paddingTop: () => PAD_Y,
    paddingBottom: () => PAD_Y,
};
const PLAIN_LAYOUT = {
    hLineWidth: () => 0,
    vLineWidth: () => 0,
    paddingLeft: () => 0,
    paddingRight: () => 0,
    paddingTop: () => 0,
    paddingBottom: () => 0,
};

// Browser-only markup: pdfmake gets column widths from data-pdfmake instead.
function stripColgroups(html: string) {
    return html.replace(/<colgroup>.*?<\/colgroup>/g, "");
}

// Fills in what HTML can't express for pdfmake: table line/padding layouts, vertical alignment, no-bold Japanese.
function normalize(node: unknown): void {
    if (Array.isArray(node)) {
        node.forEach(normalize);
        return;
    }
    if (!node || typeof node !== "object") return;
    const n = node as PdfNode;
    if ("verticalAlign" in n) {
        n.verticalAlignment = n.verticalAlign;
        delete n.verticalAlign;
    }
    if (n.table) {
        const table = n.table as { body: unknown; widths?: unknown[]; heights?: unknown[] };
        const isGrid = n.layout !== "noBorders";
        n.layout = isGrid ? GRID_LAYOUT : PLAIN_LAYOUT;
        // The template gives outer cell sizes (as the browser draws them); pdfmake adds padding and lines on top.
        if (isGrid) {
            table.widths = table.widths?.map((w) => (typeof w === "number" ? Math.max(1, w - 2 * PAD_X - LINE) : w));
            table.heights = table.heights?.map((h) => (typeof h === "number" ? Math.max(1, h - 2 * PAD_Y - LINE) : h));
        }
        normalize(table.body);
    }
    if (typeof n.text === "string" && CJK.test(n.text)) n.bold = false;
    for (const key of ["text", "stack", "columns"]) {
        if (Array.isArray(n[key])) normalize(n[key]);
    }
}

export function buildDocDefinition(pages: string[], paperSize: PaperSize, htmlToPdfmake: HtmlToPdfmake, extraOptions: Record<string, unknown> = {}) {
    const spec = PAGE_SPECS[paperSize];
    const content = pages.map((html, index) => {
        const converted = htmlToPdfmake(stripColgroups(html), {
            removeExtraBlanks: true,
            ignoreStyles: ["font-family"],
            defaultStyles: { p: null, table: null, th: null },
            ...extraOptions,
        });
        return { stack: Array.isArray(converted) ? converted : [converted], ...(index > 0 ? { pageBreak: "before" } : {}) };
    });
    normalize(content);
    return {
        pageSize: { width: spec.widthPt, height: spec.heightPt },
        pageMargins: spec.marginsPt,
        content,
        defaultStyle: { font: FONT_NAME, fontSize: 9, lineHeight: 1.05 },
    };
}

async function fetchBase64(url: string) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Không tải được font ${url}`);
    const blob = await response.blob();
    // FileReader encodes natively; a JS loop over a few MB would block the UI.
    return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
    });
}

let enginePromise: Promise<{ pdfMake: PdfMake; htmlToPdfmake: HtmlToPdfmake }> | null = null;

function loadEngine() {
    enginePromise ??= (async () => {
        const [pdfMakeModule, htmlModule, regular, bold] = await Promise.all([
            import("pdfmake/build/pdfmake"),
            import("html-to-pdfmake"),
            fetchBase64(FONT_FILES.normal),
            fetchBase64(FONT_FILES.bold),
        ]);
        const pdfMake = (pdfMakeModule.default ?? pdfMakeModule) as unknown as PdfMake;
        pdfMake.addVirtualFileSystem({ "regular.otf": regular, "bold.otf": bold });
        pdfMake.addFonts({ [FONT_NAME]: { normal: "regular.otf", bold: "bold.otf", italics: "regular.otf", bolditalics: "bold.otf" } });
        const htmlToPdfmake = (htmlModule.default ?? htmlModule) as unknown as HtmlToPdfmake;
        return { pdfMake, htmlToPdfmake };
    })().catch((error) => {
        enginePromise = null;
        throw error;
    });
    return enginePromise;
}

export async function renderPagesToPdfBlob(pages: string[], paperSize: PaperSize): Promise<Blob> {
    const { pdfMake, htmlToPdfmake } = await loadEngine();
    return pdfMake.createPdf(buildDocDefinition(pages, paperSize, htmlToPdfmake)).getBlob();
}
