import { createTranslator } from "next-intl";
import viMessages from "../../../../messages/vi.json";
import jaMessages from "../../../../messages/ja.json";

type BilingualTranslateValues = Record<string, string | number | Date>;

// Mirror modules/attendance/lib/bilingual.ts's createBilingualTranslator (không import chéo module —
// workflow-module.md §1.1): dựng "vi / ja" từ CẢ 2 file message trực tiếp, không theo locale đang mở,
// để trang xác nhận chữ ký qua email luôn hiện song ngữ dù link mở ở /vi hay /ja.
export function createBilingualTranslator(namespace: string) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- namespace/key là chuỗi động, không phải literal cố định mà generic của createTranslator cần
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
