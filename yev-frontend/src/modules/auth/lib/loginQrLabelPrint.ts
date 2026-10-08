import QRCode from "qrcode";
import { toast } from "react-toastify";
import type { LoginQrGeneratedDto } from "@/modules/auth/types/auth.dto";
import {
    ZEBRA_LABELS_PER_ROW,
    ZEBRA_LABEL_HEIGHT_CM,
    ZEBRA_LABEL_WIDTH_CM,
    ZEBRA_PAGE_HEIGHT_CM,
    ZEBRA_PAGE_WIDTH_CM,
    ZEBRA_ROW_GAP_CM,
    escapeHtml,
    waitForImagesToLoad,
} from "@/modules/common/lib/zebraLabel";

function buildHtml(items: LoginQrGeneratedDto[], qrDataUrls: string[]) {
    const labels = items.map(
        (item, index) => `
      <div class="label">
        <img class="qr" src="${qrDataUrls[index]}" alt="QR" />
        <div class="name">${escapeHtml(item.fullName || item.userName)}</div>
      </div>`
    );

    const rows: string[] = [];
    for (let i = 0; i < labels.length; i += ZEBRA_LABELS_PER_ROW) {
        rows.push(`<div class="row">${labels.slice(i, i + ZEBRA_LABELS_PER_ROW).join("")}</div>`);
    }

    return `<!doctype html>
<html lang="vi">
<head>
  <meta charset="utf-8" />
  <title>In tem QR đăng nhập</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; font-family: "Times New Roman", Times, Georgia, serif; color: #000; }
    @page { size: ${ZEBRA_PAGE_WIDTH_CM}cm ${ZEBRA_PAGE_HEIGHT_CM}cm; margin: 0; }
    .row { display: flex; align-items: center; justify-content: flex-start; width: ${ZEBRA_PAGE_WIDTH_CM}cm; height: ${ZEBRA_PAGE_HEIGHT_CM}cm; gap: ${ZEBRA_ROW_GAP_CM}cm; page-break-after: always; }
    .row:last-child { page-break-after: auto; }
    .label { width: ${ZEBRA_LABEL_WIDTH_CM}cm; height: ${ZEBRA_LABEL_HEIGHT_CM}cm; padding: 0.15cm 0.2cm; display: flex; align-items: center; justify-content: center; gap: 0.2cm; }
    .qr { width: 2.4cm; height: 2.4cm; flex: none; image-rendering: pixelated; }
    .name { max-width: 2.1cm; font-size: 13px; font-weight: 700; line-height: 1.2; overflow-wrap: anywhere; display: -webkit-box; -webkit-line-clamp: 5; -webkit-box-orient: vertical; overflow: hidden; }
  </style>
</head>
<body>${rows.join("")}</body>
</html>`;
}

// The window must be opened synchronously from the click (before any await) or the popup blocker stops it.
export function openLabelWindow(): Window | null {
    const printWindow = window.open("", "_blank", "width=900,height=650");
    if (!printWindow) toast.error("Không thể mở cửa sổ in. Vui lòng cho phép cửa sổ bật lên (popup).");
    return printWindow;
}

export async function printLoginQrLabels(printWindow: Window, items: LoginQrGeneratedDto[]) {
    const qrDataUrls = await Promise.all(
        items.map((item) => QRCode.toDataURL(item.qrPayload, { margin: 1, width: 400, errorCorrectionLevel: "M" }))
    );

    printWindow.document.open();
    printWindow.document.write(buildHtml(items, qrDataUrls));
    printWindow.document.close();
    await waitForImagesToLoad(printWindow.document);
    printWindow.onafterprint = () => printWindow.close();
    printWindow.focus();
    printWindow.print();
}
