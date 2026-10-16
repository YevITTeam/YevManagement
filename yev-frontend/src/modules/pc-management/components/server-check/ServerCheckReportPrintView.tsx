import type { ServerCheckManualItemDto, ServerCheckReportRowDto } from "@/modules/pc-management/types/server-check.dto";

interface ServerCheckReportPrintViewProps {
    rows: ServerCheckReportRowDto[];
    manualColumns: ServerCheckManualItemDto[];
    fromDate: string;
    toDate: string;
    branchName: string | null;
    isOffDay: (day: string) => boolean;
}

const formatDate = (value: string) => new Date(value).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });

const cellText = (status: boolean | null) => (status === null ? "" : status ? "OK" : "NG");

// Gộp mọi lý do NG trong ngày vào 1 ô "Ghi chú" — cùng logic với ServerCheckService.ExportReportAsync
// bên BE (asset-module.md §1.19) để bản in web và file Excel xuất ra đọc giống nhau.
export function buildNote(row: ServerCheckReportRowDto): string {
    const parts: string[] = [];
    if (row.serverStatus === false) parts.push(`Đèn báo Server: ${row.serverNote}`);
    if (row.networkStatus === false) parts.push(`Đèn báo Network: ${row.networkNote}`);
    if (row.upsStatus === false) parts.push(`Đèn báo UPS: ${row.upsNote}`);
    if (row.airConditionerStatus === false) parts.push(`Máy lạnh: ${row.airConditionerNote}`);
    row.manualResults
        .filter((m) => m.status === 2)
        .forEach((m) => parts.push(m.note ? `${m.manualItemName}: ${m.note}` : m.manualItemName));
    return parts.join("; ");
}

export interface DayRow {
    key: string;
    day: string;
    row: ServerCheckReportRowDto | null;
}

// One line per calendar day in the range; days without a session keep row = null so the sheet shows them blank.
// Off days are dropped only when empty, so a scan done on a day off is never hidden.
export function buildDayRows(
    rows: ServerCheckReportRowDto[],
    fromDate: string,
    toDate: string,
    isOffDay?: (day: string) => boolean
): DayRow[] {
    const rowsByDay = new Map<string, ServerCheckReportRowDto[]>();
    rows.forEach((r) => {
        const day = r.checkDate.slice(0, 10);
        rowsByDay.set(day, [...(rowsByDay.get(day) ?? []), r]);
    });
    const [fy, fm, fd] = fromDate.slice(0, 10).split("-").map(Number);
    const [ty, tm, td] = toDate.slice(0, 10).split("-").map(Number);
    const endTime = Date.UTC(ty, tm - 1, td);
    const result: DayRow[] = [];
    for (let t = Date.UTC(fy, fm - 1, fd); t <= endTime; t += 86_400_000) {
        const day = new Date(t).toISOString().slice(0, 10);
        const dayRows = rowsByDay.get(day) ?? [];
        if (dayRows.length === 0) {
            if (!isOffDay?.(day)) result.push({ key: day, day, row: null });
        }
        else dayRows.forEach((row) => result.push({ key: `${day}-${row.sessionId}`, day, row }));
    }
    return result;
}

const th = "border border-black px-1 py-1 text-center font-semibold align-middle";
const td = "border border-black px-1 py-px text-center align-top leading-tight";

// Bản in khớp layout tờ giấy gốc "YEV–22–CV–IT-QD-810-FR-Check Sheet KT" (xem file mẫu
// docs/Check sheet kiem tra hang ngay IT.xlsx, cũng là file BE dùng để xuất Excel — 7d.9
// asset-module.md §4) — KHÔNG dùng lại bảng tương tác trên màn hình (cột "Ngày" sticky, nút "Xem chi
// tiết"...) vì đó là bảng để THAO TÁC, còn đây là bản để IN, cần đúng cấu trúc 2 nhóm cột merge
// (Phòng Server / Các kiểm tra khác) như tờ giấy. `hidden print:block` — chỉ hiện khi in, màn hình
// vẫn dùng bảng tương tác cũ (đã có `print:hidden` ở section bọc ngoài).
export default function ServerCheckReportPrintView({ rows, manualColumns, fromDate, toDate, branchName, isOffDay }: ServerCheckReportPrintViewProps) {
    // manualColumns[0] = "Tình trạng âm thanh, mùi, nhiệt độ" thuộc nhóm "Phòng Server" trên tờ giấy;
    // các mục còn lại (Network Factory/Server, Gởi nhận Mail, Backup x3) thuộc nhóm "Các kiểm tra
    // khác" — vị trí cố định theo DisplayOrder đã seed (asset-module.md §1.19), không đoán theo tên.
    const [ambientColumn, ...otherColumns] = manualColumns;
    const otherColumnsCount = otherColumns.length || 1;

    const from = new Date(fromDate);
    const to = new Date(toDate);
    const singleMonth = from.getFullYear() === to.getFullYear() && from.getMonth() === to.getMonth();
    const printRows = buildDayRows(rows, fromDate, toDate, isOffDay);

    return (
        <div className="hidden print:block text-black">
            <style>{`@page { size: A4 landscape; margin: 8mm; }`}</style>

            <div className="mb-2 flex items-start justify-between">
                <div className="flex-1 text-center">
                    <p className="text-base font-bold">CHECK SHEET KIỂM TRA HÀNG NGÀY CỦA IT</p>
                    <p className="text-sm">ITの日常的なチェックシート</p>
                </div>
                <div className="w-40 shrink-0 text-xs">
                    {/* 1 tờ = 1 xưởng (phiên quét theo xưởng, asset-module.md §1.21) nên điền tên xưởng đang lọc. */}
                    <p>Nhà xưởng 工場: {branchName ?? "……………"}</p>
                    <p>Tháng 月: {singleMonth ? from.getMonth() + 1 : "-"}</p>
                    <p>Năm 年: {singleMonth ? from.getFullYear() : "-"}</p>
                </div>
            </div>
            <p className="mb-2 text-center text-[10px]">
                Phải hoàn thành việc kiểm tra trước 8:20 mỗi ngày - 毎日 8:20 まで確認することが完了必要
            </p>

            <table className="w-full border-collapse text-[9px]">
                <thead>
                    <tr>
                        <th rowSpan={3} className={th}>
                            Ngày kiểm tra
                            <br />
                            確認日
                        </th>
                        <th colSpan={4 + (ambientColumn ? 1 : 0)} className={th}>
                            Phòng Server サーバールーム
                        </th>
                        <th colSpan={otherColumnsCount} className={th}>
                            Các kiểm tra khác 他の確認
                        </th>
                        <th rowSpan={3} className={th}>
                            Người kiểm
                            <br />
                            確認者
                        </th>
                        <th rowSpan={3} className={th}>
                            Ghi chú
                            <br />
                            備考
                        </th>
                    </tr>
                    <tr>
                        <th colSpan={3} className={th}>
                            Đèn cảnh báo 警告灯
                        </th>
                        <th rowSpan={2} className={th}>
                            Máy lạnh
                            <br />
                            エアコン
                        </th>
                        {ambientColumn && (
                            <th rowSpan={2} className={th}>
                                {ambientColumn.name}
                            </th>
                        )}
                        {otherColumns.length > 0 ? (
                            otherColumns.map((col) => (
                                <th key={col.id} rowSpan={2} className={th}>
                                    {col.name}
                                </th>
                            ))
                        ) : (
                            <th rowSpan={2} className={th} />
                        )}
                    </tr>
                    <tr>
                        <th className={th}>Server</th>
                        <th className={th}>Network</th>
                        <th className={th}>UPS</th>
                    </tr>
                </thead>
                <tbody>
                    {printRows.map(({ key, day, row }) => (
                        <tr key={key}>
                            <td className={td}>{formatDate(day)}</td>
                            <td className={td}>{row ? cellText(row.serverStatus) : ""}</td>
                            <td className={td}>{row ? cellText(row.networkStatus) : ""}</td>
                            <td className={td}>{row ? cellText(row.upsStatus) : ""}</td>
                            <td className={td}>{row ? cellText(row.airConditionerStatus) : ""}</td>
                            {ambientColumn && (
                                <td className={td}>
                                    {(() => {
                                        const match = row?.manualResults.find((m) => m.manualItemId === ambientColumn.id);
                                        return match ? cellText(match.status === 1) : "";
                                    })()}
                                </td>
                            )}
                            {(otherColumns.length > 0 ? otherColumns : [null]).map((col, index) => {
                                if (!col) return <td key={index} className={td} />;
                                const match = row?.manualResults.find((m) => m.manualItemId === col.id);
                                return (
                                    <td key={col.id} className={td}>
                                        {match ? cellText(match.status === 1) : ""}
                                    </td>
                                );
                            })}
                            <td className={`${td} whitespace-nowrap`}>{row?.checkedBy ?? ""}</td>
                            <td className={`${td} text-left`}>{row ? buildNote(row) : ""}</td>
                        </tr>
                    ))}
                </tbody>
            </table>

            <div className="mt-2 text-[9px] leading-tight">
                <p>- Kiểm tra có không tình trạng bất thường về đèn cảnh báo của thiết bị, âm thanh, mùi, nhiệt độ...</p>
                <p>- Kiểm tra kết nối mạng giữa các xưởng Yev, của các Server,</p>
                <p>- Khi phát sinh bất thường, không được tự ý xử lý mà phải nhanh chóng báo cáo lên người quản lý</p>
                <p>- Người thực hiện cần báo cáo đến người quản lý vào cuối tháng</p>
            </div>

            <div className="mt-2 flex gap-8 text-[10px]">
                <div className="flex-1">
                    <p className="mb-6 font-semibold">PCD Manager</p>
                </div>
                <div className="flex-1">
                    <p className="mb-6 font-semibold">IT Leader</p>
                </div>
            </div>

            <p className="text-[8px] text-right">YEV–22–CV–IT-QD-012_QĐ-Form</p>
        </div>
    );
}
