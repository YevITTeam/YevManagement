import { createTranslator } from "next-intl";
import viMessages from "../../../../messages/vi.json";
import jaMessages from "../../../../messages/ja.json";

type BilingualTranslateValues = Record<string, string | number | Date>;

// Builds "vi / ja" from both message files regardless of locale so email confirmation pages are always bilingual.
// Mirrors attendance's createBilingualTranslator (no cross-module import).
export function createBilingualTranslator(namespace: string) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic namespace/key strings don't fit createTranslator's literal generics
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
