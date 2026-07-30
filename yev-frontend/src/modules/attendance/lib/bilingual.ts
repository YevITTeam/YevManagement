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
