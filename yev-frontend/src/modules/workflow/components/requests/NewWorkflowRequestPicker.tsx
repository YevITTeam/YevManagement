"use client";

import { useState } from "react";
import { FileText, ArrowLeft, Inbox } from "lucide-react";
import { toast } from "react-toastify";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/navigation";
import { WorkflowRequestApi } from "@/modules/workflow/api/workflow-request.api";
import type { AvailableFormDto } from "@/modules/workflow/types/workflow-request.dto";
import { useFetchEffect } from "@/modules/common/hooks/useFetchEffect";
import { EmptyState } from "@/components/common/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";

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

            {error && <div className="rounded-lg border border-[#e9bcb6] bg-[#fff4f2] px-4 py-3 text-sm text-[#930006]">{error}</div>}

            {!isLoading && !error && forms.length === 0 && (
                <div className="rounded-xl border border-[#e0e3e5] bg-white shadow-sm">
                    <EmptyState icon={Inbox} title={t("noAvailableForms")} />
                </div>
            )}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                {isLoading && [0, 1, 2].map((index) => <Skeleton key={index} className="h-[4.5rem] rounded-xl" />)}
                {forms.map((form) => (
                    <button
                        key={form.id}
                        onClick={() => handlePick(form)}
                        className="flex cursor-pointer items-center gap-3 rounded-xl border border-[#e0e3e5] bg-white p-4 text-left shadow-sm transition hover:border-[#e3000f] hover:shadow-md"
                    >
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#fff4f2] text-[#e3000f]">
                            <FileText className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-sm font-semibold text-[#191c1e]">{form.nameVn}</p>
                            {form.formCategoryNameVn && <p className="text-xs text-[#8a8f94]">{form.formCategoryNameVn}</p>}
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );
}
