"use client";

import jsPDF from "jspdf";
import JSZip from "jszip";

import { OtFormApi } from "@/modules/attendance/api/ot-form.api";
import { AttendanceSettingApi } from "@/modules/attendance/api/attendance-setting.api";
import { ROBOTO_REGULAR_BASE64, ROBOTO_BOLD_BASE64 } from "@/modules/pc-management/lib/pdf-fonts";
import type { OtFormDto } from "@/modules/attendance/types/ot-form.dto";
import type { AttendanceSettingDto } from "@/modules/attendance/types/attendance-setting.dto";
import type { ProductionTicketBatchGroupDto } from "@/modules/attendance/types/production-ot-report.dto";
import {
    HEADER_LAYOUTS,
    A4_PAGE1_EMPLOYEE,
    A4_PAGE2_EMPLOYEE,
    buildEmployeePages,
    columnBox,
    findHistory,
    findStepByTerminalLevel,
    formatDate,
    formatDateTime,
    formatTime,
    getGivenName,
    getProductionCongDoanLabel,
    REASON_BASE_FONT_PT,
    REASON_JP_RATIO,
    REASON_LINE_HEIGHT,
    REASON_MIN_SCALE,
    REASON_SCALE_STEP,
    type EmployeePageLayout,
    type FieldBox,
    type SignatureDisplay,
} from "@/modules/attendance/components/ot-form/OtFormPrintView";

// Xuất hàng loạt "Phiếu đề nghị làm ngoài giờ" (mẫu YEV-22-024) theo Line/Nhóm/ngày, đóng gói zip
// (2026-09-03c). Lần đầu (2026-09-03c/e/f/g) tái dùng layout React của OtFormPrintView.tsx rồi render
// off-screen + chụp qua html2canvas — html2canvas không tính đúng nhiều thứ (overflow:hidden không cắt
// được chữ tràn, alignItems:center/table-cell canh giữa dọc sai, lệch tỷ lệ tích luỹ theo chiều dọc do
// aspect-ratio CSS) khiến vá đi vá lại vẫn còn lỗi hiển thị. 2026-09-03h: BỎ HẲN html2canvas, tự VẼ TRỰC
// TIẾP bằng jsPDF (chữ thật, ảnh nền qua addImage, không qua DOM/CSS/canvas trung gian nào cả) — vẫn
// TÁI DÙNG đúng toạ độ % + logic nghiệp vụ (field nào hiện giá trị gì) từ OtFormPrintView.tsx qua các
// hàm/hằng số export thêm (formatTime/formatDate/formatDateTime/findHistory/findStepByTerminalLevel/
// getGivenName/getProductionCongDoanLabel/columnBox/HEADER_LAYOUTS/A4_PAGE*_EMPLOYEE/REASON_*) — CHỈ đổi
// cách "vẽ ra" (jsPDF text/line/image thay vì React DOM + html2canvas), không chép lại business logic.
const PAGE_PT_WIDTH = 612;
const PAGE_PT_HEIGHT = 792;
const AUTOFIT_MIN_SCALE = 0.55;
const AUTOFIT_SCALE_STEP = 0.3; // pt, bước giảm khi tự co chữ 1 dòng (đơn vị pt, không phải tỉ lệ)

function registerVietnameseFont(doc: jsPDF) {
    doc.addFileToVFS("Roboto-Regular.ttf", ROBOTO_REGULAR_BASE64);
    doc.addFont("Roboto-Regular.ttf", "Roboto", "normal");
    doc.addFileToVFS("Roboto-Bold.ttf", ROBOTO_BOLD_BASE64);
    doc.addFont("Roboto-Bold.ttf", "Roboto", "bold");
    doc.setFont("Roboto", "normal");
}

function boxRectPt(box: FieldBox) {
    return {
        x: (box.left / 100) * PAGE_PT_WIDTH,
        y: (box.top / 100) * PAGE_PT_HEIGHT,
        w: (box.width / 100) * PAGE_PT_WIDTH,
        h: (box.height / 100) * PAGE_PT_HEIGHT,
    };
}

const imageCache = new Map<string, HTMLImageElement>();
function loadImage(src: string): Promise<HTMLImageElement> {
    const cached = imageCache.get(src);
    if (cached) return Promise.resolve(cached);
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            imageCache.set(src, img);
            resolve(img);
        };
        img.onerror = () => reject(new Error(`Không tải được ảnh nền ${src}`));
        img.src = src;
    });
}

function sanitizeFileNamePart(value: string) {
    return value.replace(/[\\/:*?"<>|]/g, "_");
}

// Đè 1 dòng chữ, canh giữa dọc + tự co cỡ chữ theo bề rộng ô (dùng chính doc.getTextWidth của jsPDF để
// đo — cùng engine sẽ vẽ ra, không còn lệch như đo DOM/canvas xấp xỉ trước đây).
function drawAutoFitText(
    doc: jsPDF,
    box: FieldBox,
    text: string,
    basePt: number,
    opts: { align?: "left" | "center"; bold?: boolean; color?: [number, number, number]; padLeftPt?: number; underline?: boolean } = {}
) {
    if (!text) return;
    const rect = boxRectPt(box);
    const padLeft = opts.padLeftPt ?? (opts.align === "center" ? 0 : 2);
    const maxWidth = Math.max(4, rect.w - padLeft - 1);

    doc.setFont("Roboto", opts.bold ? "bold" : "normal");
    let size = basePt;
    doc.setFontSize(size);
    while (doc.getTextWidth(text) > maxWidth && size > basePt * AUTOFIT_MIN_SCALE) {
        size = Math.max(basePt * AUTOFIT_MIN_SCALE, size - AUTOFIT_SCALE_STEP);
        doc.setFontSize(size);
    }

    const color = opts.color ?? [0, 0, 0];
    doc.setTextColor(...color);
    const x = opts.align === "center" ? rect.x + rect.w / 2 : rect.x + padLeft;
    const y = rect.y + rect.h / 2;
    doc.text(text, x, y, { align: opts.align === "center" ? "center" : "left", baseline: "middle" });

    if (opts.underline) {
        const textWidth = doc.getTextWidth(text);
        const lineY = y + size * 0.32;
        const lineX = opts.align === "center" ? x - textWidth / 2 : x;
        doc.setDrawColor(...color);
        doc.setLineWidth(0.6);
        doc.line(lineX, lineY, lineX + textWidth, lineY);
    }
    doc.setTextColor(0, 0, 0);
}

// Đè 2 dòng lý do (VN + bản dịch JP), cho ngắt dòng thật rồi tự co cỡ chữ tới khi vừa khít chiều cao ô —
// mirror ReasonAutoFit (OtFormPrintView.tsx) nhưng đo/vẽ CÙNG 1 engine (jsPDF), không còn khoảng lệch
// giữa "đo" và "vẽ" như bản DOM/canvas cũ.
function drawReason(doc: jsPDF, box: FieldBox, vnText: string, jpText: string) {
    const rect = boxRectPt(box);
    const padLeft = 3;
    const maxWidth = Math.max(4, rect.w - padLeft - 2);

    function measure(scale: number) {
        const vnSize = REASON_BASE_FONT_PT * scale;
        const jpSize = REASON_BASE_FONT_PT * REASON_JP_RATIO * scale;
        doc.setFont("Roboto", "normal");
        doc.setFontSize(vnSize);
        const vnLines: string[] = doc.splitTextToSize(vnText, maxWidth);
        let jpLines: string[] = [];
        if (jpText) {
            doc.setFontSize(jpSize);
            jpLines = doc.splitTextToSize(jpText, maxWidth);
        }
        const totalHeight = vnLines.length * vnSize * REASON_LINE_HEIGHT + jpLines.length * jpSize * REASON_LINE_HEIGHT;
        return { vnLines, jpLines, vnSize, jpSize, totalHeight };
    }

    let scale = 1;
    let result = measure(scale);
    while (result.totalHeight > rect.h && scale > REASON_MIN_SCALE) {
        scale = Math.max(REASON_MIN_SCALE, scale - REASON_SCALE_STEP);
        result = measure(scale);
    }

    doc.setTextColor(0, 0, 0);
    let cursorY = rect.y + result.vnSize * 0.85;
    doc.setFont("Roboto", "normal");
    doc.setFontSize(result.vnSize);
    for (const line of result.vnLines) {
        doc.text(line, rect.x + padLeft, cursorY);
        cursorY += result.vnSize * REASON_LINE_HEIGHT;
    }
    if (result.jpLines.length > 0) {
        doc.setFontSize(result.jpSize);
        for (const line of result.jpLines) {
            doc.text(line, rect.x + padLeft, cursorY);
            cursorY += result.jpSize * REASON_LINE_HEIGHT;
        }
    }
}

// Vẽ dấu "✓" bằng 2 đoạn thẳng thay vì ký tự Unicode — font Roboto nhúng (registerVietnameseFont)
// không chắc có glyph U+2713 (khối Dingbats, ngoài phạm vi subset thường dùng), vẽ tay để không phụ
// thuộc font có hỗ trợ ký tự này hay không.
function drawCheckMark(doc: jsPDF, box: FieldBox) {
    const rect = boxRectPt(box);
    const cx = rect.x + rect.w / 2;
    const cy = rect.y + rect.h / 2;
    const size = Math.min(rect.w, rect.h) * 0.6;
    const x1 = cx - size * 0.32;
    const y1 = cy + size * 0.02;
    const x2 = cx - size * 0.06;
    const y2 = cy + size * 0.24;
    const x3 = cx + size * 0.34;
    const y3 = cy - size * 0.28;
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(1.3);
    doc.line(x1, y1, x2, y2);
    doc.line(x2, y2, x3, y3);
}

async function getImageNaturalSize(dataUrl: string): Promise<{ width: number; height: number }> {
    const img = new Image();
    img.src = dataUrl;
    await img.decode();
    return { width: img.naturalWidth || 1, height: img.naturalHeight || 1 };
}

// 1 ô chữ ký (ảnh chữ ký nếu có + tên + thời gian ký) — mirror SignatureCell (OtFormPrintView.tsx).
// Async vì cần load ảnh chữ ký (base64) để lấy đúng tỉ lệ thật trước khi addImage (object-contain).
async function drawSignatureCell(doc: jsPDF, box: FieldBox, history: SignatureDisplay | null, nameOnly: boolean) {
    if (!history) return;
    const rect = boxRectPt(box);
    const displayName = history.approverFullName ?? history.approverUserName;
    const signedAt = formatDateTime(history.actionAt);

    const bottomStripRatio = signedAt ? 0.14 : 0;
    const nameRatio = 0.3;
    const imgAreaH = rect.h * (1 - bottomStripRatio - nameRatio);
    const nameAreaH = rect.h * nameRatio;
    const bottomStripH = rect.h * bottomStripRatio;

    if (history.hasSignature && history.signatureImage) {
        const trimmed = history.signatureImage.trim();
        const isJpeg = trimmed.startsWith("/9j/") || trimmed.startsWith("/9j");
        const format = isJpeg ? "JPEG" : "PNG";
        const mime = isJpeg ? "image/jpeg" : "image/png";
        const dataUrl = `data:${mime};base64,${trimmed}`;
        try {
            const size = await getImageNaturalSize(dataUrl);
            const maxW = rect.w * 0.92;
            const maxH = imgAreaH * 0.92;
            const scale = Math.min(maxW / size.width, maxH / size.height);
            const w = size.width * scale;
            const h = size.height * scale;
            const x = rect.x + (rect.w - w) / 2;
            const y = rect.y + (imgAreaH - h) / 2;
            doc.addImage(dataUrl, format, x, y, w, h);
        } catch {
            // Ảnh chữ ký lỗi/không decode được — bỏ qua, vẫn in tên bên dưới.
        }
    }

    const onBehalfName = history.onBehalfOfFullName ?? history.onBehalfOfUserName;
    const onBehalfText = onBehalfName ? `(thay mặt ${nameOnly ? getGivenName(onBehalfName) : onBehalfName})` : null;
    const nameLineH = onBehalfText ? nameAreaH * 0.55 : nameAreaH;

    const nameText = nameOnly ? getGivenName(displayName) : displayName;
    if (nameText) {
        drawAutoFitText(
            doc,
            { left: box.left, top: box.top + (imgAreaH / PAGE_PT_HEIGHT) * 100, width: box.width, height: (nameLineH / PAGE_PT_HEIGHT) * 100 },
            nameText,
            7,
            { align: "center" }
        );
    }

    if (onBehalfText) {
        drawAutoFitText(
            doc,
            { left: box.left, top: box.top + ((imgAreaH + nameLineH) / PAGE_PT_HEIGHT) * 100, width: box.width, height: ((nameAreaH - nameLineH) / PAGE_PT_HEIGHT) * 100 },
            onBehalfText,
            5.5,
            { align: "center" }
        );
    }

    if (signedAt) {
        drawAutoFitText(
            doc,
            { left: box.left, top: box.top + ((imgAreaH + nameAreaH) / PAGE_PT_HEIGHT) * 100, width: box.width, height: (bottomStripH / PAGE_PT_HEIGHT) * 100 },
            signedAt,
            5.5,
            { align: "center" }
        );
    }
}

async function drawFormHeader(doc: jsPDF, form: OtFormDto) {
    const layout = HEADER_LAYOUTS.a4;

    for (const { level, box } of layout.signature) {
        const step = findStepByTerminalLevel(form, level);
        const history = step ? findHistory(form.approvalHistories, step.stepOrder) : null;
        await drawSignatureCell(doc, box, history, false);
    }

    const intermediateSteps = form.approvalSteps.filter((s) => s.terminalLevelSnapshot === 0 && s.requiresSignatureSnapshot);
    const firstIntermediate = intermediateSteps[0];
    const lastIntermediate = intermediateSteps[intermediateSteps.length - 1];
    const selfSignDisplay: SignatureDisplay | null = form.creatorSignatureImage
        ? {
              approverFullName: form.createdByFullName,
              approverUserName: form.createdByUserName,
              hasSignature: true,
              signatureImage: form.creatorSignatureImage,
              actionAt: form.createdAt,
          }
        : null;

    const isSingleRequester = intermediateSteps.length <= 1;
    const firstBox = layout.requester.find((r) => r.slot === "first")!.box;
    const lastBox = layout.requester.find((r) => r.slot === "last")!.box;
    const effectiveLastStep = isSingleRequester ? undefined : lastIntermediate;
    const firstDisplay = firstIntermediate
        ? findHistory(form.approvalHistories, firstIntermediate.stepOrder)
        : intermediateSteps.length === 0
        ? selfSignDisplay
        : null;
    const lastDisplay = effectiveLastStep ? findHistory(form.approvalHistories, effectiveLastStep.stepOrder) : null;

    if (isSingleRequester) {
        const mergedBox: FieldBox = { ...firstBox, width: lastBox.left + lastBox.width - firstBox.left };
        await drawSignatureCell(doc, mergedBox, firstDisplay, false);
    } else {
        await drawSignatureCell(doc, firstBox, firstDisplay, true);
        await drawSignatureCell(doc, lastBox, lastDisplay, true);
        const rect = boxRectPt(firstBox);
        doc.setDrawColor(0, 0, 0);
        doc.setLineWidth(0.5);
        doc.line(rect.x + rect.w, rect.y, rect.x + rect.w, rect.y + rect.h);
    }

    const responsibleStep = form.approvalSteps.find((s) => s.isResponsibleSnapshot);
    const responsibleHistory = responsibleStep ? findHistory(form.approvalHistories, responsibleStep.stepOrder) : null;
    const nguoiChiuTrachNhiemName =
        responsibleHistory?.approverFullName ?? responsibleHistory?.approverUserName ?? form.createdByFullName ?? form.createdByUserName ?? "";

    drawAutoFitText(
        doc,
        layout.tenCongDoan,
        form.isProductionForm ? getProductionCongDoanLabel(form) : `${form.departmentNameVn} — ${form.groupNameVn}`,
        9
    );
    drawAutoFitText(doc, layout.soLuongNhanVien, String(form.numberOfEmployee), 9);
    drawAutoFitText(doc, layout.nguoiChiuTrachNhiem, nguoiChiuTrachNhiemName, 9);
    drawAutoFitText(doc, layout.tuGio, formatTime(form.startTime), 9);
    drawAutoFitText(doc, layout.denGio, `${formatTime(form.endTime)} (${form.totalHour}h)`, 9);
    drawAutoFitText(doc, layout.ngay, formatDate(form.date), 9);

    const reasonVnText = `${form.reasonNameVn}${form.subReason ? ` — ${form.subReason}` : ""}`;
    drawReason(doc, layout.lyDo, reasonVnText, form.reasonNameJp ?? "");

    const processPart = form.processPart;
    if (processPart?.isEat) {
        const rect = boxRectPt(layout.checkbox.an);
        const lines = [`P.Chính: ${processPart.mainTicketCount}`, `P.Phụ: ${processPart.secondaryTicketCount}`, `P.Sữa: ${processPart.milkCount}`];
        doc.setFont("Roboto", "bold");
        doc.setFontSize(7);
        doc.setTextColor(0, 0, 0);
        const lineH = 7 * REASON_LINE_HEIGHT;
        let y = rect.y + rect.h - 3 - (lines.length - 1) * lineH;
        for (const line of lines) {
            doc.text(line, rect.x + rect.w / 2, y, { align: "center" });
            y += lineH;
        }
    } else {
        drawCheckMark(doc, layout.checkbox.khongAn);
    }
    if (processPart?.isTransportation) drawCheckMark(doc, layout.checkbox.coXe);
    else drawCheckMark(doc, layout.checkbox.khongXe);
    if (processPart?.isUseCopyRoom) drawCheckMark(doc, layout.checkbox.coCopy);
    else drawCheckMark(doc, layout.checkbox.khongCopy);
    if (processPart?.anotherSuggestionVn) drawAutoFitText(doc, layout.checkbox.deNghiKhac, processPart.anotherSuggestionVn, 8);
}

function drawEmployeeRows(doc: jsPDF, layout: EmployeePageLayout, employees: OtFormDto["employees"], setting: AttendanceSettingDto) {
    layout.rows.forEach((row, index) => {
        const employee = employees[index];
        if (!employee) return;
        const isMonthOverLimit = employee.monthToDate > setting.monthlyOtHourLimit;
        const isYearOverLimit = employee.yearToDate > setting.yearlyOtHourLimit;
        const overColor: [number, number, number] = [147, 0, 6];

        drawAutoFitText(doc, columnBox(layout.columns.hoTen, row), employee.fullName, 8);
        drawAutoFitText(doc, columnBox(layout.columns.maNV, row), employee.employeeCode, 8);
        drawAutoFitText(doc, columnBox(layout.columns.thoiGian, row), `${formatTime(employee.startTime)} — ${formatTime(employee.endTime)}`, 8);
        drawAutoFitText(doc, columnBox(layout.columns.thang, row), String(employee.monthToDate), 8, {
            align: "center",
            bold: isMonthOverLimit,
            color: isMonthOverLimit ? overColor : undefined,
            underline: isMonthOverLimit,
        });
        drawAutoFitText(doc, columnBox(layout.columns.nam, row), String(employee.yearToDate), 8, {
            align: "center",
            bold: isYearOverLimit,
            color: isYearOverLimit ? overColor : undefined,
            underline: isYearOverLimit,
        });
        drawAutoFitText(doc, columnBox(layout.columns.ghiChu, row), employee.noteVn || "", 8);
    });
}

// employees trả về từ /ticket-batch chỉ có đúng field cần in — các field còn lại của OtFormEmployeeDto
// (mealTicketType/actualHours/didEat/isRemoved...) không dùng tới ở drawEmployeeRows, điền giá trị an
// toàn cho đủ kiểu.
function toPrintableEmployee(e: ProductionTicketBatchGroupDto["employees"][number]): OtFormDto["employees"][number] {
    return {
        employeeId: e.employeeId,
        employeeCode: e.employeeCode,
        fullName: e.fullName,
        startTime: e.startTime,
        endTime: e.endTime,
        noteVn: e.noteVn,
        noteJp: null,
        monthToDate: e.monthToDate,
        yearToDate: e.yearToDate,
        customMonthlyOtHourLimit: null,
        customYearlyOtHourLimit: null,
        mealTicketType: 0,
        actualHours: 0,
        didEat: false,
        isRemoved: false,
        removedByUserName: null,
        removedByFullName: null,
        removedAtLevel: null,
        removedAt: null,
        removeReason: null,
        congDoanSnapshot: e.congDoanSnapshot,
        taskNameSnapshot: e.taskNameSnapshot,
        blockCodeSnapshot: e.blockCodeSnapshot,
        teamCodeSnapshot: e.teamCodeSnapshot,
        shiftTeamCodeSnapshot: e.shiftTeamCodeSnapshot,
    };
}

export interface BuildTicketZipResult {
    blob: Blob;
    fileName: string;
}

// dateIso: "yyyy-MM-dd". Trả null nếu không có nhóm nào (gọi trước khi vào hàm này để hiện toast phù
// hợp thay vì âm thầm trả zip rỗng).
export async function buildProductionTicketZip(
    groups: ProductionTicketBatchGroupDto[],
    dateIso: string,
    onProgress?: (done: number, total: number) => void
): Promise<BuildTicketZipResult | null> {
    if (groups.length === 0) return null;

    const settings = await AttendanceSettingApi.getSetting();
    const bgPage1 = await loadImage(HEADER_LAYOUTS.a4.image);
    const bgPage2 = await loadImage(A4_PAGE2_EMPLOYEE.image);

    const zip = new JSZip();
    const [year, month, day] = dateIso.split("-");
    const ddMMyyyy = `${day}-${month}-${year}`;

    for (let g = 0; g < groups.length; g++) {
        const group = groups[g];
        const primaryForm = await OtFormApi.getOtFormById(group.primaryOtFormId);
        const printableEmployees = group.employees.map(toPrintableEmployee);
        const form: OtFormDto = { ...primaryForm, employees: printableEmployees, numberOfEmployee: group.employeeCount };
        const employeePages = buildEmployeePages(printableEmployees, "a4");

        const doc = new jsPDF({ unit: "pt", format: [PAGE_PT_WIDTH, PAGE_PT_HEIGHT] });
        registerVietnameseFont(doc);

        doc.addImage(bgPage1, "PNG", 0, 0, PAGE_PT_WIDTH, PAGE_PT_HEIGHT);
        await drawFormHeader(doc, form);
        drawEmployeeRows(doc, A4_PAGE1_EMPLOYEE, employeePages[0] ?? [], settings);

        for (let p = 1; p < employeePages.length; p++) {
            doc.addPage([PAGE_PT_WIDTH, PAGE_PT_HEIGHT]);
            doc.addImage(bgPage2, "PNG", 0, 0, PAGE_PT_WIDTH, PAGE_PT_HEIGHT);
            drawEmployeeRows(doc, A4_PAGE2_EMPLOYEE, employeePages[p], settings);
        }

        const pdfBlob = doc.output("blob");
        const fileName = `${group.employeeCount}-SAN XUAT TANG CA ${sanitizeFileNamePart(group.block)}-${sanitizeFileNamePart(group.shiftTeam)} ngay ${ddMMyyyy}.pdf`;
        zip.file(fileName, pdfBlob);
        onProgress?.(g + 1, groups.length);
    }

    const zipBlob = await zip.generateAsync({ type: "blob" });
    return { blob: zipBlob, fileName: `Phieu_TangCa_${ddMMyyyy}.zip` };
}
