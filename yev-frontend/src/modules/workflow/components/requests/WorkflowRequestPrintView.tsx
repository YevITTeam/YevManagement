"use client";

import { Printer, X } from "lucide-react";
import { useTranslations } from "next-intl";
import type { WorkflowRequestDto } from "@/modules/workflow/types/workflow-request.dto";
import { RequestAction } from "@/modules/workflow/types/workflow-request.dto";
import WorkflowRequestDataView from "./WorkflowRequestDataView";

interface WorkflowRequestPrintViewProps {
    request: WorkflowRequestDto;
    onClose: () => void;
}

const STATUS_LABEL_KEY: Record<number, string> = {
    1: "statusDraft",
    2: "statusSubmitted",
    3: "statusInProgress",
    4: "statusApproved",
    5: "statusRejected",
    6: "statusSentBack",
    7: "statusCancelled",
};

// Prints the on-screen layout via window.print() + @media print (no html2canvas); one signature box per actual approval step.
export default function WorkflowRequestPrintView({ request, onClose }: WorkflowRequestPrintViewProps) {
    const t = useTranslations("Workflow.WorkflowRequest");

    if (!request.formSchemaJson) return null;

    const sortedSteps = [...request.steps].sort((a, b) => a.stepOrder - b.stepOrder);
    const approveHistoriesByStep = new Map<number, typeof request.histories>();
    for (const h of request.histories) {
        if (h.action !== RequestAction.Approve) continue;
        const list = approveHistoriesByStep.get(h.stepOrder) ?? [];
        list.push(h);
        approveHistoriesByStep.set(h.stepOrder, list);
    }

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-[#f2f4f6] print:static print:bg-white">
            <style>{`@page { size: A4; margin: 15mm; }`}</style>

            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#e0e3e5] bg-white px-6 py-3 print:hidden">
                <p className="text-sm font-semibold text-[#191c1e]">{t("printPreviewTitle")}</p>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => window.print()}
                        className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-[#e3000f] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#b40009]"
                    >
                        <Printer className="h-4 w-4" /> {t("printButton")}
                    </button>
                    <button onClick={onClose} className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-[#5e3f3a] hover:bg-[#f2f4f6]">
                        <X className="h-5 w-5" />
                    </button>
                </div>
            </div>

            <div className="mx-auto max-w-3xl bg-white p-8 print:max-w-none print:p-0 print:shadow-none">
                <div className="mb-6 break-inside-avoid border-b border-[#191c1e] pb-4">
                    <h1 className="text-xl font-bold text-[#191c1e]">{request.formDefinitionNameVn}</h1>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-sm text-[#191c1e]">
                        <p>
                            <span className="font-semibold">{t("printRequestCode")}:</span> {request.requestCode ?? "—"}
                        </p>
                        <p>
                            <span className="font-semibold">{t("printStatus")}:</span> {t(STATUS_LABEL_KEY[request.status] ?? "statusDraft")}
                        </p>
                        <p>
                            <span className="font-semibold">{t("printCreatedBy")}:</span> {request.createdByEmployeeName}
                        </p>
                        <p>
                            <span className="font-semibold">{t("printSubmittedAt")}:</span>{" "}
                            {request.submittedAt ? new Date(request.submittedAt).toLocaleString("vi-VN") : "—"}
                        </p>
                    </div>
                </div>

                <div className="mb-8">
                    <WorkflowRequestDataView schema={request.formSchemaJson} data={request.dataJson ?? {}} printMode />
                </div>

                {request.attachments.length > 0 && (
                    <div className="mb-8 break-inside-avoid">
                        <p className="mb-1.5 text-xs font-semibold uppercase text-[#8a8f94]">{t("printAttachmentsLabel")}</p>
                        <ul className="list-inside list-disc text-sm text-[#191c1e]">
                            {request.attachments.map((a) => (
                                <li key={a.id}>{a.originalFileName}</li>
                            ))}
                        </ul>
                    </div>
                )}

                {sortedSteps.length > 0 && (
                    <div className="grid grid-cols-2 gap-6 break-inside-avoid sm:grid-cols-3">
                        {sortedSteps.map((step) => {
                            const acted = approveHistoriesByStep.get(step.stepOrder) ?? [];
                            return (
                                <div key={step.id} className="break-inside-avoid rounded border border-[#e0e3e5] p-3 text-center">
                                    <p className="text-xs font-semibold uppercase text-[#8a8f94]">{step.stepNameSnapshot}</p>
                                    <div className="mt-2 flex h-20 items-center justify-center">
                                        {acted.length > 0 ? (
                                            <div className="flex flex-wrap items-center justify-center gap-2">
                                                {acted.map((h) =>
                                                    h.signatureImageBase64 ? (
                                                        // eslint-disable-next-line @next/next/no-img-element -- base64 data URI in print view
                                                        <img key={h.id} src={`data:image/png;base64,${h.signatureImageBase64}`} alt={h.actorNameSnapshot} className="h-16 object-contain" />
                                                    ) : (
                                                        <p key={h.id} className="text-xs text-[#5e3f3a]">
                                                            {h.actorNameSnapshot}
                                                        </p>
                                                    )
                                                )}
                                            </div>
                                        ) : (
                                            <p className="text-xs text-[#c4c9cd]">{t("printNoSignatureYet")}</p>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
