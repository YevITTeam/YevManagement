// Server-side twin of the "Xuất PDF" button: same template, run by Node for the General Affairs mail
// (GeneralAffairsReportService). Reads {limits, forms} JSON on stdin, writes one base64 PDF per line to stdout.
// No files on disk: writing PDFs then zipping and deleting them trips Trend Micro's ransomware guard.
import path from "node:path";
import { JSDOM } from "jsdom";
import htmlToPdfmake from "html-to-pdfmake";
import pdfmake from "pdfmake";
import { renderOtFormPages } from "../../src/modules/attendance/lib/otFormPrintTemplate";
import { buildDocDefinition } from "../../src/modules/attendance/lib/otFormPdf";

const fontDir = path.join(__dirname, "fonts");
const regular = path.join(fontDir, "NotoSerifJP-Regular.subset.otf");
const bold = path.join(fontDir, "NotoSerifJP-Bold.latin.otf");
pdfmake.addFonts({ NotoSerifJP: { normal: regular, bold, italics: regular, bolditalics: bold } });
// Signatures are inline base64, so nothing may be fetched or read besides the fonts.
pdfmake.setUrlAccessPolicy(() => false);
pdfmake.setLocalAccessPolicy((filePath) => path.resolve(filePath).startsWith(fontDir));

// html-to-pdfmake needs a DOM to parse the template HTML.
const { window } = new JSDOM("");

(async () => {
    const chunks = [];
    for await (const chunk of process.stdin) chunks.push(chunk);
    const { limits, forms } = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    for (const form of forms) {
        const doc = buildDocDefinition(renderOtFormPages(form, "a4", limits), "a4", htmlToPdfmake, { window });
        process.stdout.write((await pdfmake.createPdf(doc).getBuffer()).toString("base64") + "\n");
    }
})().catch((error) => {
    console.error(error);
    process.exit(1);
});
