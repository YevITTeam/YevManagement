"use client";

import { useState } from "react";
import { Printer, X } from "lucide-react";
import QRCode from "qrcode";
import { toast } from "react-toastify";
import { DeviceApi } from "@/modules/pc-management/api/device.api";
import type { DeviceQrLabelDto } from "@/modules/pc-management/types/device-qr-label.dto";
import { useFetchEffect } from "@/modules/common/hooks/useFetchEffect";
import { useDialogReset } from "@/modules/common/hooks/useDialogReset";

function escapeHtml(value: string) {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

interface PrintDeviceQrLabelsDialogProps {
    isOpen: boolean;
    deviceIds: number[];
    onClose: () => void;
    // Gọi riêng khi lệnh in đã được kích hoạt thành công (khác onClose — cũng chạy khi người dùng
    // bấm Huỷ/backdrop). Dùng để bên gọi dọn danh sách đã tick chọn sau khi in xong.
    onPrinted?: () => void;
}

// Mã thiết bị + số serial LUÔN hiển thị dạng chữ trên tem (không phải field để chọn) — các field còn
// lại chỉ được NHÉT VÀO nội dung mã QR (hiện ra khi quét bằng điện thoại), không in chữ ra tem.
// "deviceId" KHÔNG phải field để tick (yêu cầu người dùng 2026-08-10) — luôn nhét vào QR sẵn, cùng
// nhóm "luôn có" với deviceCode/serialNumber, xem buildQrPayload. "deviceName" NGƯỢC LẠI vẫn là field
// để tick bình thường (đợt trước lỡ bỏ ra rồi thêm lại đúng ý người dùng).
type QrEncodedFieldKey = "deviceName" | "deviceTypeName" | "branchName" | "supplierName" | "manager" | "statusText" | "purchaseDate";

// Thứ tự đúng như hợp đồng BE mô tả (docs/asset-api-fe.md §5.4b): tên/loại/xưởng/NCC/người dùng/trạng thái/ngày mua.
const FIELD_DEFS: { key: QrEncodedFieldKey; label: string }[] = [
    { key: "deviceName", label: "Tên thiết bị" },
    { key: "deviceTypeName", label: "Loại thiết bị" },
    { key: "branchName", label: "Chi nhánh" },
    { key: "supplierName", label: "Nhà cung cấp" },
    { key: "manager", label: "Người quản lý" },
    { key: "statusText", label: "Trạng thái" },
    { key: "purchaseDate", label: "Ngày mua" },
];

// Mặc định chỉ tích "Tên thiết bị" — deviceCode/serialNumber/deviceId LUÔN có sẵn trong QR (xem
// buildQrPayload), user tự bật thêm field nào cần.
const DEFAULT_ENCODED_FIELDS: QrEncodedFieldKey[] = ["deviceName"];

function formatDate(value: string | null) {
    if (!value) return "-";
    return new Date(value).toLocaleDateString("vi-VN");
}

// Dòng nội dung mã hoá cho 1 field — chỉ dùng để dựng qrPayload (không hiển thị chữ ra tem).
function encodedFieldLine(item: DeviceQrLabelDto, key: QrEncodedFieldKey): string {
    switch (key) {
        case "deviceName":
            return item.deviceName;
        case "deviceTypeName":
            return `Loại: ${item.deviceTypeName}`;
        case "branchName":
            return `Xưởng: ${item.branchName}`;
        case "supplierName":
            return `NCC: ${item.supplierName}`;
        case "manager":
            return `Người dùng: ${item.manager}`;
        case "statusText":
            return `Trạng thái: ${item.statusText}`;
        case "purchaseDate":
            return `Ngày mua: ${formatDate(item.purchaseDate)}`;
    }
}

// FE tự dựng qrPayload: dòng 1 LUÔN là deviceCode (app nội bộ tách dòng 1 để tra cứu), dòng 2 luôn là
// serial (đã in sẵn trên tem nhưng vẫn nhét vào QR để quét đối chiếu), dòng 3 luôn là deviceId (không
// còn field để tick, yêu cầu người dùng 2026-08-10) — các dòng sau là field user chọn thêm (deviceName
// mặc định đã tích sẵn, xem DEFAULT_ENCODED_FIELDS).
function buildQrPayload(item: DeviceQrLabelDto, encodedFields: QrEncodedFieldKey[]) {
    const lines = [
        item.deviceCode,
        `SN: ${item.serialNumber ?? "Không có"}`,
        `ID: ${item.deviceId}`,
        ...encodedFields.map((key) => encodedFieldLine(item, key)),
    ];
    return lines.join("\n");
}

type PrintMode = "a4" | "zebra";

// Khổ decal đúng theo cấu hình đã IN THÀNH CÔNG thực tế trên máy IT phòng (ZebraDesigner
// "test.btw" → Page Setup: Page 10.60 x 3.30cm, 1 hàng x 2 cột, mỗi tem (Item) 5.20 x 3.10cm; driver
// ZDesigner ZD230 khai Custom stock Width 10cm / Height 3cm, Media type "Continuous labels", Rotation
// 0° Portrait). Đây là số đo đã verify được trên máy thật — thay cho ước lượng 4x2in ban đầu (SAI, lấy
// nhầm từ giá trị mặc định của driver chứ chưa phải khổ decal thật). Chốt với người dùng 2026-08-11.
// Nếu đổi khổ decal, sửa các hằng số cm dưới đây.
const ZEBRA_LABELS_PER_ROW = 2;
const ZEBRA_PAGE_WIDTH_CM = 10.6;
const ZEBRA_PAGE_HEIGHT_CM = 3.3;
const ZEBRA_LABEL_WIDTH_CM = 5.2;
const ZEBRA_LABEL_HEIGHT_CM = 3.1;
const ZEBRA_ROW_GAP_CM = ZEBRA_PAGE_WIDTH_CM - ZEBRA_LABEL_WIDTH_CM * ZEBRA_LABELS_PER_ROW;

function buildA4LabelHtml(item: DeviceQrLabelDto, qrDataUrls: Map<number, string> | null) {
    const qrDataUrl = qrDataUrls?.get(item.deviceId);
    const qrHtml = qrDataUrl ? `<img class="qr" src="${qrDataUrl}" alt="QR" />` : "";
    return `
      <div class="label${qrDataUrls ? " with-qr" : ""}">
        ${qrHtml}
        <div class="text">
          <div class="code">${escapeHtml(item.deviceCode)}</div>
          <div class="serial">SN: ${escapeHtml(item.serialNumber ?? "Không có")}</div>
        </div>
      </div>`;
}

// Tem Zebra 5.2 x 3.1cm (bề ngang), đủ chỗ xếp ngang QR trái + chữ phải như người dùng đã chọn ban
// đầu (giả định "gần vuông 2x2in" trước đó là SAI vì đo nhầm khổ tổng — xem hằng số ở trên).
function buildZebraLabelHtml(item: DeviceQrLabelDto, qrDataUrls: Map<number, string> | null) {
    const qrDataUrl = qrDataUrls?.get(item.deviceId);
    const qrHtml = qrDataUrl ? `<img class="qr" src="${qrDataUrl}" alt="QR" />` : "";
    return `
      <div class="label">
        ${qrHtml}
        <div class="text">
          <div class="code">${escapeHtml(item.deviceCode)}</div>
          <div class="serial">SN: ${escapeHtml(item.serialNumber ?? "Không có")}</div>
        </div>
      </div>`;
}

// Zebra in TỪNG LẦN FEED = 1 hàng gồm 2 tem cạnh nhau trên khổ decal cắt sẵn — không có khái niệm
// "nhiều tem/trang" kiểu giấy A4. @page phải khớp CHÍNH XÁC kích thước 1 lần feed (margin 0, mỗi
// hàng 2 tem = 1 page riêng), nếu không driver/trình duyệt sẽ tự co kéo nội dung → lệch, tràn, xoay
// ngang (xem tem in lỗi khi setup ban đầu). Chế độ A4 giữ nguyên layout lưới nhiều cột cũ.
function buildQrPrintHtml(items: DeviceQrLabelDto[], qrDataUrls: Map<number, string> | null, printMode: PrintMode) {
    if (printMode === "zebra") {
        const rows: string[] = [];
        for (let i = 0; i < items.length; i += ZEBRA_LABELS_PER_ROW) {
            const rowItems = items.slice(i, i + ZEBRA_LABELS_PER_ROW);
            rows.push(`<div class="row">${rowItems.map((item) => buildZebraLabelHtml(item, qrDataUrls)).join("")}</div>`);
        }

        return `<!doctype html>
<html lang="vi">
<head>
  <meta charset="utf-8" />
  <title>In tem QR thiết bị</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; font-family: "Times New Roman", Times, Georgia, serif; color: #191c1e; }
    @page { size: ${ZEBRA_PAGE_WIDTH_CM}cm ${ZEBRA_PAGE_HEIGHT_CM}cm; margin: 0; }
    .row {
      display: flex;
      align-items: center;
      /* flex-start (không phải center): hàng đủ 2 tem thì content vừa khít bề rộng trang nên 2 cách
         cho cùng kết quả, nhưng hàng lẻ (chỉ còn 1 tem cuối) phải nằm ở vị trí tem 1 (bên trái) để
         khớp đúng vị trí vật lý của decal trên máy in Zebra — center sẽ đẩy nó ra giữa trang, lệch
         khỏi decal đã cắt sẵn. */
      justify-content: flex-start;
      width: ${ZEBRA_PAGE_WIDTH_CM}cm;
      height: ${ZEBRA_PAGE_HEIGHT_CM}cm;
      gap: ${ZEBRA_ROW_GAP_CM}cm;
      page-break-after: always;
    }
    .row:last-child { page-break-after: auto; }
    .label {
      width: ${ZEBRA_LABEL_WIDTH_CM}cm;
      height: ${ZEBRA_LABEL_HEIGHT_CM}cm;
      padding: 0.15cm 0.2cm;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.2cm;
      text-align: left;
    }
    .qr { width: 1.8cm; height: 1.8cm; flex: none; }
    .text { max-width: 2.8cm; }
    .code { font-size: 14px; font-weight: 700; letter-spacing: 0.3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .serial { font-size: 10px; font-weight: 700; color: #555; margin-top: 3px; line-height: 1.15; white-space: normal; overflow-wrap: anywhere; word-break: break-all; }
  </style>
</head>
<body>
  <div class="sheet">${rows.join("")}</div>
</body>
</html>`;
    }

    const labels = items.map((item) => buildA4LabelHtml(item, qrDataUrls)).join("");

    return `<!doctype html>
<html lang="vi">
<head>
  <meta charset="utf-8" />
  <title>In tem QR thiết bị</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; font-family: Arial, "Segoe UI", sans-serif; color: #191c1e; }
    .sheet { display: grid; grid-template-columns: repeat(${qrDataUrls ? 2 : 3}, 1fr); gap: 8px; padding: 12px; }
    .label {
      border: 1px solid #191c1e;
      border-radius: 6px;
      padding: 10px 12px;
      text-align: center;
      page-break-inside: avoid;
    }
    .label.with-qr { display: flex; align-items: center; gap: 10px; text-align: left; }
    .qr { width: 90px; height: 90px; flex: none; }
    .text { min-width: 0; flex: 1; }
    .code { font-size: 20px; font-weight: 700; letter-spacing: 1px; white-space: nowrap; }
    .serial { font-size: 15px; font-weight: 700; color: #555; margin-top: 2px; white-space: nowrap; }
    @page { margin: 10mm; }
    @media print { .sheet { gap: 6px; } }
  </style>
</head>
<body>
  <div class="sheet">${labels}</div>
</body>
</html>`;
}

// Gọi `printWindow.print()` ngay sau `document.write` bị race với việc trình duyệt decode/paint ảnh
// data URI của mã QR trong cửa sổ MỚI mở → QR in ra trống. Phải đợi mọi <img> load xong (hoặc lỗi) trước.
function waitForImagesToLoad(doc: Document) {
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

export default function PrintDeviceQrLabelsDialog({ isOpen, deviceIds, onClose, onPrinted }: PrintDeviceQrLabelsDialogProps) {
    const [labels, setLabels] = useState<DeviceQrLabelDto[]>([]);
    const [encodedFields, setEncodedFields] = useState<Set<QrEncodedFieldKey>>(new Set(DEFAULT_ENCODED_FIELDS));
    const [includeQr, setIncludeQr] = useState(true);
    const [printMode, setPrintMode] = useState<PrintMode>("zebra");
    const [isPrinting, setIsPrinting] = useState(false);

    useDialogReset(isOpen, null, () => {
        setEncodedFields(new Set(DEFAULT_ENCODED_FIELDS));
        setIncludeQr(true);
        setPrintMode("zebra");
    });

    const idsKey = isOpen ? deviceIds.join(",") : "";
    const { isLoading, error } = useFetchEffect<DeviceQrLabelDto[]>(
        () => (idsKey ? DeviceApi.getQrLabels(deviceIds) : Promise.resolve([])),
        [idsKey],
        (data) => setLabels(data),
        "Không thể tải dữ liệu in tem QR.",
        (message) => toast.error(message),
        "device-qr-labels"
    );

    if (!isOpen) return null;

    const toggleField = (key: QrEncodedFieldKey) => {
        setEncodedFields((current) => {
            const next = new Set(current);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    };

    const handlePrint = async () => {
        if (labels.length === 0) return;
        setIsPrinting(true);
        const orderedFields = FIELD_DEFS.map((field) => field.key).filter((key) => encodedFields.has(key));

        try {
            let qrDataUrls: Map<number, string> | null = null;
            if (includeQr) {
                const entries = await Promise.all(
                    labels.map(async (item) => {
                        const dataUrl = await QRCode.toDataURL(buildQrPayload(item, orderedFields), { margin: 1, width: 320 });
                        return [item.deviceId, dataUrl] as const;
                    })
                );
                qrDataUrls = new Map(entries);
            }

            const printWindow = window.open("", "_blank", "width=900,height=650");
            if (!printWindow) {
                toast.error("Không thể mở cửa sổ in. Vui lòng cho phép cửa sổ bật lên (popup).");
                return;
            }

            printWindow.document.write(buildQrPrintHtml(labels, qrDataUrls, printMode));
            printWindow.document.close();
            await waitForImagesToLoad(printWindow.document);

            let done = false;
            const finish = (success: boolean) => {
                if (done) return;
                done = true;
                if (success) {
                    toast.success(`In thành công ${labels.length} tem thiết bị.`);
                } else {
                    toast.error("In không thành công. Vui lòng thử lại.");
                }
                printWindow.close();
            };
            printWindow.onafterprint = () => finish(true);
            printWindow.focus();
            printWindow.print();
            onPrinted?.();
            onClose();
        } catch (err) {
            console.error(err);
            toast.error("Không thể tạo mã QR để in. Vui lòng thử lại.");
        } finally {
            setIsPrinting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="fixed inset-0 bg-black/40" onClick={onClose} />

            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="print-qr-title"
                className="z-60 mx-4 flex max-h-[85vh] w-full max-w-lg flex-col rounded-xl border border-[#e0e3e5] bg-white shadow-xl"
            >
                <div className="flex items-center justify-between border-b border-[#e0e3e5] p-6 pb-4">
                    <div>
                        <h3 id="print-qr-title" className="text-lg font-semibold text-[#191c1e]">
                            In tem QR thiết bị
                        </h3>
                        <p className="mt-1 text-xs text-[#5e3f3a]">
                            Đã chọn {deviceIds.length} thiết bị. Tem chỉ in chữ Mã thiết bị + Số serial — chọn thêm thông tin muốn nhét vào
                            mã QR (hiện ra khi quét).
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="cursor-pointer text-[#5e3f3a] transition hover:text-[#191c1e]"
                        aria-label="Đóng"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6">
                    {isLoading ? (
                        <div className="py-8 text-center text-sm text-[#5e3f3a]">Đang tải dữ liệu...</div>
                    ) : error ? (
                        <div className="rounded-lg border border-[#e9bcb6] bg-[#fff4f2] px-4 py-3 text-sm text-[#930006]">{error}</div>
                    ) : (
                        <div className="space-y-5">
                            <div>
                                <div className="mb-2 text-sm font-semibold text-[#191c1e]">Khổ in</div>
                                <div className="grid grid-cols-2 gap-2">
                                    <label
                                        className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                                            printMode === "zebra" ? "border-[#e3000f] bg-[#fff4f2] text-[#191c1e]" : "border-[#e0e3e5] text-[#5e3f3a]"
                                        }`}
                                    >
                                        <input
                                            type="radio"
                                            name="print-mode"
                                            checked={printMode === "zebra"}
                                            onChange={() => setPrintMode("zebra")}
                                            className="h-4 w-4 cursor-pointer accent-[#e3000f]"
                                        />
                                        Máy in tem Zebra (mỗi tem {ZEBRA_LABEL_WIDTH_CM}×{ZEBRA_LABEL_HEIGHT_CM}cm, {ZEBRA_LABELS_PER_ROW} tem/lần in)
                                    </label>
                                    <label
                                        className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                                            printMode === "a4" ? "border-[#e3000f] bg-[#fff4f2] text-[#191c1e]" : "border-[#e0e3e5] text-[#5e3f3a]"
                                        }`}
                                    >
                                        <input
                                            type="radio"
                                            name="print-mode"
                                            checked={printMode === "a4"}
                                            onChange={() => setPrintMode("a4")}
                                            className="h-4 w-4 cursor-pointer accent-[#e3000f]"
                                        />
                                        Giấy A4 (nhiều tem/trang)
                                    </label>
                                </div>
                            </div>

                            <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-[#191c1e]">
                                <input
                                    type="checkbox"
                                    checked={includeQr}
                                    onChange={(event) => setIncludeQr(event.target.checked)}
                                    className="h-4 w-4 cursor-pointer accent-[#e3000f]"
                                />
                                Kèm mã QR trên tem
                            </label>

                            <div className={includeQr ? "" : "pointer-events-none opacity-40"}>
                                <div className="mb-2 text-sm font-semibold text-[#191c1e]">Thông tin nhét vào mã QR (không in chữ ra tem)</div>
                                <div className="grid grid-cols-2 gap-2">
                                    {FIELD_DEFS.map((field) => (
                                        <label key={field.key} className="flex cursor-pointer items-center gap-2 text-sm text-[#191c1e]">
                                            <input
                                                type="checkbox"
                                                checked={encodedFields.has(field.key)}
                                                onChange={() => toggleField(field.key)}
                                                disabled={!includeQr}
                                                className="h-4 w-4 cursor-pointer accent-[#e3000f]"
                                            />
                                            {field.label}
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex justify-end gap-3 border-t border-[#e0e3e5] p-4">
                    <button
                        type="button"
                        onClick={onClose}
                        className="cursor-pointer rounded-lg border border-[#e0e3e5] bg-white px-4 py-2 text-sm font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6]"
                    >
                        Huỷ
                    </button>
                    <button
                        type="button"
                        onClick={handlePrint}
                        disabled={isLoading || !!error || labels.length === 0 || isPrinting}
                        className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-[#e3000f] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#b40009] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {isPrinting ? (
                            "Đang tạo mã QR..."
                        ) : (
                            <>
                                <Printer className="h-4 w-4" /> In ({labels.length})
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
