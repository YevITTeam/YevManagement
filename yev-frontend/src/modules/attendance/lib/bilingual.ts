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

// Vietnamese is always shown; Japanese is appended only when the master data has it (Jp fields are nullable).
export function bilingualText(vn: string | null | undefined, jp: string | null | undefined): string {
    if (!vn) return jp || "-";
    return jp ? `${vn} / ${jp}` : vn;
}

// Literal VN/JP pairs, not translation keys: the email confirm page must read bilingual even on /ja,
// where useTranslations() would switch fully to JP.
export const otFormStatusLabelsBilingual: Record<number, string> = {
    0: "Đang chờ phê duyệt / 承認待ち",
    1: "Hoàn tất / 完了",
    2: "Không phê duyệt / 不承認",
};

export const approvalActionLabelsBilingual: Record<number, string> = {
    0: "Đã đề nghị (ký) / 申請済み（署名）",
    1: "Đã phê duyệt / 承認済み",
    2: "Không phê duyệt / 不承認",
};

// Literal instead of createBilingualTranslator: it injects {value} into both translations, so an
// already-bilingual value would be duplicated.
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

// Literal for the same reason as above: the level label is already bilingual and would be duplicated by t().
export const removedByLabelBilingual = "Đã bị loại khỏi đơn bởi / 申請から除外した者";
export const removedReasonLabelBilingual = "Lý do / 理由";
