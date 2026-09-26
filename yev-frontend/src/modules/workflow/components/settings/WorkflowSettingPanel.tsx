"use client";

import { useState } from "react";
import { Save } from "lucide-react";
import { toast } from "react-toastify";
import { useTranslations } from "next-intl";

import { WorkflowSettingApi } from "@/modules/workflow/api/workflow-setting.api";
import type { WorkflowSettingDto } from "@/modules/workflow/types/workflow-setting.dto";
import { Skeleton } from "@/components/ui/Skeleton";
import { getApiErrorMessage } from "@/lib/apiError";
import { useFetchEffect } from "@/modules/common/hooks/useFetchEffect";

const inputClassName =
    "w-full rounded-lg border border-[#e0e3e5] bg-white px-3 py-2 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3]";

// Cấu hình module Workflow, luôn 1 dòng (workflow-module.md §3.4 WorkflowSettings) — chỉ Get/Update,
// permission Workflow.Setting.Manage (§7). EmailTokenExpiryDays chưa dùng ở đâu tới khi Pha 4C (duyệt
// qua email) scaffold, nhưng vẫn cho sửa vì cột đã tồn tại trong DB từ Pha 4B.
export default function WorkflowSettingPanel() {
    const t = useTranslations("Workflow.WorkflowSetting");
    const tCommon = useTranslations("Common");

    const [values, setValues] = useState<WorkflowSettingDto | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const { isLoading } = useFetchEffect(
        () => WorkflowSettingApi.get(),
        [],
        (data) => setValues(data),
        t("loadError"),
        (message) => toast.error(message)
    );

    const handleSave = async () => {
        if (!values) return;
        if (!values.allowedFileExtensions.trim()) {
            toast.error(t("allowedFileExtensionsRequired"));
            return;
        }
        setIsSaving(true);
        try {
            const updated = await WorkflowSettingApi.update(values);
            setValues(updated);
            toast.success(t("saveSuccess"));
        } catch (err) {
            console.error(err);
            toast.error(getApiErrorMessage(err, t("saveError")));
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-semibold text-[#191c1e]">{t("title")}</h1>
                <p className="mt-1 text-[15px] text-[#5e3f3a]">{t("description")}</p>
            </div>

            <section className="max-w-xl space-y-4 rounded-xl border border-[#e0e3e5] bg-white p-6 shadow-sm">
                {isLoading || !values ? (
                    <div className="space-y-4">
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                    </div>
                ) : (
                    <>
                        <label className="block">
                            <span className="mb-1 block text-[11px] font-semibold uppercase text-[#8a8f94]">{t("maxAttachmentSizeMbLabel")}</span>
                            <input
                                type="number"
                                min={1}
                                max={1000}
                                value={values.maxAttachmentSizeMb}
                                onChange={(e) => setValues({ ...values, maxAttachmentSizeMb: Number(e.target.value) })}
                                className={inputClassName}
                            />
                        </label>

                        <label className="block">
                            <span className="mb-1 block text-[11px] font-semibold uppercase text-[#8a8f94]">{t("maxAttachmentPerRequestLabel")}</span>
                            <input
                                type="number"
                                min={1}
                                max={100}
                                value={values.maxAttachmentPerRequest}
                                onChange={(e) => setValues({ ...values, maxAttachmentPerRequest: Number(e.target.value) })}
                                className={inputClassName}
                            />
                        </label>

                        <label className="block">
                            <span className="mb-1 block text-[11px] font-semibold uppercase text-[#8a8f94]">{t("allowedFileExtensionsLabel")}</span>
                            <input
                                type="text"
                                value={values.allowedFileExtensions}
                                onChange={(e) => setValues({ ...values, allowedFileExtensions: e.target.value })}
                                placeholder=".pdf,.jpg,.jpeg,.png,.docx,.xlsx"
                                className={inputClassName}
                            />
                        </label>

                        <div className="flex justify-end">
                            <button
                                onClick={handleSave}
                                disabled={isSaving}
                                className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-[#e3000f] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#b40009] disabled:opacity-50"
                            >
                                <Save className="h-3.5 w-3.5" /> {isSaving ? tCommon("processing") : t("saveButton")}
                            </button>
                        </div>
                    </>
                )}
            </section>
        </div>
    );
}
