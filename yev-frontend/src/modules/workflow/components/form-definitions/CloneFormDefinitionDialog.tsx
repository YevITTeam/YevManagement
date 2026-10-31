"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";

export interface CloneFormDefinitionValues {
    code: string;
    nameVn: string;
    nameJp: string | null;
}

interface CloneFormDefinitionDialogProps {
    sourceNameVn: string;
    loading?: boolean;
    onClose: () => void;
    onSubmit: (values: CloneFormDefinitionValues) => void | Promise<void>;
}

const fieldLabelClassName = "mb-1.5 block text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]";
const fieldClassName =
    "h-10 w-full rounded-lg border border-[#e0e3e5] bg-white px-3 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3] disabled:cursor-not-allowed disabled:bg-[#f8fafc]";

// Clone only takes new Code/Names; category, prefix and route condition are inherited from the source.
export default function CloneFormDefinitionDialog({ sourceNameVn, loading = false, onClose, onSubmit }: CloneFormDefinitionDialogProps) {
    const t = useTranslations("Workflow.FormDefinition");
    const tCommon = useTranslations("Common");
    const [code, setCode] = useState("");
    const [nameVn, setNameVn] = useState("");
    const [nameJp, setNameJp] = useState("");

    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault();
        if (!code.trim() || !nameVn.trim()) return;
        onSubmit({ code: code.trim(), nameVn: nameVn.trim(), nameJp: nameJp.trim() ? nameJp.trim() : null });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="fixed inset-0 bg-black/40" onClick={() => !loading && onClose()} />

            <form
                onSubmit={handleSubmit}
                role="dialog"
                aria-modal="true"
                aria-labelledby="clone-form-definition-title"
                className="z-60 mx-4 w-full max-w-md rounded-xl border border-[#e0e3e5] bg-white p-6 shadow-xl"
            >
                <div className="mb-4 flex items-center justify-between border-b border-[#e0e3e5] pb-4">
                    <div>
                        <h3 id="clone-form-definition-title" className="text-lg font-semibold text-[#191c1e]">
                            {t("cloneTitle")}
                        </h3>
                        <p className="mt-1 text-sm text-[#5e3f3a]">{t("cloneFrom", { name: sourceNameVn })}</p>
                    </div>
                    <button
                        type="button"
                        onClick={() => !loading && onClose()}
                        className="cursor-pointer text-[#5e3f3a] transition hover:text-[#191c1e]"
                        aria-label={tCommon("close")}
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className={fieldLabelClassName}>{t("fieldCode")}</label>
                        <input value={code} onChange={(e) => setCode(e.target.value)} disabled={loading} required className={fieldClassName} />
                    </div>
                    <div>
                        <label className={fieldLabelClassName}>{t("fieldNameVn")}</label>
                        <input value={nameVn} onChange={(e) => setNameVn(e.target.value)} disabled={loading} required className={fieldClassName} />
                    </div>
                    <div>
                        <label className={fieldLabelClassName}>{t("fieldNameJp")}</label>
                        <input value={nameJp} onChange={(e) => setNameJp(e.target.value)} disabled={loading} className={fieldClassName} />
                    </div>
                </div>

                <div className="mt-6 flex justify-end gap-3 border-t border-[#e0e3e5] pt-4">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={loading}
                        className="cursor-pointer rounded-lg border border-[#e0e3e5] bg-white px-4 py-2 text-sm font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {tCommon("cancel")}
                    </button>
                    <button
                        type="submit"
                        disabled={loading}
                        className="cursor-pointer rounded-lg bg-[#e3000f] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#b40009] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {loading ? tCommon("processing") : t("cloneSubmit")}
                    </button>
                </div>
            </form>
        </div>
    );
}
