import JSZip from "jszip";
import { toUnicode } from "vietnamese-conversion";

const WORDML_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";

// vietnamese-conversion's toUnicode('vni') correctly decodes the legacy
// VNI-Times/VNI-Helve-Condense 8-bit Vietnamese font encoding EXCEPT for one
// characterized bug: horn vowels (ơ/ư) combined with any tone mark fail to
// fully compose (e.g. raw bytes for "giờ" decode to "giơø" instead of "giờ").
// This table was derived and verified empirically against the library's own
// toVNI() as ground truth, and cross-checked against real sentences from a
// sample document — every one of these 20 entries is a confirmed fix.
const VNI_HORN_TONE_FIXUPS: Record<string, string> = {
    "ơù": "ớ", "ơø": "ờ", "ơû": "ở", "ơõ": "ỡ", "ơï": "ợ",
    "ƠÙ": "Ớ", "ƠØ": "Ờ", "ƠÛ": "Ở", "ƠÕ": "Ỡ", "ƠÏ": "Ợ",
    "ưù": "ứ", "ưø": "ừ", "ưû": "ử", "ưõ": "ữ", "ưï": "ự",
    "ƯÙ": "Ứ", "ƯØ": "Ừ", "ƯÛ": "Ử", "ƯÕ": "Ữ", "ƯÏ": "Ự",
};

export function applyVniFix(text: string): string {
    let result = toUnicode(text, "vni");
    for (const [bad, good] of Object.entries(VNI_HORN_TONE_FIXUPS)) {
        result = result.split(bad).join(good);
    }
    return result;
}

// Real YEV OT_Form.docx (docs/OT_Form.docx) has no embedded font file for VNI-Times/
// VNI-Helve-Condense (word/fontTable.xml declares them by name only, w:family="auto") — the
// document only ever rendered correctly on a machine that had these legacy 8-bit fonts installed
// locally. A browser never has them, so even AFTER the text bytes are fixed to real Unicode,
// docx-preview still emits `font-family: 'VNI-Times'`/`'VNI-Helve-Condense'` for that run and the
// browser falls back to an unpredictable substitute — this is the actual "font lỗi" users see on
// dense sections (e.g. the employee list table), not a text-decoding bug. Map to a normal
// Unicode-safe font every browser has, matching serif/sans-serif family of the original.
function replacementFontFor(vniFontName: string): string {
    if (/^VNI-Helve/i.test(vniFontName)) return "Arial";
    return "Times New Roman";
}

function setFontAttr(el: Element, localName: "ascii" | "hAnsi", value: string) {
    if (el.getAttributeNS(WORDML_NS, localName) !== null) {
        el.setAttributeNS(WORDML_NS, `w:${localName}`, value);
    } else if (el.hasAttribute(`w:${localName}`)) {
        el.setAttribute(`w:${localName}`, value);
    }
}

export interface FixVniDocxResult {
    blob: Blob;
    convertedCount: number;
}

// Fixes legacy VNI-Times/VNI-Helve-Condense encoded Vietnamese text found in
// an uploaded .docx, scoped to only the runs that actually declare one of
// those fonts (some documents mix genuinely-correct Unicode runs alongside
// legacy-encoded ones, so a document-wide pass would corrupt the good text).
export async function fixVniDocx(file: File): Promise<FixVniDocxResult> {
    const buffer = await file.arrayBuffer();

    let zip: JSZip;
    try {
        zip = await JSZip.loadAsync(buffer);
    } catch {
        return { blob: new Blob([buffer]), convertedCount: 0 };
    }

    const documentXmlFile = zip.file("word/document.xml");
    if (!documentXmlFile) {
        return { blob: new Blob([buffer]), convertedCount: 0 };
    }

    const xmlText = await documentXmlFile.async("string");
    const xmlDoc = new DOMParser().parseFromString(xmlText, "application/xml");
    if (xmlDoc.getElementsByTagName("parsererror").length > 0) {
        return { blob: new Blob([buffer]), convertedCount: 0 };
    }

    let convertedCount = 0;
    let didMutateFonts = false;
    const runs = Array.from(xmlDoc.getElementsByTagNameNS(WORDML_NS, "r"));

    for (const run of runs) {
        const rPr = run.getElementsByTagNameNS(WORDML_NS, "rPr")[0];
        const rFonts = rPr?.getElementsByTagNameNS(WORDML_NS, "rFonts")[0];
        if (!rFonts) continue;

        const ascii = rFonts.getAttributeNS(WORDML_NS, "ascii") ?? rFonts.getAttribute("w:ascii");
        const hAnsi = rFonts.getAttributeNS(WORDML_NS, "hAnsi") ?? rFonts.getAttribute("w:hAnsi");
        const isVniFont = /^VNI-/i.test(ascii ?? "") || /^VNI-/i.test(hAnsi ?? "");
        if (!isVniFont) continue;

        const textNodes = run.getElementsByTagNameNS(WORDML_NS, "t");
        for (const textNode of Array.from(textNodes)) {
            const original = textNode.textContent ?? "";
            if (!original) continue;
            const fixed = applyVniFix(original);
            if (fixed !== original) {
                textNode.textContent = fixed;
                convertedCount += 1;
            }
        }

        // Text is fixed above, but the font NAME itself must also stop pointing at a legacy font
        // no browser has — otherwise the browser's own fallback choice is what actually renders,
        // not a real decision we made (see comment on replacementFontFor above).
        if (ascii && /^VNI-/i.test(ascii)) {
            setFontAttr(rFonts, "ascii", replacementFontFor(ascii));
            didMutateFonts = true;
        }
        if (hAnsi && /^VNI-/i.test(hAnsi)) {
            setFontAttr(rFonts, "hAnsi", replacementFontFor(hAnsi));
            didMutateFonts = true;
        }
    }

    if (convertedCount === 0 && !didMutateFonts) {
        return { blob: new Blob([buffer]), convertedCount: 0 };
    }

    const serialized = new XMLSerializer().serializeToString(xmlDoc);
    zip.file("word/document.xml", serialized);
    const blob = await zip.generateAsync({ type: "blob" });
    return { blob, convertedCount };
}
