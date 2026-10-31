import JSZip from "jszip";
import { toUnicode } from "vietnamese-conversion";

const WORDML_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";

// toUnicode('vni') fails to compose horn vowels with tone marks; each entry was verified against toVNI().
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

// VNI fonts aren't embedded in the .docx and browsers don't have them, so swap to a common font of the
// same family; otherwise the browser picks an unpredictable fallback.
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

// Scoped to runs declaring a VNI font: documents can mix correct Unicode runs that a global pass would corrupt.
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

        // Also rename the font, otherwise the browser's own fallback is what renders.
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
