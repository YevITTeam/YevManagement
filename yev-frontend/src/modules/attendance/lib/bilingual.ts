import { createTranslator } from "next-intl";
import viMessages from "../../../../messages/vi.json";
import jaMessages from "../../../../messages/ja.json";

type BilingualTranslateValues = Record<string, string | number | Date>;

// Same purpose as the label maps below, but for next-intl message keys: builds "vi / ja" out of both
// message files directly instead of following the active locale, so static UI text on the OT-form
// email confirm page reads bilingual regardless of the /vi or /ja segment the link was opened from.
export function createBilingualTranslator(namespace: string) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- namespace/key are dynamic strings here, not the static literals createTranslator's generics expect
    const config = { namespace } as any;
    const translateVi = createTranslator({ locale: "vi", messages: viMessages, ...config }) as (
        key: string,
        values?: BilingualTranslateValues
    ) => string;
    const translateJa = createTranslator({ locale: "ja", messages: jaMessages, ...config }) as (
        key: string,
        values?: BilingualTranslateValues
    ) => string;

    return (key: string, values?: BilingualTranslateValues): string => {
        const vi = translateVi(key, values);
        const ja = translateJa(key, values);
        return ja && ja !== vi ? `${vi} / ${ja}` : vi;
    };
}

// Vietnamese is always shown; Japanese is appended only when the master data has it filled in
// (NameJp/NoteJp/AnotherSuggestionJp are nullable — see docs/attendance-module.md).
export function bilingualText(vn: string | null | undefined, jp: string | null | undefined): string {
    if (!vn) return jp || "-";
    return jp ? `${vn} / ${jp}` : vn;
}

// Approval-level label shown alongside the true VN name (2026-07-29, user request): the OT-form
// email confirm page must always read "VN / JP" no matter which locale segment (/vi or /ja) the
// approver happened to open the link in — a next-intl useTranslations() would flip fully to JP on
// /ja routes instead, so these values are literal bilingual pairs, not translation keys.
export const approvalLevelLabelsBilingual: Record<number, string> = {
    0: "Trưởng nhóm / グループ長",
    1: "Trưởng phòng / 部長",
    2: "Trưởng xưởng / 工場長",
    3: "Tổng Giám Đốc / 総経理",
    4: "Trưởng Bộ phận / 部門長",
};

export const otFormStatusLabelsBilingual: Record<number, string> = {
    0: "Chờ Trưởng phòng duyệt / 部長の承認待ち",
    1: "Chờ Trưởng xưởng duyệt / 工場長の承認待ち",
    2: "Chờ Tổng Giám Đốc duyệt / 総経理の承認待ち",
    3: "Hoàn tất / 完了",
    4: "Từ chối / 却下",
    5: "Nháp — chờ Trưởng nhóm ký / 下書き―グループ長の署名待ち",
    6: "Chờ Trưởng Bộ phận duyệt / 部門長の承認待ち",
};

export const approvalActionLabelsBilingual: Record<number, string> = {
    0: "Đã đề nghị (ký) / 申請済み（署名）",
    1: "Đã duyệt / 承認済み",
    2: "Đã từ chối / 却下済み",
};

// Khối "Yêu cầu hỗ trợ khác" (ăn uống/xe đưa đón/phòng copy/đề nghị khác) trên trang xem trước qua
// email — literal, KHÔNG đi qua createBilingualTranslator: label + giá trị (Có/Không) đều cần đổi
// theo TỪNG locale (vi khác ja), trong khi createBilingualTranslator ghép {value} CỐ ĐỊNH vào cả 2
// bản dịch — nếu {value} đã là 1 chuỗi song ngữ ("Có / はい") thì bị lặp lại 2 lần (bug thực tế đã gặp:
// "Ăn uống: Có / はい / 食事：Có / はい"). Tên khối cố tình KHÔNG giữ "Phần xử lý / 処理欄" (tên gốc
// trên phiếu giấy YEV-22-024, xem attendance-otform-pdf-mapping.md — bản in PDF vẫn giữ nguyên tên đó
// vì mô phỏng đúng phiếu giấy) — trên 2 màn hình (chi tiết đơn trong app + trang xem trước qua email)
// đổi sang tên dễ hiểu hơn theo yêu cầu người dùng (2026-07-31).
export const processPartTitleBilingual = "Yêu cầu hỗ trợ khác / その他のご要望";

export const processPartFieldLabelsBilingual = {
    eat: "Ăn uống / 食事",
    transportation: "Xe đưa đón / 送迎",
    copyRoom: "Phòng copy / コピー室",
    anotherSuggestion: "Đề nghị khác / その他の要望",
};

export function bilingualYesNo(value: boolean): string {
    return value ? "Có / はい" : "Không / いいえ";
}

// Dòng "đã bị loại khỏi đơn" trên bảng nhân viên của trang xem trước qua email (docs §4.5a) — cũng
// literal thay vì đi qua createBilingualTranslator, cùng lý do với processPartTitleBilingual ở trên:
// approvalLevelLabelsBilingual[level] TỰ nó đã là chuỗi song ngữ, nhét vào template rồi dịch lại lần
// nữa sẽ lặp. Nhãn tĩnh (không chứa biến) thì an toàn khi qua t() như bình thường — chỉ tách riêng 2
// nhãn hay đứng cạnh giá trị động ra khỏi t() để ghép thủ công.
export const removedByLabelBilingual = "Đã bị loại khỏi đơn bởi / 申請から除外した者";
export const removedReasonLabelBilingual = "Lý do / 理由";
