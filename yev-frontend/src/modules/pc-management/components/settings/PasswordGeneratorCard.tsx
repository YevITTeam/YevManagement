"use client";

import { useRef, useState } from "react";
import { toast } from "react-toastify";
import { Copy, RefreshCw } from "lucide-react";

import {
    generatePassword,
    passwordStrength,
    PASSWORD_MAX_LENGTH,
    PASSWORD_MIN_LENGTH,
    type PasswordOptions,
} from "@/modules/pc-management/lib/password";

const CHAR_OPTIONS: { key: keyof Omit<PasswordOptions, "length">; label: string; title?: string }[] = [
    { key: "upper", label: "Chữ hoa" },
    { key: "lower", label: "Chữ thường" },
    { key: "digits", label: "Số" },
    { key: "symbols", label: "Ký tự đặc biệt", title: "!@#$%^&*()-_=+[]{};:,.?/" },
    { key: "excludeAmbiguous", label: "Bỏ ký tự dễ nhầm", title: "Bỏ I l 1 O 0 o" },
];

const LEVEL_STYLES = [
    { bar: "bg-[#930006]", text: "text-[#930006]" },
    { bar: "bg-[#930006]", text: "text-[#930006]" },
    { bar: "bg-[#9a5b00]", text: "text-[#9a5b00]" },
    { bar: "bg-emerald-500", text: "text-emerald-600" },
    { bar: "bg-emerald-500", text: "text-emerald-600" },
];

const iconButtonClassName =
    "inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-md border border-[#e0e3e5] text-[#5e3f3a] transition hover:bg-[#f2f4f6] disabled:cursor-not-allowed disabled:opacity-50";

const DEFAULT_OPTIONS: PasswordOptions = { length: 16, upper: true, lower: true, digits: true, symbols: true, excludeAmbiguous: true };

// Generated in the browser only and never sent or stored anywhere; AuthGuard keeps it out of the static prerender.
export default function PasswordGeneratorCard() {
    const [options, setOptions] = useState(DEFAULT_OPTIONS);
    const [password, setPassword] = useState(() => generatePassword(DEFAULT_OPTIONS));
    const inputRef = useRef<HTMLInputElement>(null);

    const updateOptions = (patch: Partial<PasswordOptions>) => {
        const next = { ...options, ...patch };
        setOptions(next);
        setPassword(generatePassword(next));
    };

    const strength = passwordStrength(password, options);
    const style = LEVEL_STYLES[strength.level];
    const hasCharSet = options.upper || options.lower || options.digits || options.symbols;

    const handleCopy = async () => {
        // The production site is plain http, where navigator.clipboard does not exist; fall back to the selected input.
        let copied = await (navigator.clipboard?.writeText(password).then(() => true, () => false) ?? false);
        if (!copied) {
            inputRef.current?.select();
            copied = document.execCommand("copy");
        }
        if (copied) toast.success("Đã sao chép mật khẩu");
        else toast.error("Không sao chép được, hãy bôi đen và Ctrl+C");
    };

    return (
        <section className="max-w-2xl rounded-xl border border-[#e0e3e5] bg-white p-4 shadow-sm md:p-6">
            <h2 className="text-base font-semibold text-[#191c1e]">Tạo mật khẩu ngẫu nhiên</h2>

            <div className="mt-4 flex items-center gap-2">
                <input
                    ref={inputRef}
                    readOnly
                    value={password}
                    aria-label="Mật khẩu"
                    onFocus={(event) => event.target.select()}
                    className="h-9 min-w-0 flex-1 rounded-lg border border-[#e0e3e5] bg-[#f8fafc] px-3 font-mono text-sm text-[#191c1e] outline-none focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3]"
                />
                <button type="button" onClick={handleCopy} disabled={!password} title="Sao chép" aria-label="Sao chép" className={iconButtonClassName}>
                    <Copy className="h-4 w-4" />
                </button>
                <button
                    type="button"
                    onClick={() => setPassword(generatePassword(options))}
                    disabled={!hasCharSet}
                    title="Tạo mật khẩu khác"
                    aria-label="Tạo mật khẩu khác"
                    className={iconButtonClassName}
                >
                    <RefreshCw className="h-4 w-4" />
                </button>
            </div>

            {password && (
                <div className="mt-2 flex items-center gap-3" title={`Độ khó đoán ~${strength.entropyBits} bit`}>
                    <div className="flex w-40 gap-1" aria-hidden>
                        {LEVEL_STYLES.map((_, index) => (
                            <span key={index} className={`h-1.5 flex-1 rounded-full ${index <= strength.level ? style.bar : "bg-[#eceef0]"}`} />
                        ))}
                    </div>
                    <span className={`text-xs font-semibold ${style.text}`}>{strength.label}</span>
                </div>
            )}
            {password && !strength.meetsComplexity && (
                <p className="mt-1.5 text-xs text-[#930006]">Chưa đạt chuẩn phức tạp: cần ít nhất 3 trong 4 loại ký tự.</p>
            )}
            {!hasCharSet && <p className="mt-2 text-xs text-[#930006]">Chọn ít nhất một loại ký tự.</p>}

            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2.5 text-sm text-[#191c1e]">
                <label className="flex items-center gap-2">
                    <span className="text-[#5e3f3a]">Độ dài</span>
                    <input
                        type="number"
                        min={PASSWORD_MIN_LENGTH}
                        max={PASSWORD_MAX_LENGTH}
                        value={options.length}
                        onChange={(event) => updateOptions({ length: Number(event.target.value) })}
                        onBlur={() => {
                            const clamped = Math.min(PASSWORD_MAX_LENGTH, Math.max(PASSWORD_MIN_LENGTH, options.length || PASSWORD_MIN_LENGTH));
                            if (clamped !== options.length) updateOptions({ length: clamped });
                        }}
                        className="h-9 w-20 rounded-md border border-[#e0e3e5] bg-white px-2.5 text-sm outline-none focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3]"
                    />
                </label>
                {CHAR_OPTIONS.map((option) => (
                    <label key={option.key} title={option.title} className="flex cursor-pointer items-center gap-2 whitespace-nowrap">
                        <input
                            type="checkbox"
                            checked={options[option.key]}
                            onChange={(event) => updateOptions({ [option.key]: event.target.checked })}
                            className="h-4 w-4 cursor-pointer accent-[#e3000f]"
                        />
                        {option.label}
                    </label>
                ))}
            </div>
        </section>
    );
}
