"use client";

import { useState, useEffect } from "react";

import { OtFormApi } from "@/modules/attendance/api/ot-form.api";
import type { OtFormApprovalHistoryDto, OtFormDto, OtFormEmployeeDto } from "@/modules/attendance/types/ot-form.dto";
import { getApiErrorMessage } from "@/lib/apiError";

interface OtFormPrintViewProps {
    id: number;
}

type PaperSize = "a4" | "a5";

// A5 nhỏ hơn A4 nhiều — không đủ chỗ in cả phần đầu (chữ ký/thông tin) lẫn danh sách nhân viên trên
// cùng 1 mặt như A4, nên tách: mặt trước = phần đầu, mặt sau (in 2 mặt trên cùng 1 tờ) = danh sách,
// giới hạn 12 người khớp form giấy. A4 không giới hạn — nếu đơn có nhiều nhân viên hơn thì tự tràn
// trang tiếp theo (trình duyệt tự ngắt trang).
const A5_EMPLOYEE_CAPACITY = 12;

function formatDate(value: string) {
    if (!value) return "……………………";
    return new Date(value).toLocaleDateString("vi-VN");
}

function formatTime(value: string) {
    return value?.slice(0, 5) ?? "-";
}

const cell = "border border-black px-2 py-1 align-top";
const labelCell = `${cell} bg-[#f2f2f2] font-semibold whitespace-nowrap`;
// Ô lũy kế (Tháng/Năm) chỉ chứa 1 số ngắn — thu nhỏ chữ + padding để nhường không gian cho cột
// "Thời gian" và "Họ và tên" (theo yêu cầu người dùng, 2 cột này cần hiển thị rộng hơn).
const cellSm = "border border-black px-1 py-1 align-top text-[9px]";
const labelCellSm = `${cellSm} bg-[#f2f2f2] font-semibold whitespace-nowrap`;

// 5 ô ký theo mẫu giấy gốc YEV-22-024 (src/assets/file-samples/FormOT.xlsx, đối chiếu thêm bản PDF
// mới hơn src/assets/file-ot-form/FormOT.pdf) — thứ tự trên giấy đi từ cấp cao nhất xuống thấp nhất, NGƯỢC
// với thứ tự approvalLevel tăng dần dùng ở màn Chi tiết đơn. Bản Excel gốc (rev 3/2014) có thêm 1 cột ký
// "Quản lý bộ phận" ở đầu — trước đây bỏ khi in vì hệ thống không có dữ liệu cho cấp này; nay đúng là ô
// "Trưởng Bộ phận" (GroupHead, mới 2026-07-17, ký SAU Người đề nghị/TRƯỚC Trưởng phòng) nên thêm lại.
const SIGNATURE_COLUMNS: { level: number; labelVn: string; labelJp: string }[] = [
    { level: 3, labelVn: "Tổng Giám Đốc", labelJp: "社長" },
    { level: 2, labelVn: "Trưởng xưởng", labelJp: "工場長" },
    { level: 1, labelVn: "Trưởng phòng", labelJp: "部長" },
    { level: 4, labelVn: "Trưởng Bộ phận", labelJp: "課長" },
    { level: 0, labelVn: "Người đề nghị", labelJp: "作成者" },
];

function findHistory(histories: OtFormApprovalHistoryDto[], level: number) {
    return histories.find((item) => item.approvalLevel === level && item.action !== 2) ?? null;
}

// Ghi chú TH1/TH2/TH3 + dòng ban hành — nguyên văn từ mẫu giấy gốc (src/assets/file-ot-form/FormOT.pdf),
// là thông tin tĩnh của BẢN THÂN FORM (không đổi theo từng đơn) nên hard-code, không lấy từ OtCaseDto.
function FormFooterNotes() {
    return (
        <div className="mt-3 space-y-1 text-[8px] leading-tight text-black">
            <p>① TH1: Tăng ca ngày thường: Ký duyệt cấp Trưởng phòng　場合１：平日残業：部長以上がサイン</p>
            <p>② TH2: Tăng ca ngày nghỉ quy định/chủ nhật/Lễ: Ký duyệt cấp Trưởng xưởng　場合２：法定休日/日曜/祝日の残業：工場長がサイン</p>
            <p>③ TH3: Trường hợp lũy kế tăng ca trên 25 giờ/tháng, 300h/năm: Ký duyệt cấp TGĐ　場合３：月間の累計残業が月25時間、年間300時間を超える場合：社長の承認が必要</p>
            <p>※ TH2 và TH3: Các trưởng phòng chuẩn bị tài liệu giải trình trực tiếp cho TX, TGĐ　上記2と3の場合には各部長が資料を作成し社長・工場長に直接説明</p>
            <div className="mt-2 flex items-center justify-between border-t border-black pt-1 font-semibold">
                <span>YEV-22-024</span>
                <span>YEV</span>
                <span>Ban hành lần 5 改正日: 03/02/2024</span>
            </div>
        </div>
    );
}

// Danh sách nhân viên — dùng chung cho cả 2 khổ giấy. A5 pad thêm dòng trống cho đủ 12 dòng (giống
// bảng 10 dòng in sẵn trên form giấy gốc), A4 chỉ in đúng số nhân viên thật (rowCount = null).
function EmployeeTable({ employees, rowCount }: { employees: OtFormEmployeeDto[]; rowCount: number | null }) {
    const blankRows = rowCount !== null ? Math.max(0, rowCount - employees.length) : 0;
    return (
        <>
            <div className="mt-4 mb-2 text-center">
                <div className="text-base font-bold uppercase">Danh sách nhân viên làm ngoài giờ</div>
                <div className="text-sm">社員の残業一覧</div>
            </div>
            {/* border ngay trên <table> — tránh bug Chrome/Edge làm rớt viền phải khi in (đặc biệt dễ
                gặp với table-fixed + width %, làm tròn subpixel ở DPI in khác DPI màn hình). */}
            <table className="w-full table-fixed border-collapse border border-black">
                {/* Cố định tỉ lệ cột — nới rộng "Họ và tên"/"Thời gian", thu hẹp 2 ô lũy kế
                    (Tháng/Năm) vì mỗi ô chỉ chứa 1 số ngắn. */}
                <colgroup>
                    <col className="w-[5%]" />
                    <col className="w-[24%]" />
                    <col className="w-[12%]" />
                    <col className="w-[19%]" />
                    <col className="w-[8%]" />
                    <col className="w-[8%]" />
                    <col className="w-[24%]" />
                </colgroup>
                <thead>
                    <tr>
                        <th rowSpan={2} className={`${labelCell} text-center`}>
                            Stt
                        </th>
                        <th rowSpan={2} className={labelCell}>
                            Họ và tên
                            <br />
                            名前
                        </th>
                        <th rowSpan={2} className={labelCell}>
                            Mã NV
                            <br />
                            社員コード
                        </th>
                        <th rowSpan={2} className={labelCell}>
                            Thời gian
                            <br />
                            時間
                        </th>
                        {/* Tháng/Năm nằm CHUNG dòng "Lũy kế" (2 dòng header dùng rowSpan/colSpan), khớp
                            đúng bản PDF đính kèm — không tách thành 1 dòng header trống riêng như trước. */}
                        <th className={`${labelCellSm} text-center`} colSpan={2}>
                            Lũy kế (Tổng số giờ tăng
                            <br/>
                             ca trong năm)
                            <br />
                            残業累計
                        </th>
                        <th rowSpan={2} className={labelCell}>
                            Ghi chú
                            <br />
                            備考
                        </th>
                    </tr>
                    <tr>
                        <th className={`${labelCellSm} text-center`}>Tháng 月</th>
                        <th className={`${labelCellSm} text-center`}>Năm 年間</th>
                    </tr>
                </thead>
                <tbody>
                    {employees.map((employee, index) => (
                        <tr key={employee.employeeId}>
                            <td className={`${cell} text-center`}>{index + 1}</td>
                            <td className={cell}>{employee.fullName}</td>
                            <td className={cell}>{employee.employeeCode}</td>
                            <td className={cell}>
                                {formatTime(employee.startTime)} — {formatTime(employee.endTime)}
                            </td>
                            <td className={`${cellSm} text-center`}>{employee.monthToDate}</td>
                            <td className={`${cellSm} text-center`}>{employee.yearToDate}</td>
                            <td className={cell}>{employee.noteVn || ""}</td>
                        </tr>
                    ))}
                    {Array.from({ length: blankRows }, (_, i) => (
                        <tr key={`blank-${i}`}>
                            <td className={`${cell} text-center`}>{employees.length + i + 1}</td>
                            <td className={cell}>&nbsp;</td>
                            <td className={cell}></td>
                            <td className={cell}></td>
                            <td className={cellSm}></td>
                            <td className={cellSm}></td>
                            <td className={cell}></td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </>
    );
}

export default function OtFormPrintView({ id }: OtFormPrintViewProps) {
    const [form, setForm] = useState<OtFormDto | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [manualPaperSize, setManualPaperSize] = useState<PaperSize>("a4");
    // Chỉ tự động chọn khổ giấy lần đầu (khi vừa tải xong đơn) — sau khi người dùng đã bấm chọn tay
    // 1 lần thì tôn trọng lựa chọn đó, không tự đổi lại nữa dù state form có thay đổi.
    const [paperSizeTouched, setPaperSizeTouched] = useState(false);

    useEffect(() => {
        OtFormApi.getOtFormById(id)
            .then(setForm)
            .catch((err) => {
                console.error(err);
                setError(getApiErrorMessage(err, "Không thể tải đơn tăng ca để in."));
            });
    }, [id]);

    // Đơn có số nhân viên vừa đủ trong 1 mặt A5 (<= A5_EMPLOYEE_CAPACITY) thì tự động chọn A5 để tiết
    // kiệm giấy — đơn nhiều người hơn sức chứa 1 mặt A5 thì giữ mặc định A4. Tính trực tiếp trong
    // render (không qua effect+state riêng) — chỉ dùng state cho lựa chọn THỦ CÔNG của người dùng.
    const autoPaperSize: PaperSize = form && form.employees.length <= A5_EMPLOYEE_CAPACITY ? "a5" : "a4";
    const paperSize = paperSizeTouched ? manualPaperSize : autoPaperSize;

    function selectPaperSize(size: PaperSize) {
        setPaperSizeTouched(true);
        setManualPaperSize(size);
    }

    if (error) {
        return <div className="p-8 text-sm text-[#930006]">{error}</div>;
    }

    if (!form) {
        return <div className="p-8 text-sm text-[#5e3f3a]">Đang tải dữ liệu để in...</div>;
    }

    const processPart = form.processPart;
    const rejectHistory = form.approvalHistories.find((item) => item.action === 2) ?? null;
    const isA5 = paperSize === "a5";

    return (
        <div className="bg-[#f2f4f6] py-6 print:bg-white print:py-0">
            {/* @page phải set động theo khổ đang chọn — style thuần, không qua Tailwind (không có utility
                cho @page). A5 xoay ngang (landscape) — bề rộng khi đó ~210mm, gần bằng bề rộng A4 dọc, đủ
                chỗ hiển thị bảng ký duyệt/thông tin mà không phải thu nhỏ chữ. */}
            <style>{`@page { size: ${isA5 ? "A5 landscape" : "A4"}; margin: ${isA5 ? "8mm" : "12mm"}; }`}</style>

            <div className="no-print print:hidden mx-auto mb-4 flex max-w-4xl items-center justify-between rounded-lg border border-[#e0e3e5] bg-white px-4 py-3 shadow-sm">
                <div className="flex items-center gap-2 text-sm text-[#5e3f3a]">
                    <span className="font-semibold text-[#191c1e]">Khổ giấy:</span>
                    <button
                        onClick={() => selectPaperSize("a4")}
                        className={`cursor-pointer rounded-lg border px-3 py-1.5 font-semibold transition ${
                            paperSize === "a4"
                                ? "border-[#e3000f] bg-[#fff4f2] text-[#e3000f]"
                                : "border-[#e0e3e5] bg-white text-[#191c1e] hover:bg-[#f2f4f6]"
                        }`}
                    >
                        A4 (1 mặt, không giới hạn số người)
                    </button>
                    <button
                        onClick={() => selectPaperSize("a5")}
                        className={`cursor-pointer rounded-lg border px-3 py-1.5 font-semibold transition ${
                            paperSize === "a5"
                                ? "border-[#e3000f] bg-[#fff4f2] text-[#e3000f]"
                                : "border-[#e0e3e5] bg-white text-[#191c1e] hover:bg-[#f2f4f6]"
                        }`}
                    >
                        A5 ngang (2 mặt — mặt sau tối đa {A5_EMPLOYEE_CAPACITY} người)
                    </button>
                </div>
                <button
                    onClick={() => window.print()}
                    className="cursor-pointer rounded-lg bg-[#e3000f] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#b40009]"
                >
                    In
                </button>
            </div>

            <div className="mx-auto max-w-4xl bg-white p-6 text-[13px] text-black shadow-sm print:p-0 print:shadow-none">
                <div className="mb-2 flex items-center justify-between text-xs font-semibold">
                    <span>YAZAKI EDS VIETNAM,LTD.</span>
                </div>
                <div className="mb-4 text-center">
                    <div className="text-xl font-bold italic">GIẤY ĐỀ NGHỊ LÀM NGOÀI GIỜ</div>
                    <div className="text-lg font-bold tracking-[0.3em]">残業許可お願い</div>
                    
                </div>

                {/* Bảng ký duyệt */}
                {/* border ngay trên <table> (không chỉ dựa vào border của các ô) — tránh bug Chrome/Edge
                    làm rớt mất viền phải khi in do làm tròn subpixel ở DPI in khác DPI màn hình. */}
                <table className="w-full border-collapse border border-black">
                    <thead>
                        <tr>
                            {SIGNATURE_COLUMNS.map((col) => (
                                <th key={col.level} className={`${labelCell} text-center text-xs`}>
                                    {col.labelVn}
                                    <br />
                                    <span className="font-normal">{col.labelJp}</span>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            {SIGNATURE_COLUMNS.map((col) => {
                                const history = findHistory(form.approvalHistories, col.level);
                                return (
                                    <td key={col.level} className={`${cell} h-20 text-center align-middle`}>
                                        {history?.hasSignature && history.signatureImage ? (
                                            // eslint-disable-next-line @next/next/no-img-element -- base64 data URI, next/image không tối ưu được và cần width/height cố định trái với className fluid ở đây
                                            <img
                                                src={`data:image/png;base64,${history.signatureImage}`}
                                                alt={`Chữ ký ${history.approverFullName ?? history.approverUserName}`}
                                                className="mx-auto h-14 object-contain"
                                            />
                                        ) : null}
                                        {history && (
                                            <div className="text-[11px] text-[#333]">
                                                {history.approverFullName ?? history.approverUserName}
                                            </div>
                                        )}
                                    </td>
                                );
                            })}
                        </tr>
                    </tbody>
                </table>

                {/* Thông tin đơn */}
                <table className="mt-[-1px] w-full border-collapse border border-black">
                    <tbody>
                        <tr>
                            <td className={`${labelCell} w-1/4`}>工程名 (Tên công đoạn)</td>
                            <td className={cell} colSpan={3}>
                                {form.departmentNameVn} — {form.groupNameVn}
                            </td>
                        </tr>
                        <tr>
                            <td className={labelCell}>人員數 (Số lượng nhân viên)</td>
                            <td className={cell} colSpan={3}>
                                {form.numberOfEmployee} (kèm theo danh sách bên dưới)
                            </td>
                        </tr>
                        <tr>
                            <td className={labelCell}>責任者 (Người chịu trách nhiệm)</td>
                            <td className={cell} colSpan={3}>
                                {form.createdByFullName ?? form.createdByUserName}
                            </td>
                        </tr>
                        <tr>
                            <td className={labelCell}>時間 (Thời gian)</td>
                            <td className={cell}>
                                Từ {formatTime(form.startTime)} đến {formatTime(form.endTime)} ({form.totalHour}h)
                            </td>
                            <td className={`${labelCell} w-20`}>Ngày</td>
                            <td className={cell}>{formatDate(form.date)}</td>
                        </tr>
                    </tbody>
                </table>

                {/* Lý do + Phần xử lý */}
                <table className="mt-[-1px] w-full border-collapse border border-black">
                    <tbody>
                        <tr>
                            <td className={`${labelCell} w-20 text-center`}>
                                理由
                                <br />
                                Lý do
                            </td>
                            <td className={cell} colSpan={7}>
                                {form.reasonNameVn}
                                {form.subReason ? ` — ${form.subReason}` : ""}
                            </td>
                        </tr>
                        <tr>
                            <td rowSpan={3} className={`${labelCell} text-center`}>
                                処理欄
                                <br />
                                Phần xử lý
                            </td>
                            <td className={`${labelCell} text-center`} colSpan={2}>
                                軽食 (Ăn uống)
                            </td>
                            <td className={`${labelCell} text-center`} colSpan={2}>
                                バス (Xe đưa đón)
                            </td>
                            <td className={`${labelCell} text-center`} colSpan={2}>
                                Copy
                            </td>
                            <td className={`${labelCell} text-center`}>他 (Đề nghị khác)</td>
                        </tr>
                        <tr>
                            <td className={`${cell} text-center`}>食べる (Ăn)</td>
                            <td className={`${cell} text-center`}>食べない (Không ăn)</td>
                            <td className={`${cell} text-center`}>Có</td>
                            <td className={`${cell} text-center`}>Không</td>
                            <td className={`${cell} text-center`}>Có</td>
                            <td className={`${cell} text-center`}>Không</td>
                            <td rowSpan={2} className={cell}>
                                {processPart?.anotherSuggestionVn || ""}
                            </td>
                        </tr>
                        <tr>
                            {/* "Không"/mặc định luôn được tick khi mục tương ứng chưa bật (kể cả khi cả đơn
                                không có processPart) — chỉ ô "Có"/"Ăn" mới cần đúng true mới tick, tránh để
                                trống gây hiểu nhầm là "chưa xử lý" (yêu cầu người dùng). */}
                            <td className={`${cell} text-center text-base`}>{processPart?.isEat ? "✓" : ""}</td>
                            <td className={`${cell} text-center text-base`}>{!processPart?.isEat ? "✓" : ""}</td>
                            <td className={`${cell} text-center text-base`}>{processPart?.isTransportation ? "✓" : ""}</td>
                            <td className={`${cell} text-center text-base`}>{!processPart?.isTransportation ? "✓" : ""}</td>
                            <td className={`${cell} text-center text-base`}>{processPart?.isUseCopyRoom ? "✓" : ""}</td>
                            <td className={`${cell} text-center text-base`}>{!processPart?.isUseCopyRoom ? "✓" : ""}</td>
                        </tr>
                        {processPart?.isEat && (
                            <tr>
                                <td className={labelCell}>Phiếu ăn</td>
                                <td className={cell} colSpan={7}>
                                    Phiếu chính: {processPart.mainTicketCount} — Phiếu phụ: {processPart.secondaryTicketCount} — Sữa:{" "}
                                    {processPart.milkCount}
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>

                {/* A5: danh sách nhân viên bắt buộc sang mặt sau (trang in thứ 2 của cùng 1 tờ khi in 2
                    mặt) — A4: chỉ cần 1 mặt, danh sách nối tiếp ngay bên dưới, không giới hạn số dòng. */}
                <div className={isA5 ? "break-before-page" : ""}>
                    <EmployeeTable employees={form.employees} rowCount={isA5 ? A5_EMPLOYEE_CAPACITY : null} />
                </div>

                {rejectHistory && (
                    <p className="mt-3 text-sm text-[#930006]">
                        Đơn bị từ chối bởi {rejectHistory.approverFullName ?? rejectHistory.approverUserName}: &quot;{rejectHistory.comment}
                        &quot;
                    </p>
                )}

                <FormFooterNotes />
            </div>
        </div>
    );
}
