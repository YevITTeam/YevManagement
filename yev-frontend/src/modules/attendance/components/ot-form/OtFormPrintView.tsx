"use client";

import { useState, useEffect, useRef, useLayoutEffect } from "react";
import { Printer, RectangleHorizontal, RectangleVertical, X } from "lucide-react";
import { useTranslations } from "next-intl";

import { OtFormApi } from "@/modules/attendance/api/ot-form.api";
import type { OtFormApprovalHistoryDto, OtFormDto, OtFormEmployeeDto } from "@/modules/attendance/types/ot-form.dto";
import { getApiErrorMessage } from "@/lib/apiError";
import { DEFAULT_ATTENDANCE_SETTING, useAttendanceSetting } from "@/modules/attendance/hooks/useAttendanceSetting";
import type { AttendanceSettingDto } from "@/modules/attendance/types/attendance-setting.dto";

interface OtFormPrintViewProps {
    onClose?: () => void;
    id: number;
}

export type PaperSize = "a4" | "a5";

// Xuất thêm (export) các hàm thuần bên dưới — dùng chung với productionTicketBatchPdf.tsx (vẽ PDF
// hàng loạt trực tiếp bằng jsPDF, không qua html2canvas nữa, xem file đó) để tránh chép lại logic
// nghiệp vụ (field nào hiện giá trị gì) — CHỈ thêm `export`, không đổi hành vi.
export function formatDate(value: string) {
    if (!value) return "……………………";
    return new Date(value).toLocaleDateString("vi-VN");
}

export function formatTime(value: string) {
    return value?.slice(0, 5) ?? "-";
}

// Thời gian ký in dưới mỗi chữ ký (2026-08-20, yêu cầu người dùng) — "dd/mm/yyyy hh:mm".
export function formatDateTime(value: string | null | undefined) {
    if (!value) return null;
    const d = new Date(value);
    const datePart = d.toLocaleDateString("vi-VN");
    const timePart = d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
    return `${datePart} ${timePart}`;
}

// Tra lịch sử ký/duyệt theo StepOrder (2026-08-07, Giai đoạn 3.1) — trước đây tra theo ApprovalLevel
// cố định, nay chuỗi bước là động theo Cây chức vụ, xem docs §Cây chức vụ.
export function findHistory(histories: OtFormApprovalHistoryDto[], stepOrder: number) {
    // Latest wins: a re-submitted form is signed again on the same step.
    return [...histories].reverse().find((item) => item.stepOrder === stepOrder && item.action !== 2) ?? null;
}

// 3 ô ký cuối trên giấy in (Trưởng phòng/Trưởng xưởng/Tổng Giám Đốc) vẫn là 3 Chức vụ CỐ ĐỊNH
// (TerminalLevelSnapshot 1/2/3, xem docs §Cây chức vụ) dù số bước trung gian trước đó co giãn theo
// Phòng ban — tra đúng bước snapshot của ĐÚNG đơn này theo TerminalLevelSnapshot thay vì StepOrder cố định.
export function findStepByTerminalLevel(form: OtFormDto, terminalLevel: number) {
    return form.approvalSteps.find((s) => s.terminalLevelSnapshot === terminalLevel);
}

// Ô "Người đề nghị" quá hẹp (chia đôi cho 2 chữ ký) nên chỉ in "tên" (từ cuối) thay vì đầy đủ họ tên,
// tránh tràn/đè chữ giữa 2 ô (yêu cầu người dùng).
export function getGivenName(fullName: string | null | undefined) {
    if (!fullName) return fullName;
    const parts = fullName.trim().split(/\s+/);
    return parts[parts.length - 1];
}

// Đơn "theo chuyền" (isProductionForm=true) không gắn 1 Group cố định nên ô "Tên công đoạn" không thể
// in departmentNameVn/groupNameVn như đơn "theo Nhóm" — thay bằng Team/Line/Nhóm ca snapshot trên từng
// nhân viên (OtFormEmployee.TeamCodeSnapshot/BlockCodeSnapshot/ShiftTeamCodeSnapshot — BlockCodeSnapshot
// = "Line" vì ProductionLineId khớp BlockCode, xem docs attendance-otform-pdf-mapping.md). Trước
// 2026-08-27 dùng nhầm CongDoanSnapshot ở vị trí giữa (ra mã tắt vô nghĩa như "HC GT HC") — người dùng
// xác nhận công thức đúng là Team + Line + Nhóm Ca. Người bị loại (isRemoved) không tính. Gộp theo giá
// trị PHÂN BIỆT (thường cả đơn chỉ 1 Team/1 Line/1 Nhóm ca vì chọn qua bộ lọc cascading ở
// CreateOtFormPage, nhưng vẫn gộp phòng trường hợp khác nhau giữa từng người) — khớp mẫu giấy in thật.
export function getProductionCongDoanLabel(form: OtFormDto) {
    const activeEmployees = form.employees.filter((e) => !e.isRemoved);
    const distinct = (values: (string | null)[]) => Array.from(new Set(values.filter((v): v is string => !!v)));
    const teamCodes = distinct(activeEmployees.map((e) => e.teamCodeSnapshot));
    const lineCodes = distinct(activeEmployees.map((e) => e.blockCodeSnapshot));
    const shiftTeamCodes = distinct(activeEmployees.map((e) => e.shiftTeamCodeSnapshot));
    return [teamCodes.join("/"), lineCodes.join("/"), shiftTeamCodes.join("/")].filter(Boolean).join("   ");
}

// Toạ độ (% theo chiều rộng/cao TỪNG TRANG ảnh nền) của mọi ô cần điền — đo trực tiếp từ file gốc
// src/assets/file-ot-form/YEV-22-024 (LBH5)-GIAY DE NGHI LAM NGOAI GIO (A4/A5).doc/.pdf qua Word COM
// (Range.Information + Cell.Width/Height), KHÔNG áng chừng bằng mắt. Toàn bộ nội dung form (kể cả
// bảng "Danh sách nhân viên" và phần ghi chú TH1/TH2/TH3 ở cuối trang) đã nằm sẵn trong ảnh nền —
// component này CHỈ đè chữ đúng vị trí ô trống, không tự vẽ thêm đường kẻ/border/tiêu đề nào khác.
//
// Cấu trúc trang in (khớp đúng số trang thật của file gốc):
// - A4: trang 1 = tiêu đề + ký duyệt + thông tin + lý do/xử lý + DS nhân viên dòng 1-10 (in sẵn).
//        trang 2 = DS nhân viên dòng 11-40 (in sẵn, dùng khi đơn có > 10 người — lặp lại ảnh trang 2
//        cho mỗi 30 người tiếp theo nếu > 40 người, dù thực tế hiếm gặp).
// - A5 (ngang): trang 1 = tiêu đề + ký duyệt + thông tin + lý do/xử lý (KHÔNG có bảng nhân viên).
//        trang 2 = DS nhân viên dòng 1-12 (lặp lại ảnh trang 2 cho mỗi 12 người tiếp theo nếu > 12).
export interface FieldBox {
    left: number;
    top: number;
    width: number;
    height: number;
}

interface HeaderLayout {
    image: string;
    aspect: string;
    // level = JobTitleTerminalLevel (1=Trưởng phòng, 2=Trưởng xưởng, 3=Tổng Giám Đốc) — 3 Chức vụ
    // CỐ ĐỊNH, tra đúng bước snapshot của đơn qua findStepByTerminalLevel (xem docs §Cây chức vụ).
    signature: { level: number; box: FieldBox }[];
    // Ô "Người đề nghị" trên giấy chỉ có 2 chỗ trống, dùng cho bước trung gian "Bắt buộc ký" ĐẦU và CUỐI
    // (trước khi tới 3 Chức vụ cố định ở trên) — KHÔNG phải toàn bộ bước trung gian, xem
    // FormHeaderFields.intermediateSteps. Số bước trung gian mỗi Nhóm KHÔNG bị giới hạn (có thể có
    // nhiều bước "Chỉ xác nhận"), chỉ số bước "Bắt buộc ký" bị giới hạn CỨNG 1-2 (validate ở
    // GroupApprovalStepService.ReplaceAsync + chặn ngay trên UI ApprovalStepManager.tsx) CHÍNH LÀ để
    // khớp đúng 2 ô này.
    requester: { slot: "first" | "last"; box: FieldBox }[];
    tenCongDoan: FieldBox;
    soLuongNhanVien: FieldBox;
    nguoiChiuTrachNhiem: FieldBox;
    tuGio: FieldBox;
    denGio: FieldBox;
    ngay: FieldBox;
    lyDo: FieldBox;
    checkbox: { an: FieldBox; khongAn: FieldBox; coXe: FieldBox; khongXe: FieldBox; coCopy: FieldBox; khongCopy: FieldBox; deNghiKhac: FieldBox };
}

export const HEADER_LAYOUTS: Record<PaperSize, HeaderLayout> = {
    a4: {
        image: "/ot-form/a4-page1.png",
        aspect: "612 / 792",
        signature: [
            { level: 3, box: { left: 6.536, top: 17.519, width: 21.446, height: 6.944 } }, // Tổng Giám Đốc
            { level: 2, box: { left: 28.023, top: 17.519, width: 22.753, height: 6.944 } }, // Trưởng xưởng
            { level: 1, box: { left: 50.817, top: 17.519, width: 23.489, height: 6.944 } }, // Trưởng phòng
        ],
        requester: [
            { slot: "first", box: { left: 74.346, top: 17.519, width: 9.906, height: 6.944 } },
            { slot: "last", box: { left: 84.252, top: 17.519, width: 9.906, height: 6.944 } },
        ],
        tenCongDoan: { left: 34.706, top: 26.61, width: 60.294, height: 2.727 },
        soLuongNhanVien: { left: 34.706, top: 29.545, width: 15, height: 2.727 },
        nguoiChiuTrachNhiem: { left: 34.706, top: 32.576, width: 60.294, height: 2.727 },
        tuGio: { left: 40.85, top: 34.701, width: 13.889, height: 1.673 },
        denGio: { left: 68.3, top: 34.701, width: 26.144, height: 1.673 },
        ngay: { left: 44.444, top: 36.374, width: 50, height: 1.673 },
        lyDo: { left: 12.647, top: 40.057, width: 82.353, height: 2.21 },
        checkbox: {
            an: { left: 12.655, top: 48.264, width: 13.962, height: 6.111 },
            khongAn: { left: 26.618, top: 48.264, width: 13.971, height: 6.111 },
            coXe: { left: 40.588, top: 48.264, width: 9.641, height: 6.111 },
            khongXe: { left: 50.229, top: 48.264, width: 10.776, height: 6.111 },
            coCopy: { left: 61.005, top: 48.264, width: 8.995, height: 6.111 },
            khongCopy: { left: 70, top: 48.264, width: 9.134, height: 6.111 },
            deNghiKhac: { left: 79.134, top: 48.264, width: 15.866, height: 6.111 },
        },
    },
    a5: {
        image: "/ot-form/a5-page1.png",
        aspect: "595.3 / 419.55",
        signature: [
            { level: 3, box: { left: 4.326, top: 27.771, width: 21.797, height: 9.833 } },
            { level: 2, box: { left: 26.165, top: 27.771, width: 25.662, height: 9.833 } },
            { level: 1, box: { left: 51.869, top: 27.771, width: 22.638, height: 9.833 } },
        ],
        requester: [
            { slot: "first", box: { left: 74.549, top: 27.771, width: 10.709, height: 9.833 } },
            { slot: "last", box: { left: 85.258, top: 27.771, width: 10.710, height: 9.833 } },
        ],
        tenCongDoan: { left: 33.286, top: 41.831, width: 63.556, height: 4.374 },
        soLuongNhanVien: { left: 33.286, top: 46.657, width: 15, height: 5.148 },
        nguoiChiuTrachNhiem: { left: 33.286, top: 52.02, width: 63.556, height: 5.148 },
        tuGio: { left: 39.762, top: 55.852, width: 14.64, height: 3.158 },
        denGio: { left: 68.71, top: 55.852, width: 27.56, height: 3.158 },
        ngay: { left: 43.551, top: 59.011, width: 52.705, height: 3.158 },
        lyDo: { left: 11.834, top: 65.606, width: 84.663, height: 8.342 },
        checkbox: {
            an: { left: 11.843, top: 80.002, width: 14.354, height: 8.426 },
            khongAn: { left: 26.197, top: 80.002, width: 14.363, height: 8.426 },
            coXe: { left: 40.559, top: 80.002, width: 9.911, height: 8.426 },
            khongXe: { left: 50.47, top: 80.002, width: 11.078, height: 8.426 },
            coCopy: { left: 61.549, top: 80.002, width: 9.247, height: 8.426 },
            khongCopy: { left: 70.796, top: 80.002, width: 9.39, height: 8.426 },
            deNghiKhac: { left: 80.186, top: 80.002, width: 16.311, height: 8.426 },
        },
    },
};

interface EmployeeColumns {
    hoTen: FieldBox;
    maNV: FieldBox;
    thoiGian: FieldBox;
    thang: FieldBox;
    nam: FieldBox;
    ghiChu: FieldBox;
}

export interface RowSlot {
    top: number;
    height: number;
}

export interface EmployeePageLayout {
    image: string;
    aspect: string;
    columns: EmployeeColumns;
    rows: RowSlot[];
}

// Cột dùng chung 1 hàng (top/height lấy từ rows[i]) — Stt đã in sẵn trong ảnh nên không cần đè.
export function columnBox(col: FieldBox, row: RowSlot): FieldBox {
    return { left: col.left, width: col.width, top: row.top, height: row.height };
}

export const A4_PAGE1_EMPLOYEE: EmployeePageLayout = {
    image: "/ot-form/a4-page1.png",
    aspect: "612 / 792",
    columns: {
        hoTen: { left: 11.176, top: 0, width: 25, height: 0 },
        maNV: { left: 36.176, top: 0, width: 11.765, height: 0 },
        thoiGian: { left: 47.941, top: 0, width: 13.235, height: 0 },
        thang: { left: 61.176, top: 0, width: 8.824, height: 0 },
        nam: { left: 70, top: 0, width: 8.824, height: 0 },
        ghiChu: { left: 78.824, top: 0, width: 16.176, height: 0 },
    },
    rows: [
        { top: 67.614, height: 2.001 },
        { top: 69.602, height: 2.001 },
        { top: 71.686, height: 2.001 },
        { top: 73.674, height: 2.001 },
        { top: 75.758, height: 2.001 },
        { top: 77.746, height: 2.001 },
        { top: 79.83, height: 2.001 },
        { top: 81.913, height: 2.001 },
        { top: 83.902, height: 2.001 },
        { top: 85.985, height: 2.001 },
    ],
};

export const A4_PAGE2_EMPLOYEE: EmployeePageLayout = {
    image: "/ot-form/a4-page2.png",
    aspect: "612 / 792",
    columns: {
        hoTen: { left: 11.176, top: 0, width: 25, height: 0 },
        maNV: { left: 36.176, top: 0, width: 8.824, height: 0 },
        thoiGian: { left: 45, top: 0, width: 16.176, height: 0 },
        thang: { left: 61.176, top: 0, width: 8.824, height: 0 },
        nam: { left: 70, top: 0, width: 8.824, height: 0 },
        ghiChu: { left: 78.824, top: 0, width: 16.176, height: 0 },
    },
    rows: [
        { top: 16.572, height: 2.557 },
        { top: 19.129, height: 2.557 },
        { top: 21.686, height: 2.557 },
        { top: 24.242, height: 2.557 },
        { top: 26.799, height: 2.557 },
        { top: 29.356, height: 2.557 },
        { top: 31.913, height: 2.557 },
        { top: 34.47, height: 2.557 },
        { top: 37.027, height: 2.557 },
        { top: 39.583, height: 2.557 },
        { top: 42.14, height: 2.557 },
        { top: 44.792, height: 2.557 },
        { top: 47.348, height: 2.557 },
        { top: 49.905, height: 2.557 },
        { top: 52.462, height: 2.557 },
        { top: 55.019, height: 2.557 },
        { top: 57.576, height: 2.557 },
        { top: 60.133, height: 2.557 },
        { top: 62.689, height: 2.557 },
        { top: 65.246, height: 2.557 },
        { top: 67.803, height: 2.557 },
        { top: 70.36, height: 2.557 },
        { top: 72.917, height: 2.557 },
        { top: 75.473, height: 2.557 },
        { top: 78.03, height: 2.557 },
        { top: 80.587, height: 2.557 },
        { top: 83.239, height: 2.557 },
        { top: 85.795, height: 2.557 },
        { top: 88.352, height: 2.557 },
        { top: 90.909, height: 2.557 },
    ],
};

export const A5_PAGE2_EMPLOYEE: EmployeePageLayout = {
    image: "/ot-form/a5-page2.png",
    aspect: "595.3 / 419.55",
    columns: {
        hoTen: { left: 9.928, top: 0, width: 22.762, height: 0 },
        maNV: { left: 32.689, top: 0, width: 11.876, height: 0 },
        thoiGian: { left: 44.566, top: 0, width: 13.371, height: 0 },
        thang: { left: 57.937, top: 0, width: 8.962, height: 0 },
        nam: { left: 66.899, top: 0, width: 8.937, height: 0 },
        ghiChu: { left: 75.836, top: 0, width: 21.006, height: 0 },
    },
    rows: [
        { top: 25.206, height: 4.147 },
        { top: 29.317, height: 4.147 },
        { top: 33.429, height: 4.147 },
        { top: 37.54, height: 4.147 },
        { top: 41.652, height: 4.147 },
        { top: 45.763, height: 4.147 },
        { top: 49.875, height: 4.147 },
        { top: 53.986, height: 4.147 },
        { top: 58.098, height: 4.147 },
        { top: 62.21, height: 4.147 },
        { top: 66.321, height: 4.147 },
        { top: 70.611, height: 4.147 },
    ],
};

export const EMPLOYEE_PAGE_CAPACITY: Record<PaperSize, { first: number; rest: number }> = {
    a4: { first: 10, rest: 30 },
    a5: { first: 0, rest: 12 },
};

function boxStyle(box: FieldBox): React.CSSProperties {
    return {
        position: "absolute",
        left: `${box.left}%`,
        top: `${box.top}%`,
        width: `${box.width}%`,
        height: `${box.height}%`,
    };
}

const AUTOFIT_LINE_MIN_SCALE = 0.55;
const AUTOFIT_LINE_SCALE_STEP = 0.05;

// Tự thu nhỏ cỡ chữ 1 dòng (đo scrollWidth/clientWidth THẬT trên DOM, cùng kỹ thuật với
// ReasonAutoFit ở trên) cho tới khi vừa khít bề rộng ô — dùng thay cho cách cũ "khoá overflow:hidden +
// white-space:nowrap rồi để CSS tự cắt chữ tràn". html2canvas (dùng khi xuất PDF hàng loạt theo
// Line/Nhóm, xem productionTicketBatchPdf.tsx) KHÔNG cắt được overflow:hidden một cách đáng tin cậy
// trên các ô flex/absolute — chữ dài (vd tên "[TEST] Manager - Che tao") vẫn bị vẽ tràn ra ngoài ô dù
// CSS khai overflow:hidden, trong khi bản in trực tiếp qua window.print() (trình duyệt thật) thì vẫn
// cắt đúng — đây là lý do lỗi chỉ lộ ra ở file PDF xuất hàng loạt, không lộ khi in đơn lẻ (lỗi người
// dùng báo 2026-09-03). Đo bằng DOM thật thì luôn ra đúng kết quả ở cả 2 đường, không phụ thuộc
// html2canvas có hỗ trợ clip hay không.
function useAutoFitLineWidth(
    textRef: React.RefObject<HTMLElement | null>,
    wrapperRef: React.RefObject<HTMLElement | null>,
    basePt: number,
    deps: React.DependencyList
) {
    useLayoutEffect(() => {
        function fit() {
            const wrapper = wrapperRef.current;
            const el = textRef.current;
            if (!wrapper || !el) return;
            let scale = 1;
            el.style.fontSize = `${basePt * scale}pt`;
            while (el.scrollWidth > wrapper.clientWidth && scale > AUTOFIT_LINE_MIN_SCALE) {
                scale = Math.max(AUTOFIT_LINE_MIN_SCALE, scale - AUTOFIT_LINE_SCALE_STEP);
                el.style.fontSize = `${basePt * scale}pt`;
            }
            // Canh giữa dọc bằng line-height = chiều cao THẬT của ô (đo bằng clientHeight, KHÔNG
            // dùng display:flex/table): 2 kỹ thuật đó html2canvas đều tính sai trên ô tuyệt đối định vị
            // nhỏ (chữ bị đẩy lệch xuống đáy, đè lên viền dòng bên dưới — lỗi người dùng báo 2026-09-03,
            // đã thử table-cell vẫn còn y hệt). line-height là cách canh giữa dọc CŨ NHẤT (không phụ
            // thuộc flexbox/table layout), chỉ dựa vào text-flow bình thường — html2canvas render đúng.
            el.style.lineHeight = `${wrapper.clientHeight}px`;
        }
        fit();
        window.addEventListener("beforeprint", fit);
        window.addEventListener("resize", fit);
        return () => {
            window.removeEventListener("beforeprint", fit);
            window.removeEventListener("resize", fit);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps -- deps do caller truyền vào (nội dung + cỡ chữ gốc), refs cố ý không đưa vào deps
    }, deps);
}

// Ô đè dữ liệu "1 dòng, tự thu nhỏ cỡ chữ nếu tràn" — thay cho nowrapBoxStyle cũ, xem
// useAutoFitLineWidth ở trên.
function AutoFitLine({
    box,
    text,
    fontPt,
    align = "left",
    wrapperClassName,
    textClassName,
}: {
    box: FieldBox;
    text: string | number;
    fontPt: number;
    align?: "left" | "center";
    wrapperClassName?: string;
    textClassName?: string;
}) {
    const wrapperRef = useRef<HTMLDivElement>(null);
    const textRef = useRef<HTMLSpanElement>(null);
    useAutoFitLineWidth(textRef, wrapperRef, fontPt, [text, fontPt]);

    // Căn giữa dọc bằng line-height (xem useAutoFitLineWidth) — KHÔNG dùng flexbox lẫn CSS table, cả 2
    // đều bị html2canvas tính sai trên ô nhỏ (đã thử cả 2, cùng lỗi chữ đè viền dòng).
    return (
        <div ref={wrapperRef} style={{ ...boxStyle(box), overflow: "hidden", textAlign: align === "center" ? "center" : "left" }} className={wrapperClassName}>
            <span ref={textRef} style={{ whiteSpace: "nowrap", fontSize: `${fontPt}pt` }} className={textClassName}>
                {text}
            </span>
        </div>
    );
}

export const REASON_BASE_FONT_PT = 9;
export const REASON_JP_RATIO = 0.85;
// Sàn thu nhỏ: 60% cỡ chữ gốc (~5.4pt) — nhỏ hơn nữa thì khó đọc, chấp nhận tràn nhẹ (box cha vẫn có
// overflow:hidden chặn không cho vẽ đè lên nội dung khác trên giấy).
export const REASON_MIN_SCALE = 0.6;
export const REASON_SCALE_STEP = 0.05;
export const REASON_LINE_HEIGHT = 1.15;

// Đè 2 dòng lý do (VN + bản dịch JP) lên đúng ô "Lý do" — cho ngắt dòng THẬT (không còn ép 1 dòng như
// trước) rồi tự thu nhỏ cỡ chữ dựa trên chiều cao THỰC ĐO ĐƯỢC của DOM (scrollHeight so với clientHeight
// cố định của ô) cho tới khi vừa khít, thay vì tính trước bằng canvas: cách đo bằng canvas (dùng font
// xấp xỉ "Arial") ước lượng bề rộng ký tự tiếng Việt có dấu/tiếng Nhật sai lệch khá nhiều so với font
// fallback trình duyệt THẬT SỰ dùng để vẽ (Inter chỉ có subset "latin", không có dấu VN/chữ Nhật), gây
// ngắt dòng sớm dù ô còn thừa chỗ (lỗi người dùng báo 2026-09-03) — đo trực tiếp trên DOM đã render thì
// luôn khớp đúng 100% với những gì thật sự hiển thị, dù là xem trước trên màn hình hay khi in.
function ReasonAutoFit({ box, vnText, jpText }: { box: FieldBox; vnText: string; jpText: string }) {
    const wrapperRef = useRef<HTMLDivElement>(null);
    const vnRef = useRef<HTMLDivElement>(null);
    const jpRef = useRef<HTMLDivElement>(null);

    useLayoutEffect(() => {
        function fit() {
            const wrapper = wrapperRef.current;
            const vnEl = vnRef.current;
            if (!wrapper || !vnEl) return;
            let scale = 1;
            const applyScale = (s: number) => {
                vnEl.style.fontSize = `${REASON_BASE_FONT_PT * s}pt`;
                if (jpRef.current) jpRef.current.style.fontSize = `${REASON_BASE_FONT_PT * REASON_JP_RATIO * s}pt`;
            };
            applyScale(scale);
            while (wrapper.scrollHeight > wrapper.clientHeight && scale > REASON_MIN_SCALE) {
                scale = Math.max(REASON_MIN_SCALE, scale - REASON_SCALE_STEP);
                applyScale(scale);
            }
        }
        fit();
        // In (Ctrl+P / window.print) dựng lại layout theo khổ giấy @page thật — kích thước px của box
        // lúc đó khác lúc xem trên màn hình (khung mx-auto max-w-4xl), nên phải đo + co lại đúng lúc đó.
        window.addEventListener("beforeprint", fit);
        window.addEventListener("resize", fit);
        return () => {
            window.removeEventListener("beforeprint", fit);
            window.removeEventListener("resize", fit);
        };
    }, [vnText, jpText]);

    return (
        <div
            ref={wrapperRef}
            style={{ ...boxStyle(box), display: "flex", flexDirection: "column", justifyContent: "center", overflow: "hidden" }}
            className="pl-1"
        >
            <div ref={vnRef} style={{ lineHeight: REASON_LINE_HEIGHT, overflowWrap: "break-word" }}>
                {vnText}
            </div>
            {jpText && (
                <div ref={jpRef} style={{ lineHeight: REASON_LINE_HEIGHT, wordBreak: "break-all" }}>
                    {jpText}
                </div>
            )}
        </div>
    );
}

// Chỉ 4 field thật sự cần để vẽ 1 ô chữ ký — tách khỏi OtFormApprovalHistoryDto đầy đủ để SignatureCell
// dùng chung được cho cả lịch sử duyệt thật (findHistory) LẪN chữ ký tự ký của người tạo đơn (không có
// OtFormApprovalHistory tương ứng, xem selfSignDisplay bên dưới).
export type SignatureDisplay = Pick<OtFormApprovalHistoryDto, "approverFullName" | "approverUserName" | "hasSignature" | "signatureImage" | "actionAt"> &
    Partial<Pick<OtFormApprovalHistoryDto, "onBehalfOfFullName" | "onBehalfOfUserName">>;

export function getSignatureDataUrl(signatureImage: string | null | undefined): string | null {
    if (!signatureImage) return null;
    const trimmed = signatureImage.trim();
    if (trimmed.startsWith("data:")) return trimmed;
    const isJpeg = trimmed.startsWith("/9j/") || trimmed.startsWith("/9j");
    const mime = isJpeg ? "image/jpeg" : "image/png";
    return `data:${mime};base64,${trimmed}`;
}

function SignatureCell({ box, history, nameOnly }: { box: FieldBox; history: SignatureDisplay | null; nameOnly?: boolean }) {
    if (!history) return null;

    const displayName = history.approverFullName ?? history.approverUserName;
    const displayText = nameOnly ? getGivenName(displayName) : displayName;
    const signedAt = formatDateTime(history.actionAt);
    const dataUrl = history.hasSignature ? getSignatureDataUrl(history.signatureImage) : null;
    const onBehalfName = history.onBehalfOfFullName ?? history.onBehalfOfUserName;
    const onBehalfText = onBehalfName ? `(thay mặt ${nameOnly ? getGivenName(onBehalfName) : onBehalfName})` : null;

    return (
        <div
            style={boxStyle(box)}
            className={`flex flex-col items-center overflow-hidden px-1 py-0.5 select-none ${
                dataUrl ? "justify-between" : "justify-center gap-1"
            }`}
        >
            {/* 1. Vùng ảnh chữ ký (nếu có) */}
            {dataUrl ? (
                <div className="flex-1 w-full min-h-0 flex items-center justify-center overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src={dataUrl}
                        alt={`Chữ ký ${displayText}`}
                        className="max-h-full max-w-[85%] object-contain block mx-auto pointer-events-none"
                    />
                </div>
            ) : null}

            {/* 2. Dòng tên người ký */}
            {displayText && (
                <div className="w-full shrink-0 overflow-hidden text-center">
                    <span
                        style={{
                            fontSize: displayText.length > 25 ? "5.5pt" : displayText.length > 18 ? "6.5pt" : "7pt",
                            whiteSpace: "nowrap",
                        }}
                        className="block truncate font-semibold text-black leading-tight"
                        title={displayText}
                    >
                        {displayText}
                    </span>
                </div>
            )}

            {onBehalfText && (
                <div className="w-full shrink-0 truncate text-center text-[5.5pt] text-black leading-tight" title={onBehalfText}>
                    {onBehalfText}
                </div>
            )}

            {/* 3. Dòng ngày giờ ký (ở đáy) */}
            {signedAt && (
                <div className="w-full shrink-0 text-center text-[5.5pt] text-black leading-none pb-0.5">
                    {signedAt}
                </div>
            )}
        </div>
    );
}

// Khung 1 trang in — 1 <img> nền + children là các ô đè dữ liệu. TÁCH RIÊNG khỏi phần điền dữ liệu
// (FormHeaderFields/EmployeeRowFields bên dưới) vì trang 1 khổ A4 dùng CHUNG 1 ảnh nền cho cả phần
// đầu (ký duyệt/thông tin) lẫn 10 dòng nhân viên đầu tiên — không được vẽ ảnh nền 2 lần cho 2 trang
// riêng biệt.
export function PageFrame({
    image,
    aspect,
    alt,
    children,
}: {
    image: string;
    aspect: string;
    alt: string;
    children: React.ReactNode;
}) {
    return (
        <div className="relative w-full text-black" style={{ aspectRatio: aspect }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- ảnh nền tĩnh từ public/, next/image không cần thiết cho asset in ấn cố định này */}
            <img src={image} alt={alt} className="absolute inset-0 h-full w-full" />
            {children}
        </div>
    );
}

// Đè dữ liệu thật lên đúng ô trống của ảnh nền (xuất trực tiếp từ file .doc/.pdf gốc) — không vẽ thêm
// đường kẻ/border/ô nào ngoài ảnh. Chỉ có phần "Người đề nghị" thêm 1 đường kẻ dọc mảnh để phân tách
// rõ 2 chữ ký (Trưởng nhóm | Trưởng Bộ phận) cùng chia sẻ 1 ô trên giấy gốc. KHÔNG tự vẽ <img> — dùng
// bên trong PageFrame vì trang 1 khổ A4 chia sẻ ảnh nền chung với EmployeeRowFields.
export function FormHeaderFields({ form, paperSize }: { form: OtFormDto; paperSize: PaperSize }) {
    const layout = HEADER_LAYOUTS[paperSize];
    const processPart = form.processPart;

    // "Người chịu trách nhiệm" = bước được Admin đánh dấu IsResponsible khi cấu hình Cây duyệt Phòng
    // ban (2026-08-07, xem docs §Cây chức vụ) — KHÔNG mặc định là người tạo đơn. Fallback về createdBy
    // khi chưa ai ký tới bước đó hoặc chuỗi chưa cấu hình bước chịu trách nhiệm.
    const responsibleStep = form.approvalSteps.find((s) => s.isResponsibleSnapshot);
    const responsibleHistory = responsibleStep ? findHistory(form.approvalHistories, responsibleStep.stepOrder) : null;
    const nguoiChiuTrachNhiemName =
        responsibleHistory?.approverFullName ?? responsibleHistory?.approverUserName ?? form.createdByFullName ?? form.createdByUserName;

    // Bước trung gian ĐƯỢC BẮT BUỘC KÝ (TerminalLevelSnapshot=None và RequiresSignatureSnapshot=true) —
    // CHỈ những bước này mới có tên in vào ô "Người đề nghị" (2026-08-08, sửa lại cùng ngày: bản đầu lấy
    // toàn bộ bước trung gian bất kể "Chỉ xác nhận" hay "Bắt buộc ký", trong khi số bước trung gian
    // KHÔNG còn bị giới hạn — chỉ số bước "Bắt buộc ký" mới giới hạn 1-2, khớp đúng 2 ô cố định trên
    // giấy in, xem GroupApprovalStepService.ReplaceAsync). "đầu"/"cuối" trong danh sách ĐÃ LỌC này
    // luôn đủ chỗ cho cả 1-2 người.
    const intermediateSteps = form.approvalSteps.filter((s) => s.terminalLevelSnapshot === 0 && s.requiresSignatureSnapshot);
    const firstIntermediate = intermediateSteps[0];
    const lastIntermediate = intermediateSteps[intermediateSteps.length - 1];

    // Không còn bước trung gian "Bắt buộc ký" nào (người tạo đã ở cấp cao hơn/bằng mọi bước đó) — chính
    // người tạo tự ký ô "Người đề nghị" thay, dùng OtForm.CreatorSignatureImage snapshot lúc tạo đơn
    // (2026-08-08, xem JobTitleApprovalChainService.RequiresCreatorSelfSign). Chỉ điền vào ô ĐẦU, ô sau
    // để trống — chỉ có 1 người ký trong trường hợp này.
    const selfSignDisplay: SignatureDisplay | null = form.creatorSignatureImage
        ? {
              approverFullName: form.createdByFullName,
              approverUserName: form.createdByUserName,
              hasSignature: true,
              signatureImage: form.creatorSignatureImage,
              // Không có OtFormApprovalHistory riêng cho tự ký — dùng thời điểm tạo đơn làm "thời gian ký".
              actionAt: form.createdAt,
          }
        : null;

    const reasonVnText = `${form.reasonNameVn}${form.subReason ? ` — ${form.subReason}` : ""}`;

    return (
        <div className="text-[9pt]">
            {layout.signature.map(({ level, box }) => {
                const step = findStepByTerminalLevel(form, level);
                return <SignatureCell key={level} box={box} history={step ? findHistory(form.approvalHistories, step.stepOrder) : null} />;
            })}
            {/* Ô "Người đề nghị" gộp chung 2 chữ ký trên giấy gốc — thêm đường kẻ dọc mảnh để phân tách khi
                CÓ đủ 2 người ký. Nếu dưới cấp trưởng phòng chỉ có 1 người ký (1 bước trung gian, hoặc tự
                ký khi không còn bước trung gian nào), bỏ đường kẻ và gộp 2 ô thành 1 ô rộng bằng cả 2 ô
                cộng lại để chữ ký/tên hiển thị đầy đủ thay vì bị ép vào nửa ô (yêu cầu người dùng 2026-09-04). */}
            {(() => {
                const firstBox = layout.requester.find((r) => r.slot === "first")!.box;
                const lastBox = layout.requester.find((r) => r.slot === "last")!.box;
                // Chỉ 1 bước trung gian (hoặc 0 bước trung gian / tự ký) → gộp cả 2 ô thành 1 ô rộng, bỏ vạch kẻ.
                const isSingleRequester = intermediateSteps.length <= 1;
                const effectiveLastStep = isSingleRequester ? undefined : lastIntermediate;
                const firstDisplay = firstIntermediate
                    ? findHistory(form.approvalHistories, firstIntermediate.stepOrder)
                    : intermediateSteps.length === 0
                    ? selfSignDisplay
                    : null;
                const lastDisplay = effectiveLastStep ? findHistory(form.approvalHistories, effectiveLastStep.stepOrder) : null;

                if (isSingleRequester) {
                    const mergedBox: FieldBox = { ...firstBox, width: lastBox.left + lastBox.width - firstBox.left };
                    return <SignatureCell box={mergedBox} history={firstDisplay} nameOnly={false} />;
                }

                return (
                    <>
                        <div style={{ ...boxStyle(firstBox), borderRight: "1px solid #000" }}>
                            <SignatureCell box={{ left: 0, top: 0, width: 100, height: 100 }} history={firstDisplay} nameOnly />
                        </div>
                        <div style={boxStyle(lastBox)}>
                            <SignatureCell box={{ left: 0, top: 0, width: 100, height: 100 }} history={lastDisplay} nameOnly />
                        </div>
                    </>
                );
            })()}

            <AutoFitLine
                box={layout.tenCongDoan}
                fontPt={9}
                wrapperClassName="pl-1"
                text={form.isProductionForm ? getProductionCongDoanLabel(form) : `${form.departmentNameVn} — ${form.groupNameVn}`}
            />
            <AutoFitLine box={layout.soLuongNhanVien} fontPt={9} wrapperClassName="pl-1" text={form.numberOfEmployee} />
            <AutoFitLine box={layout.nguoiChiuTrachNhiem} fontPt={9} wrapperClassName="pl-1" text={nguoiChiuTrachNhiemName ?? ""} />
            <AutoFitLine box={layout.tuGio} fontPt={9} wrapperClassName="pl-1" text={formatTime(form.startTime)} />
            <AutoFitLine box={layout.denGio} fontPt={9} wrapperClassName="pl-1" text={`${formatTime(form.endTime)} (${form.totalHour}h)`} />
            <AutoFitLine box={layout.ngay} fontPt={9} wrapperClassName="pl-1" text={formatDate(form.date)} />

            <ReasonAutoFit box={layout.lyDo} vnText={reasonVnText} jpText={form.reasonNameJp ?? ""} />

            {/* "Không"/mặc định luôn được tick khi mục tương ứng chưa bật (kể cả khi cả đơn không có
                processPart) — chỉ ô "Có"/"Ăn" mới cần đúng true mới tick, tránh để trống gây hiểu nhầm
                là "chưa xử lý" (yêu cầu người dùng). Khi Ăn=true: KHÔNG tick dấu ✓ nữa, thay bằng 3 dòng
                số lượng phiếu chính/phụ/sữa (processPart.mainTicketCount/secondaryTicketCount/milkCount,
                có sẵn trong DB từ migration AddMealTicketCountsToProcessPart nhưng trước đó chưa in ra
                đâu — yêu cầu người dùng 2026-08-10, xem docs/attendance-otform-pdf-mapping.md §4).
                justifyContent="flex-end" (không phải "center") để dồn 3 dòng xuống ĐÁY ô — tránh đè lên
                chữ "Ăn 食べる" in sẵn ngay phía trên ô này trên ảnh nền (yêu cầu người dùng 2026-08-10,
                trước đó center khiến dòng đầu chạm/đè lên chữ có sẵn). leading-none + gap-0 để 3 dòng
                chiếm ít chiều cao nhất có thể. */}
            <div
                style={{ ...boxStyle(layout.checkbox.an), display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", overflow: "hidden" }}
                className="gap-0 pb-0.5 text-center"
            >
                {processPart?.isEat && (
                    <>
                        <span style={{ whiteSpace: "nowrap" }} className="text-[7pt] leading-none font-semibold text-black">
                            {`P.Chính: ${processPart.mainTicketCount}`}
                        </span>
                        <span style={{ whiteSpace: "nowrap" }} className="text-[7pt] leading-none font-semibold text-black">
                            {`P.Phụ: ${processPart.secondaryTicketCount}`}
                        </span>
                        <span style={{ whiteSpace: "nowrap" }} className="text-[7pt] leading-none font-semibold text-black">
                            {`P.Sữa: ${processPart.milkCount}`}
                        </span>
                    </>
                )}
            </div>
            <div style={boxStyle(layout.checkbox.khongAn)} className="flex items-center justify-center text-[13pt]">
                {!processPart?.isEat ? "✓" : ""}
            </div>
            <div style={boxStyle(layout.checkbox.coXe)} className="flex items-center justify-center text-[13pt]">
                {processPart?.isTransportation ? "✓" : ""}
            </div>
            <div style={boxStyle(layout.checkbox.khongXe)} className="flex items-center justify-center text-[13pt]">
                {!processPart?.isTransportation ? "✓" : ""}
            </div>
            <div style={boxStyle(layout.checkbox.coCopy)} className="flex items-center justify-center text-[13pt]">
                {processPart?.isUseCopyRoom ? "✓" : ""}
            </div>
            <div style={boxStyle(layout.checkbox.khongCopy)} className="flex items-center justify-center text-[13pt]">
                {!processPart?.isUseCopyRoom ? "✓" : ""}
            </div>
            <AutoFitLine box={layout.checkbox.deNghiKhac} fontPt={8} wrapperClassName="pl-1" text={processPart?.anotherSuggestionVn || ""} />
        </div>
    );
}

// Đè danh sách nhân viên lên đúng dòng in sẵn (Stt đã in sẵn trong ảnh nên không đè). KHÔNG tự vẽ
// <img> — dùng bên trong PageFrame để tận dụng chung ảnh nền với FormHeaderFields khi cùng 1 trang
// (trang 1 khổ A4) hoặc dùng ảnh nền riêng của trang tiếp theo.
export function EmployeeRowFields({
    layout,
    employees,
    setting = DEFAULT_ATTENDANCE_SETTING,
}: {
    layout: EmployeePageLayout;
    employees: OtFormEmployeeDto[];
    // Ngưỡng cảnh báo lũy kế lấy từ cấu hình (Admin sửa được), không còn hardcode 25/300.
    setting?: AttendanceSettingDto;
}) {
    return (
        <div className="text-[8pt]">
            {layout.rows.map((row, index) => {
                const employee = employees[index];
                if (!employee) return null;
                // The snapshot is taken before this form; the printed figure includes this form's own hours.
                const monthAfter = Math.round((employee.monthToDate + employee.actualHours) * 100) / 100;
                const yearAfter = Math.round((employee.yearToDate + employee.actualHours) * 100) / 100;
                const isMonthOverLimit = monthAfter > setting.monthlyOtHourLimit;
                const isYearOverLimit = yearAfter > setting.yearlyOtHourLimit;
                return (
                    <div key={employee.employeeId}>
                        <AutoFitLine box={columnBox(layout.columns.hoTen, row)} fontPt={8} wrapperClassName="pl-1" text={employee.fullName} />
                        <AutoFitLine box={columnBox(layout.columns.maNV, row)} fontPt={8} wrapperClassName="pl-1" text={employee.employeeCode} />
                        <AutoFitLine
                            box={columnBox(layout.columns.thoiGian, row)}
                            fontPt={8}
                            wrapperClassName="pl-1"
                            text={`${formatTime(employee.startTime)} — ${formatTime(employee.endTime)}`}
                        />
                        <AutoFitLine
                            box={columnBox(layout.columns.thang, row)}
                            fontPt={8}
                            align="center"
                            textClassName={isMonthOverLimit ? "font-bold text-[#930006] underline" : ""}
                            text={monthAfter}
                        />
                        <AutoFitLine
                            box={columnBox(layout.columns.nam, row)}
                            fontPt={8}
                            align="center"
                            textClassName={isYearOverLimit ? "font-bold text-[#930006] underline" : ""}
                            text={yearAfter}
                        />
                        <AutoFitLine box={columnBox(layout.columns.ghiChu, row)} fontPt={8} wrapperClassName="pl-1" text={employee.noteVn || ""} />
                    </div>
                );
            })}
        </div>
    );
}

// Chia nhân viên vào từng trang khớp đúng sức chứa in sẵn trên giấy: A4 trang 1 chứa tối đa 10 người,
// các trang sau (dùng lại ảnh trang 2) mỗi trang tối đa 30 người. A5 trang 1 không có bảng nhân viên,
// trang 2 (lặp lại nếu cần) mỗi trang tối đa 12 người. Không đủ người thì chỉ in đúng số trang cần thiết.
export function buildEmployeePages(employees: OtFormEmployeeDto[], paperSize: PaperSize): OtFormEmployeeDto[][] {
    const { first, rest } = EMPLOYEE_PAGE_CAPACITY[paperSize];
    const pages: OtFormEmployeeDto[][] = [];
    let remaining = employees;
    if (first > 0) {
        pages.push(remaining.slice(0, first));
        remaining = remaining.slice(first);
    }
    while (remaining.length > 0) {
        pages.push(remaining.slice(0, rest));
        remaining = remaining.slice(rest);
    }
    return pages;
}

export default function OtFormPrintView({ id, onClose }: OtFormPrintViewProps) {
    const t = useTranslations("Attendance.OtFormPrint");
    const [form, setForm] = useState<OtFormDto | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [manualPaperSize, setManualPaperSize] = useState<PaperSize>("a4");
    // Chỉ tự động chọn khổ giấy lần đầu (khi vừa tải xong đơn) — sau khi người dùng đã bấm chọn tay
    // 1 lần thì tôn trọng lựa chọn đó, không tự đổi lại nữa dù state form có thay đổi.
    const [paperSizeTouched, setPaperSizeTouched] = useState(false);
    const { setting } = useAttendanceSetting();

    useEffect(() => {
        OtFormApi.getOtFormById(id)
            .then(setForm)
            .catch((err) => {
                console.error(err);
                setError(getApiErrorMessage(err, t("loadError")));
            });
    }, [id, t]);

    // Người đã bị loại khỏi đơn (docs §4.5a) KHÔNG được in — họ không còn nằm trong đơn được duyệt.
    // form.employees vẫn trả về cả 2 loại (để màn chi tiết trong app giữ được dấu vết), nên bản in
    // phải tự lọc ra danh sách thật sự cần in.
    const printableEmployees = form ? form.employees.filter((employee) => !employee.isRemoved) : [];

    // Đơn có số nhân viên vừa đủ trong 1 mặt A5 (<= sức chứa trang 2 A5) thì tự động chọn A5 để tiết
    // kiệm giấy — đơn nhiều người hơn thì giữ mặc định A4. Tính trực tiếp trong render (không qua
    // effect+state riêng) — chỉ dùng state cho lựa chọn THỦ CÔNG của người dùng.
    const autoPaperSize: PaperSize = printableEmployees.length <= EMPLOYEE_PAGE_CAPACITY.a5.rest ? "a5" : "a4";
    const paperSize = paperSizeTouched ? manualPaperSize : autoPaperSize;

    function selectPaperSize(size: PaperSize) {
        setPaperSizeTouched(true);
        setManualPaperSize(size);
    }

    if (error) {
        return <div className="p-8 text-sm text-[#930006]">{error}</div>;
    }

    if (!form) {
        return <div className="p-8 text-sm text-[#5e3f3a]">{t("loading")}</div>;
    }

    const rejectHistory = form.approvalHistories.find((item) => item.action === 2) ?? null;
    const isA5 = paperSize === "a5";
    const employeePages = buildEmployeePages(printableEmployees, paperSize);

    // Danh sách trang in thật (mỗi phần tử = đúng 1 ảnh nền = đúng 1 trang giấy). Khổ A4: trang 1 dùng
    // CHUNG ảnh nền cho cả phần đầu (ký duyệt/thông tin) lẫn 10 nhân viên đầu — không tách 2 <img>
    // riêng cho cùng 1 trang giấy. Khổ A5: trang 1 (mặt trước, chỉ phần đầu) luôn có, trang 2 (mặt
    // sau, danh sách nhân viên) chỉ thêm khi có nhân viên.
    const headerLayout = HEADER_LAYOUTS[paperSize];
    const printPages: { key: string; image: string; aspect: string; content: React.ReactNode }[] = isA5
        ? [
              { key: "header", image: headerLayout.image, aspect: headerLayout.aspect, content: <FormHeaderFields form={form} paperSize={paperSize} /> },
              ...employeePages.map((chunk, index) => ({
                  key: `emp-${index}`,
                  image: A5_PAGE2_EMPLOYEE.image,
                  aspect: A5_PAGE2_EMPLOYEE.aspect,
                  content: <EmployeeRowFields layout={A5_PAGE2_EMPLOYEE} employees={chunk} setting={setting} />,
              })),
          ]
        : [
              {
                  key: "page1",
                  image: headerLayout.image,
                  aspect: headerLayout.aspect,
                  content: (
                      <>
                          <FormHeaderFields form={form} paperSize={paperSize} />
                          <EmployeeRowFields layout={A4_PAGE1_EMPLOYEE} employees={employeePages[0] ?? []} setting={setting} />
                      </>
                  ),
              },
              ...employeePages.slice(1).map((chunk, index) => ({
                  key: `emp-${index}`,
                  image: A4_PAGE2_EMPLOYEE.image,
                  aspect: A4_PAGE2_EMPLOYEE.aspect,
                  content: <EmployeeRowFields layout={A4_PAGE2_EMPLOYEE} employees={chunk} setting={setting} />,
              })),
          ];

    return (
        <div className="bg-[#f2f4f6] py-6 print:bg-white print:py-0">
            {/* @page phải khớp CHÍNH XÁC kích thước thật của ảnh nền (612x792pt ~ 8.5x11in cho file A4 —
                bản thân file .doc gốc dùng khổ Letter chứ không phải ISO A4 dù tên file ghi "A4"; A5
                landscape đúng khổ ISO 210x148mm) và margin = 0 — ảnh nền đã có sẵn lề riêng của nó (từ
                chính file .doc/.pdf gốc), cộng thêm margin ở @page sẽ làm ảnh bị co lại lệch tỉ lệ so với
                khung trang thật, gây tràn/mất phần cuối trang (footer) hoặc sinh trang trắng thừa khi in. */}
            <style>{`@page { size: ${isA5 ? "210mm 148mm" : "8.5in 11in"}; margin: 0; }`}</style>

            <div className="no-print print:hidden mx-auto mb-4 max-w-4xl space-y-2">
                <div className="flex flex-col gap-3 rounded-lg border border-[#e0e3e5] bg-white px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">{t("paperSizeLabel")}</span>
                        <button
                            onClick={() => selectPaperSize("a4")}
                            className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-semibold transition ${
                                paperSize === "a4"
                                    ? "border-[#e3000f] bg-[#fff4f2] text-[#e3000f]"
                                    : "border-[#e0e3e5] bg-white text-[#191c1e] hover:bg-[#f2f4f6]"
                            }`}
                        >
                            <RectangleVertical className="h-4 w-4" /> {t("paperSizeA4Short")}
                        </button>
                        <button
                            onClick={() => selectPaperSize("a5")}
                            className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-semibold transition ${
                                paperSize === "a5"
                                    ? "border-[#e3000f] bg-[#fff4f2] text-[#e3000f]"
                                    : "border-[#e0e3e5] bg-white text-[#191c1e] hover:bg-[#f2f4f6]"
                            }`}
                        >
                            <RectangleHorizontal className="h-4 w-4" /> {t("paperSizeA5Short")}
                        </button>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => window.print()}
                            className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-[#e3000f] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#b40009]"
                        >
                            <Printer className="h-4 w-4" /> {t("printButton")}
                        </button>
                        {onClose && (
                            <button
                                onClick={onClose}
                                className="cursor-pointer rounded-lg p-2 text-[#5e3f3a] transition hover:bg-[#f2f4f6]"
                                aria-label="Close"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        )}
                    </div>
                </div>
                {/* Chú thích sức chứa của khổ đang chọn — tách khỏi label nút để nút gọn, không bị xuống
                    dòng/vỡ layout như trước (giữ nguyên nội dung text cũ, chỉ đổi chỗ hiển thị). */}
                <p className="px-1 text-xs text-[#8a8f94]">{isA5 ? t("paperSizeA5") : t("paperSizeA4")}</p>
            </div>

            <div className="mx-auto max-w-4xl bg-white p-6 print:p-0 print:shadow-none shadow-sm">
                {printPages.map((page, index) => (
                    <div key={page.key} className={index > 0 ? "break-before-page" : undefined}>
                        <PageFrame image={page.image} aspect={page.aspect} alt="Giấy đề nghị làm ngoài giờ">
                            {page.content}
                        </PageFrame>
                    </div>
                ))}

                {rejectHistory && (
                    <p className="mt-3 text-sm text-[#930006]">
                        {t("rejectedBy", { name: rejectHistory.approverFullName ?? rejectHistory.approverUserName, comment: rejectHistory.comment ?? "" })}
                    </p>
                )}
            </div>
        </div>
    );
}
