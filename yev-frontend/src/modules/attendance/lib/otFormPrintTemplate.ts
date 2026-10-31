// HTML template of the paper form YEV-22-024 (rev. 5, 03/02/2024), shared by the browser print view and the pdfmake export.
// Keep it inside what html-to-pdfmake understands: tables, inline font-size/weight/color/text-align/vertical-align/margin-top,
// <img> with max-width/max-height. Borders and paddings live in the renderers (print CSS / pdf table layout).
// No runtime imports on purpose, so the template also runs in a plain Node check.
import type { OtFormApprovalHistoryDto, OtFormDto, OtFormEmployeeDto } from "@/modules/attendance/types/ot-form.dto";

export type PaperSize = "a4" | "a5";

export interface PrintLimits {
    monthlyOtHourLimit: number;
    yearlyOtHourLimit: number;
}

export interface PageSpec {
    widthPt: number;
    heightPt: number;
    // [left, top, right, bottom], same order as pdfmake pageMargins.
    marginsPt: [number, number, number, number];
}

export const PAGE_SPECS: Record<PaperSize, PageSpec> = {
    a4: { widthPt: 595.28, heightPt: 841.89, marginsPt: [34, 26, 34, 20] },
    a5: { widthPt: 595.28, heightPt: 419.53, marginsPt: [26, 16, 26, 12] },
};

// Rows per page; A5 page 1 holds only the header block.
export const EMPLOYEE_PAGE_CAPACITY: Record<PaperSize, { first: number; rest: number }> = {
    a4: { first: 10, rest: 30 },
    a5: { first: 0, rest: 12 },
};

const JP_COLOR = "#1a1aff";
const OVER_LIMIT_COLOR = "#930006";

// Wording differs slightly between the official A4 and A5 sheets.
const LABELS: Record<PaperSize, Record<string, string>> = {
    a4: {
        titleJp: "残業申請書",
        requesterJp: "申請者",
        headcountJp: "人数",
        otherJp: "その他",
        listTitleJp: "社員の残業一覧",
        nameJp: "氏名",
        monthJp: "月間",
        accumulationJp: "年間残業累計",
        attachNoteJp: "（次のページにリストがある）",
    },
    a5: {
        titleJp: "残 業 許 可 お 願 い",
        requesterJp: "作成者",
        headcountJp: "人員数",
        otherJp: "他",
        listTitleJp: "社員の残業リスト",
        nameJp: "名前",
        monthJp: "月",
        accumulationJp: "残業累計",
        attachNoteJp: "",
    },
};

// Font sizes per paper; A5 is the same form squeezed into half the height.
const SIZES: Record<PaperSize, Record<string, number>> = {
    a4: {
        company: 10, title: 16, titleJp: 15, label: 10, value: 10, small: 7.5, list: 9, note: 7.5, footer: 9,
        sigHeader: 27, sigRow: 54, infoRow: 20, headcountRow: 24, timeRow: 30, reasonRow: 32, procHead: 17, procSub: 15, procValue: 40,
        listTitle: 12, empHead1: 22, empHead2: 15, gap: 8,
    },
    a5: {
        company: 8.5, title: 13, titleJp: 12, label: 8.5, value: 8.5, small: 6.5, list: 8, note: 6.5, footer: 8,
        sigHeader: 23, sigRow: 40, infoRow: 17, headcountRow: 18, timeRow: 26, reasonRow: 28, procHead: 14, procSub: 13, procValue: 30,
        listTitle: 11, empHead1: 20, empHead2: 14, gap: 6,
    },
};

const EMPLOYEE_ROW_HEIGHT: Record<PaperSize, { first: number; rest: number }> = {
    a4: { first: 17.5, rest: 22 },
    a5: { first: 0, rest: 17 },
};

const DATE_FORMAT: Intl.DateTimeFormatOptions = { day: "2-digit", month: "2-digit", year: "numeric" };

export function formatDate(value: string) {
    if (!value) return "";
    return new Date(value).toLocaleDateString("vi-VN", DATE_FORMAT);
}

export function formatTime(value: string) {
    return value?.slice(0, 5) ?? "-";
}

// "dd/mm/yyyy hh:mm" printed under each signature.
export function formatDateTime(value: string | null | undefined) {
    if (!value) return null;
    const d = new Date(value);
    return `${d.toLocaleDateString("vi-VN", DATE_FORMAT)} ${d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}`;
}

// Latest wins: a re-submitted form is signed again on the same step.
export function findHistory(histories: OtFormApprovalHistoryDto[], stepOrder: number) {
    return [...histories].reverse().find((item) => item.stepOrder === stepOrder && item.action !== 2) ?? null;
}

// The requester box is split between two signatures, so print only the given name to avoid overflow.
export function getGivenName(fullName: string | null | undefined) {
    if (!fullName) return fullName;
    const parts = fullName.trim().split(/\s+/);
    return parts[parts.length - 1];
}

// Production-line forms have no single group: distinct Team + Line + shift snapshots of non-removed employees.
export function getProductionCongDoanLabel(form: OtFormDto) {
    const active = form.employees.filter((e) => !e.isRemoved);
    const distinct = (values: (string | null)[]) => Array.from(new Set(values.filter((v): v is string => !!v)));
    return [
        distinct(active.map((e) => e.teamCodeSnapshot)).join("/"),
        distinct(active.map((e) => e.blockCodeSnapshot)).join("/"),
        distinct(active.map((e) => e.shiftTeamCodeSnapshot)).join("/"),
    ]
        .filter(Boolean)
        .join("   ");
}

export function getSignatureDataUrl(signatureImage: string | null | undefined): string | null {
    if (!signatureImage) return null;
    const trimmed = signatureImage.trim();
    if (trimmed.startsWith("data:")) return trimmed;
    return `data:${trimmed.startsWith("/9j") ? "image/jpeg" : "image/png"};base64,${trimmed}`;
}

export type SignatureDisplay = Pick<OtFormApprovalHistoryDto, "approverFullName" | "approverUserName" | "hasSignature" | "signatureImage" | "actionAt"> &
    Partial<Pick<OtFormApprovalHistoryDto, "onBehalfOfFullName" | "onBehalfOfUserName">>;

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

function esc(value: string | number | null | undefined) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

const CJK = /[　-ヿ㐀-鿿＀-￯]/;

// Width estimate in em; deliberately a bit generous so both renderers fit (they use different fonts).
function estimateEm(text: string) {
    let em = 0;
    for (const ch of text) {
        if (CJK.test(ch)) em += 1;
        else if (/\p{Lu}/u.test(ch)) em += 0.74;
        else if (ch === " ") em += 0.3;
        else em += 0.58;
    }
    return em;
}

// Largest size in [minPt, basePt] that keeps the text on one line; single-line cells never wrap.
function fitPt(text: string, availPt: number, basePt: number, minPt = basePt * 0.55) {
    const em = estimateEm(text);
    if (em === 0) return basePt;
    return Math.max(minPt, Math.min(basePt, Math.floor((availPt / em) * 10) / 10));
}

function jp(text: string, sizePt?: number) {
    if (!text) return "";
    return `<span class="otp-jp" style="color:${JP_COLOR};${sizePt ? `font-size:${sizePt}pt;` : ""}">${esc(text)}</span>`;
}

interface Cell {
    html: string;
    colspan?: number;
    rowspan?: number;
    align?: "left" | "center" | "right";
    valign?: "top" | "middle" | "bottom";
    nowrap?: boolean;
}

interface Row {
    heightPt: number | "auto";
    cells: Cell[];
}

// One table = one source for both renderers: <colgroup>/row heights for the browser, data-pdfmake widths/heights for pdfmake.
function table(widthsPt: number[], rows: Row[], opts: { borders?: boolean; marginTopPt?: number } = {}) {
    const borders = opts.borders ?? true;
    const pdf: Record<string, unknown> = { widths: widthsPt.map((w) => round(w)), heights: rows.map((r) => r.heightPt) };
    if (!borders) pdf.layout = "noBorders";
    const cols = widthsPt.map((w) => `<col style="width:${round(w)}pt">`).join("");
    const body = rows
        .map((row) => {
            const tds = row.cells
                .map((c) => {
                    const attrs = `${c.colspan ? ` colspan="${c.colspan}"` : ""}${c.rowspan ? ` rowspan="${c.rowspan}"` : ""}`;
                    const style = `text-align:${c.align ?? "left"};vertical-align:${c.valign ?? "middle"};${c.nowrap ? "white-space:nowrap;" : ""}`;
                    return `<td${attrs} style="${style}">${c.html}</td>`;
                })
                .join("");
            return `<tr${row.heightPt === "auto" ? "" : ` style="height:${row.heightPt}pt"`}>${tds}</tr>`;
        })
        .join("");
    const margin = opts.marginTopPt ? `margin-top:${opts.marginTopPt}pt;` : "";
    return `<table class="${borders ? "otp-grid" : "otp-plain"}" style="${margin}" data-pdfmake='${JSON.stringify(pdf)}'><colgroup>${cols}</colgroup><tbody>${body}</tbody></table>`;
}

function round(n: number) {
    return Math.round(n * 100) / 100;
}

function scaleWidths(ratios: number[], totalPt: number) {
    const sum = ratios.reduce((a, b) => a + b, 0);
    return ratios.map((r) => (r / sum) * totalPt);
}

function contentWidth(paperSize: PaperSize) {
    const spec = PAGE_SPECS[paperSize];
    return spec.widthPt - spec.marginsPt[0] - spec.marginsPt[2];
}

function bilingualHeader(vn: string, jpText: string, sizePt: number) {
    return `<div style="font-size:${sizePt}pt;text-align:center">${esc(vn)}</div><div style="font-size:${sizePt}pt;text-align:center">${jp(jpText)}</div>`;
}

function signatureHtml(history: SignatureDisplay | null, widthPt: number, rowPt: number, nameOnly: boolean) {
    if (!history) return "";
    const displayName = history.approverFullName ?? history.approverUserName ?? "";
    const name = (nameOnly ? getGivenName(displayName) : displayName) ?? "";
    const onBehalf = history.onBehalfOfFullName ?? history.onBehalfOfUserName;
    const onBehalfText = onBehalf ? `(thay mặt ${nameOnly ? getGivenName(onBehalf) : onBehalf})` : "";
    const signedAt = formatDateTime(history.actionAt) ?? "";
    const dataUrl = history.hasSignature ? getSignatureDataUrl(history.signatureImage) : null;
    const avail = widthPt - 6;
    const textLines = 1 + (onBehalfText ? 1 : 0) + (signedAt ? 1 : 0);
    const imgMaxH = Math.max(12, rowPt - 6 - textLines * 8);
    const parts = [
        dataUrl ? `<div style="text-align:center"><img src="${esc(dataUrl)}" style="max-width:${round(avail * 0.9)}pt;max-height:${round(imgMaxH)}pt"></div>` : "",
        name ? `<div style="text-align:center;white-space:nowrap;font-weight:bold;font-size:${fitPt(name, avail, 7, 5)}pt">${esc(name)}</div>` : "",
        onBehalfText ? `<div style="text-align:center;white-space:nowrap;font-size:${fitPt(onBehalfText, avail, 5.5, 4)}pt">${esc(onBehalfText)}</div>` : "",
        signedAt ? `<div style="text-align:center;white-space:nowrap;font-size:5.5pt">${esc(signedAt)}</div>` : "",
    ];
    return parts.join("");
}

function headerBlock(form: OtFormDto, paperSize: PaperSize) {
    const L = LABELS[paperSize];
    const S = SIZES[paperSize];
    const W = contentWidth(paperSize);

    // Final-level boxes are fixed job titles (TerminalLevelSnapshot 3/2/1) while intermediate steps vary.
    const finalSignature = (level: number) => {
        const step = form.approvalSteps.find((s) => s.terminalLevelSnapshot === level);
        return step ? findHistory(form.approvalHistories, step.stepOrder) : null;
    };

    // Only mandatory-signature intermediate steps go in the requester box (capped at 1-2 by GroupApprovalStepService).
    const intermediate = form.approvalSteps.filter((s) => s.terminalLevelSnapshot === 0 && s.requiresSignatureSnapshot);
    // No intermediate step left (creator ranks at or above them): the creator self-signs with the CreatorSignatureImage snapshot.
    const selfSign: SignatureDisplay | null = form.creatorSignatureImage
        ? {
              approverFullName: form.createdByFullName,
              approverUserName: form.createdByUserName,
              hasSignature: true,
              signatureImage: form.creatorSignatureImage,
              actionAt: form.createdAt,
          }
        : null;
    const firstRequester = intermediate[0]
        ? findHistory(form.approvalHistories, intermediate[0].stepOrder)
        : intermediate.length === 0
        ? selfSign
        : null;
    const isSingleRequester = intermediate.length <= 1;
    const lastRequester = isSingleRequester ? null : findHistory(form.approvalHistories, intermediate[intermediate.length - 1].stepOrder);

    const sigWidths = scaleWidths([21.45, 22.75, 23.49, 9.91, 9.91], W);
    const requesterCells: Cell[] = isSingleRequester
        ? [{ html: signatureHtml(firstRequester, sigWidths[3] + sigWidths[4], S.sigRow, false), colspan: 2, align: "center" }]
        : [
              { html: signatureHtml(firstRequester, sigWidths[3], S.sigRow, true), align: "center" },
              { html: signatureHtml(lastRequester, sigWidths[4], S.sigRow, true), align: "center" },
          ];
    const signatureTable = table(
        sigWidths,
        [
            {
                heightPt: S.sigHeader,
                cells: [
                    { html: bilingualHeader("Tổng giám đốc", "社長", S.label), align: "center" },
                    { html: bilingualHeader("Trưởng xưởng", "工場長", S.label), align: "center" },
                    { html: bilingualHeader("Trưởng phòng", "部長", S.label), align: "center" },
                    { html: bilingualHeader("Người đề nghị", L.requesterJp, S.label), colspan: 2, align: "center" },
                ],
            },
            {
                heightPt: S.sigRow,
                cells: [
                    { html: signatureHtml(finalSignature(3), sigWidths[0], S.sigRow, false), align: "center" },
                    { html: signatureHtml(finalSignature(2), sigWidths[1], S.sigRow, false), align: "center" },
                    { html: signatureHtml(finalSignature(1), sigWidths[2], S.sigRow, false), align: "center" },
                    ...requesterCells,
                ],
            },
        ],
        { marginTopPt: S.gap + 4 }
    );

    // The step Admin flagged IsResponsible; falls back to the creator while unsigned or unconfigured.
    const responsibleStep = form.approvalSteps.find((s) => s.isResponsibleSnapshot);
    const responsible = responsibleStep ? findHistory(form.approvalHistories, responsibleStep.stepOrder) : null;
    const responsibleName = responsible?.approverFullName ?? responsible?.approverUserName ?? form.createdByFullName ?? form.createdByUserName ?? "";
    const congDoan = form.isProductionForm ? getProductionCongDoanLabel(form) : `${form.departmentNameVn} — ${form.groupNameVn ?? ""}`;

    const infoWidths = [W * 0.31, W * 0.69];
    const valueAvail = infoWidths[1] - 8;
    const value = (text: string) =>
        `<span style="font-weight:bold;white-space:nowrap;font-size:${fitPt(text, valueAvail, S.value + 1)}pt">${esc(text)}</span>`;
    const label = (vn: string, jpText: string) => `<span style="font-size:${S.label}pt">${esc(vn)} ${jp(jpText)}</span>`;
    const attachNote = `<div style="text-align:right;font-size:${S.small}pt">(Kèm theo danh sách ở trang sau)</div>${
        L.attachNoteJp ? `<div style="text-align:right;font-size:${S.small}pt">${jp(L.attachNoteJp)}</div>` : ""
    }`;
    const timeLine1 = `<div style="font-size:${S.label}pt">Từ ${jp("から")} <span style="font-weight:bold">${esc(formatTime(form.startTime))}</span>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Đến ${jp("まで")} <span style="font-weight:bold">${esc(`${formatTime(form.endTime)} (${form.totalHour}h)`)}</span></div>`;
    const timeLine2 = `<div style="font-size:${S.label}pt">Ngày ${jp("日付")} <span style="font-weight:bold">${esc(formatDate(form.date))}</span></div>`;
    const infoTable = table(
        infoWidths,
        [
            { heightPt: S.infoRow, cells: [{ html: label("Tên công đoạn", "工程名") }, { html: value(congDoan), nowrap: true }] },
            {
                heightPt: S.headcountRow,
                cells: [
                    { html: label("Số lượng nhân viên", L.headcountJp) },
                    {
                        html: table(
                            [valueAvail * 0.35, valueAvail * 0.65],
                            [{ heightPt: "auto", cells: [{ html: value(String(form.numberOfEmployee)) }, { html: attachNote, align: "right" }] }],
                            { borders: false }
                        ),
                    },
                ],
            },
            { heightPt: S.infoRow, cells: [{ html: label("Người chịu trách nhiệm", "責任者") }, { html: value(responsibleName), nowrap: true }] },
            { heightPt: S.timeRow, cells: [{ html: label("Thời gian", "時間") }, { html: timeLine1 + timeLine2 }] },
        ],
        { marginTopPt: S.gap }
    );

    const processPart = form.processPart;
    const tick = (on: boolean | undefined) => (on ? `<span style="font-size:${S.value + 4}pt">✓</span>` : "");
    const eatCounts = processPart?.isEat
        ? [`P.Chính: ${processPart.mainTicketCount}`, `P.Phụ: ${processPart.secondaryTicketCount}`, `P.Sữa: ${processPart.milkCount}`]
              .map((t) => `<div style="font-size:7pt;font-weight:bold;text-align:center;white-space:nowrap">${esc(t)}</div>`)
              .join("")
        : "";
    const procWidths = scaleWidths([5.29, 13.99, 13.97, 9.64, 10.74, 9.03, 9.13, 15.87], W);
    const reasonVn = `${form.reasonNameVn}${form.subReason ? ` — ${form.subReason}` : ""}`;
    const reasonAvail = W - procWidths[0] - 8;
    // Reason may wrap; shrink until the estimated lines fit the row.
    let reasonPt = S.value + 0.5;
    const reasonFits = (pt: number) => {
        const lines = (txt: string, size: number) => (txt ? Math.ceil((estimateEm(txt) * size) / reasonAvail) : 0);
        return (lines(reasonVn, pt) + lines(form.reasonNameJp ?? "", pt * 0.85)) * pt * 1.25 <= S.reasonRow - 2;
    };
    while (reasonPt > 5.5 && !reasonFits(reasonPt)) reasonPt -= 0.5;
    const reasonHtml = `<div style="font-size:${reasonPt}pt">${esc(reasonVn)}</div>${
        form.reasonNameJp ? `<div style="font-size:${round(reasonPt * 0.85)}pt">${jp(form.reasonNameJp)}</div>` : ""
    }`;
    const other = processPart?.anotherSuggestionVn ?? "";
    const sub = (vn: string, jpText: string) => `<span style="font-size:${S.label - 1.5}pt">${esc(vn)} ${jp(jpText)}</span>`;
    const procTable = table(
        procWidths,
        [
            {
                heightPt: S.reasonRow,
                cells: [
                    { html: `<div style="font-size:${S.label}pt">Lý do</div><div style="font-size:${S.label}pt">${jp("理由")}</div>`, valign: "top" },
                    { html: reasonHtml, colspan: 7 },
                ],
            },
            {
                heightPt: S.procHead,
                cells: [
                    {
                        html: `<div style="font-size:${S.label}pt">Phần xử lý</div><div style="font-size:${S.label}pt">${jp("処理欄")}</div>`,
                        rowspan: 3,
                        valign: "top",
                    },
                    { html: sub("Ăn uống", "軽食"), colspan: 2, align: "center" },
                    { html: sub("Xe đưa đón", "バス"), colspan: 2, align: "center" },
                    { html: sub("Copy", "コピー"), colspan: 2, align: "center" },
                    {
                        html: `<span style="font-size:${fitPt(`Đề nghị khác ${L.otherJp}`, procWidths[7] - 7, S.label - 1.5)}pt">${esc("Đề nghị khác")} ${jp(L.otherJp)}</span>`,
                        rowspan: 2,
                        align: "center",
                        nowrap: true,
                    },
                ],
            },
            {
                heightPt: S.procSub,
                cells: [
                    { html: sub("Ăn", "食べる"), align: "center" },
                    { html: sub("Không ăn", "食べない"), align: "center" },
                    { html: sub("Có", "有"), align: "center" },
                    { html: sub("Không", "無"), align: "center" },
                    { html: sub("Có", "有"), align: "center" },
                    { html: sub("Không", "無"), align: "center" },
                ],
            },
            {
                heightPt: S.procValue,
                // Eating prints the ticket counts instead of a tick; "No" is ticked whenever the item is off.
                cells: [
                    { html: eatCounts, align: "center" },
                    { html: tick(!processPart?.isEat), align: "center" },
                    { html: tick(processPart?.isTransportation), align: "center" },
                    { html: tick(!processPart?.isTransportation), align: "center" },
                    { html: tick(processPart?.isUseCopyRoom), align: "center" },
                    { html: tick(!processPart?.isUseCopyRoom), align: "center" },
                    {
                        html: other ? `<span style="white-space:nowrap;font-size:${fitPt(other, procWidths[7] - 6, 8)}pt">${esc(other)}</span>` : "",
                        align: "center",
                    },
                ],
            },
        ],
        { marginTopPt: S.gap }
    );

    const titleBlock =
        `<div style="font-size:${S.company}pt">YAZAKI EDS VIETNAM CO., LTD.</div>` +
        `<div style="font-size:${S.title}pt;font-weight:bold;text-align:center">GIẤY ĐỀ NGHỊ LÀM NGOÀI GIỜ</div>` +
        `<div style="font-size:${S.titleJp}pt;text-align:center">${jp(L.titleJp)}</div>`;

    return titleBlock + signatureTable + infoTable + procTable;
}

function employeeTable(
    rows: OtFormEmployeeDto[],
    startIndex: number,
    rowCount: number,
    rowHeightPt: number,
    paperSize: PaperSize,
    limits: PrintLimits
) {
    const L = LABELS[paperSize];
    const S = SIZES[paperSize];
    const W = contentWidth(paperSize);
    const widths = scaleWidths([3.82, 25.02, 11.77, 13.24, 8.82, 8.82, 16.18], W);
    const head = (vn: string, jpText: string) => bilingualHeader(vn, jpText, S.list);
    const fit = (text: string, col: number) =>
        `<span style="font-size:${fitPt(text, widths[col] - 6, S.list)}pt">${esc(text)}</span>`;
    const accumulation = (hours: number, limit: number) =>
        hours > limit
            ? `<span style="font-weight:bold;text-decoration:underline;color:${OVER_LIMIT_COLOR};font-size:${S.list}pt">${hours}</span>`
            : `<span style="font-size:${S.list}pt">${hours}</span>`;

    const bodyRows: Row[] = Array.from({ length: rowCount }, (_, i) => {
        const e = rows[i];
        return {
            heightPt: rowHeightPt,
            cells: [
                { html: `<span style="font-size:${S.list}pt">${startIndex + i + 1}</span>`, align: "center" },
                { html: e ? fit(e.fullName, 1) : "", nowrap: true },
                { html: e ? fit(e.employeeCode, 2) : "", nowrap: true },
                { html: e ? fit(`${formatTime(e.startTime)} — ${formatTime(e.endTime)}`, 3) : "", nowrap: true },
                { html: e ? accumulation(e.monthToDate, limits.monthlyOtHourLimit) : "", align: "center" },
                { html: e ? accumulation(e.yearToDate, limits.yearlyOtHourLimit) : "", align: "center" },
                { html: e?.noteVn ? fit(e.noteVn, 6) : "", nowrap: true },
            ],
        };
    });

    return table(
        widths,
        [
            {
                heightPt: S.empHead1,
                cells: [
                    { html: `<span style="font-size:${S.list}pt">Stt</span>`, rowspan: 2, align: "center" },
                    { html: head("Họ và tên", L.nameJp), rowspan: 2, align: "center" },
                    { html: head("Mã NV", "社員コード"), rowspan: 2, align: "center" },
                    { html: head("Thời gian", "時間"), rowspan: 2, align: "center" },
                    {
                        html: `<div style="font-size:${S.small}pt;text-align:center">Lũy kế (tổng số giờ tăng ca trong năm)</div><div style="font-size:${S.small}pt;text-align:center">${jp(L.accumulationJp)}</div>`,
                        colspan: 2,
                        align: "center",
                    },
                    { html: head("Ghi chú", "備考"), rowspan: 2, align: "center" },
                ],
            },
            {
                heightPt: S.empHead2,
                cells: [
                    { html: `<span style="font-size:${S.small}pt">Tháng ${jp(L.monthJp)}</span>`, align: "center" },
                    { html: `<span style="font-size:${S.small}pt">Năm ${jp("年間")}</span>`, align: "center" },
                ],
            },
            ...bodyRows,
        ],
        { marginTopPt: 4 }
    );
}

function listTitle(paperSize: PaperSize, marginTopPt: number) {
    const S = SIZES[paperSize];
    return (
        `<div style="font-size:${S.listTitle}pt;font-weight:bold;text-align:center;margin-top:${marginTopPt}pt">DANH SÁCH NHÂN VIÊN LÀM NGOÀI GIỜ</div>` +
        `<div style="font-size:${S.listTitle}pt;text-align:center">${jp(LABELS[paperSize].listTitleJp)}</div>`
    );
}

function caseNotes(paperSize: PaperSize) {
    const size = SIZES[paperSize].note;
    const line = (vn: string, jpText: string) => `<div style="font-size:${size}pt;margin-top:2pt">${esc(vn)} ${jp(jpText)}</div>`;
    return (
        `<div style="margin-top:4pt"></div>` +
        line("① TH1: Tăng ca ngày thường: Ký duyệt cấp Trưởng phòng", "場合1：平日残業：部長以上がサイン") +
        line("② TH2: Tăng ca ngày nghỉ quy định/chủ nhật/Lễ: Ký duyệt cấp Trưởng xưởng", "場合2：法定休日/日曜/祝日の残業：工場長がサイン") +
        line(
            "③ TH3: Trường hợp lũy kế tăng ca trên 25 giờ/tháng, 300h/năm: Ký duyệt cấp TGĐ",
            "場合3：月間の累計残業が月25時間、年間300時間を超える場合：社長の承認が必要"
        ) +
        line("※TH2 và TH3: Các trưởng phòng chuẩn bị tài liệu giải trình trực tiếp cho TX, TGĐ", "上記2と3の場合には各部長が資料を作成し社長・工場長に直接説明")
    );
}

function footer(paperSize: PaperSize) {
    const size = SIZES[paperSize].footer;
    const W = contentWidth(paperSize);
    return table(
        [W * 0.35, W * 0.3, W * 0.35],
        [
            {
                heightPt: "auto",
                cells: [
                    { html: `<span style="font-size:${size}pt">YEV-22-024</span>` },
                    { html: `<span style="font-size:${size + 4}pt;font-weight:bold">YEV</span>`, align: "center" },
                    { html: `<span style="font-size:${size}pt">Ban hành lần 5 ${jp("改正日")}: 03/02/2024</span>`, align: "right" },
                ],
            },
        ],
        { borders: false, marginTopPt: 6 }
    );
}

// One HTML fragment per physical page (without the page box itself; each renderer adds its own).
export function renderOtFormPages(form: OtFormDto, paperSize: PaperSize, limits: PrintLimits): string[] {
    const printable = form.employees.filter((e) => !e.isRemoved);
    const chunks = buildEmployeePages(printable, paperSize);
    const capacity = EMPLOYEE_PAGE_CAPACITY[paperSize];
    const rowHeight = EMPLOYEE_ROW_HEIGHT[paperSize];
    const pages: string[] = [];

    if (paperSize === "a4") {
        pages.push(
            headerBlock(form, paperSize) +
                listTitle(paperSize, SIZES.a4.gap) +
                employeeTable(chunks[0] ?? [], 0, capacity.first, rowHeight.first, paperSize, limits) +
                caseNotes(paperSize) +
                footer(paperSize)
        );
    } else {
        pages.push(headerBlock(form, paperSize) + footer(paperSize));
    }

    const restChunks = paperSize === "a4" ? chunks.slice(1) : chunks;
    restChunks.forEach((chunk, index) => {
        const startIndex = capacity.first + index * capacity.rest;
        pages.push(
            listTitle(paperSize, 0) +
                employeeTable(chunk, startIndex, capacity.rest, rowHeight.rest, paperSize, limits) +
                (paperSize === "a5" ? caseNotes(paperSize) : "") +
                footer(paperSize)
        );
    });
    return pages;
}
