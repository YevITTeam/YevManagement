"use client";

import { useState } from "react";
import { FileText, ArrowLeft } from "lucide-react";
import { toast } from "react-toastify";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/navigation";
import { WorkflowRequestApi } from "@/modules/workflow/api/workflow-request.api";
import type { AvailableFormDto } from "@/modules/workflow/types/workflow-request.dto";
import { useFetchEffect } from "@/modules/common/hooks/useFetchEffect";

// getAvailableForms() (published + caller's FormAccesses), not grid-list, which needs FormDesign.View.
// Only navigates with ?formDefinitionId=; the draft is created on first save/submit to avoid junk requests.
export default function NewWorkflowRequestPicker() {
    const t = useTranslations("Workflow.WorkflowRequest");
    const router = useRouter();
    const [forms, setForms] = useState<AvailableFormDto[]>([]);

    const { isLoading, error } = useFetchEffect(
        () => WorkflowRequestApi.getAvailableForms(),
        [],
        (result) => setForms(result),
        t("loadAvailableFormsError"),
        (message) => toast.error(message)
    );

    const handlePick = (form: AvailableFormDto) => {
        router.push({ pathname: "/workflow/requests/detail", query: { formDefinitionId: String(form.id) } });
    };

    return (
        <div className="space-y-6">
            <div>
                <Link href="/workflow/requests" className="flex items-center gap-1.5 text-sm font-semibold text-[#5e3f3a] hover:text-[#191c1e]">
                    <ArrowLeft className="h-3.5 w-3.5" /> {t("backToList")}
                </Link>
                <h1 className="mt-2 text-2xl font-semibold text-[#191c1e]">{t("pickFormTitle")}</h1>
            </div>

            {isLoading && <div className="py-10 text-center text-sm text-[#5e3f3a]">{t("loading")}</div>}
            {error && <div className="rounded-lg border border-[#e9bcb6] bg-[#fff4f2] px-4 py-3 text-sm text-[#930006]">{error}</div>}

            {!isLoading && !error && forms.length === 0 && (
                <div className="rounded-lg border border-dashed border-[#e0e3e5] px-4 py-10 text-center text-sm text-[#8a8f94]">
                    {t("noAvailableForms")}
                </div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {forms.map((form) => (
                    <button
                        key={form.id}
                        onClick={() => handlePick(form)}
                        className="flex cursor-pointer flex-col items-start gap-2 rounded-xl border border-[#e0e3e5] bg-white p-4 text-left shadow-sm transition hover:border-[#e3000f] hover:shadow-md"
                    >
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#fff4f2] text-[#e3000f]">
                            <FileText className="h-5 w-5" />
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-[#191c1e]">{form.nameVn}</p>
                            {form.formCategoryNameVn && <p className="text-xs text-[#8a8f94]">{form.formCategoryNameVn}</p>}
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );
}
