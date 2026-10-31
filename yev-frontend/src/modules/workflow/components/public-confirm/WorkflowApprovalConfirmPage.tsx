"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";

import { WorkflowApprovalApi } from "@/modules/workflow/api/workflow-approval.api";
import type { WorkflowRequestDto } from "@/modules/workflow/types/workflow-request.dto";
import { RequestStatus, StepStatus } from "@/modules/workflow/types/workflow-request.dto";
import WorkflowRequestDataView from "@/modules/workflow/components/requests/WorkflowRequestDataView";
import { getApiErrorMessage } from "@/lib/apiError";
import { useFetchEffect } from "@/modules/common/hooks/useFetchEffect";
import { createBilingualTranslator } from "@/modules/workflow/lib/bilingual";

const STATUS_KEY: Record<number, string> = {
    [RequestStatus.Draft]: "statusDraft",
    [RequestStatus.Submitted]: "statusSubmitted",
    [RequestStatus.InProgress]: "statusInProgress",
    [RequestStatus.Approved]: "statusApproved",
    [RequestStatus.Rejected]: "statusRejected",
    [RequestStatus.SentBack]: "statusSentBack",
    [RequestStatus.Cancelled]: "statusCancelled",
};

const STEP_STATUS_KEY: Record<number, string> = {
    [StepStatus.Waiting]: "stepWaiting",
    [StepStatus.Current]: "stepCurrent",
    [StepStatus.Approved]: "stepApproved",
    [StepStatus.Rejected]: "stepRejected",
    [StepStatus.Skipped]: "stepSkipped",
};

// Public token-secured page opened from the email link; always bilingual. BE picks the signature from EmployeeSignatures.
// Attachments show names only: downloading requires JWT + view permission.
export default function WorkflowApprovalConfirmPage() {
    const t = createBilingualTranslator("Workflow.ApprovalConfirm");
    const searchParams = useSearchParams();
    const token = searchParams.get("token") ?? "";

    const [request, setRequest] = useState<WorkflowRequestDto | null>(null);
    const [comment, setComment] = useState("");
    const [actionResult, setActionResult] = useState<"approved" | "rejected" | null>(null);
    const [actionError, setActionError] = useState<string | null>(null);
    const [isApproving, setIsApproving] = useState(false);
    const [isRejecting, setIsRejecting] = useState(false);

    const { isLoading, error: loadError } = useFetchEffect(
        () =>
            token
                ? WorkflowApprovalApi.getByToken(token)
                : Promise.reject(new Error(JSON.stringify({ message: t("missingTokenError") }))),
        [token],
        (data) => setRequest(data),
        t("loadError")
    );

    const currentStep = request?.steps.find((s) => s.stepOrder === request.currentStepOrder && s.status === StepStatus.Current) ?? null;
    const canAct = !!request && (request.status === RequestStatus.Submitted || request.status === RequestStatus.InProgress) && !actionResult;

    const handleApprove = async () => {
        setIsApproving(true);
        setActionError(null);
        try {
            await WorkflowApprovalApi.approveByToken(token, { comment: comment.trim() || null });
            setActionResult("approved");
        } catch (err) {
            console.error(err);
            setActionError(getApiErrorMessage(err, t("approveError")));
        } finally {
            setIsApproving(false);
        }
    };

    const handleReject = async () => {
        if (!comment.trim()) {
            setActionError(t("rejectCommentRequired"));
            return;
        }
        setIsRejecting(true);
        setActionError(null);
        try {
            await WorkflowApprovalApi.rejectByToken(token, { comment: comment.trim() });
            setActionResult("rejected");
        } catch (err) {
            console.error(err);
            setActionError(getApiErrorMessage(err, t("rejectError")));
        } finally {
            setIsRejecting(false);
        }
    };

    return (
        <div className="mx-auto max-w-2xl px-4 py-12">
            <div className="rounded-xl border border-[#e0e3e5] bg-white p-6 shadow-sm">
                <h1 className="text-xl font-semibold text-[#191c1e]">{t("title")}</h1>

                {isLoading && <p className="mt-4 text-sm text-[#5e3f3a]">{t("loading")}</p>}

                {!isLoading && loadError && (
                    <p className="mt-4 rounded-lg border border-[#e9bcb6] bg-[#fff4f2] px-4 py-3 text-sm text-[#930006]">{loadError}</p>
                )}

                {!isLoading && !loadError && request && (
                    <div className="mt-4 space-y-5">
                        <div>
                            <div className="flex items-center gap-3">
                                <h2 className="text-lg font-semibold text-[#191c1e]">{request.requestCode ?? "—"}</h2>
                                <span className="rounded-full bg-[#f2f4f6] px-2.5 py-1 text-xs font-semibold text-[#5e3f3a]">
                                    {t(STATUS_KEY[request.status] ?? "statusDraft")}
                                </span>
                            </div>
                            <p className="mt-1 text-sm text-[#5e3f3a]">{request.formDefinitionNameVn}</p>
                            <p className="mt-0.5 text-xs text-[#8a8f94]">{t("createdByLabel", { name: request.createdByEmployeeName })}</p>
                        </div>

                        {request.formSchemaJson && (
                            <div className="rounded-lg border border-[#e0e3e5] p-4">
                                <WorkflowRequestDataView schema={request.formSchemaJson} data={request.dataJson ?? {}} />
                            </div>
                        )}

                        {request.attachments.length > 0 && (
                            <div>
                                <p className="mb-1.5 text-[11px] font-semibold uppercase text-[#8a8f94]">{t("attachmentsLabel")}</p>
                                <ul className="list-inside list-disc text-sm text-[#191c1e]">
                                    {request.attachments.map((a) => (
                                        <li key={a.id}>{a.originalFileName}</li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {request.steps.length > 0 && (
                            <div>
                                <p className="mb-1.5 text-[11px] font-semibold uppercase text-[#8a8f94]">{t("stepsLabel")}</p>
                                <div className="space-y-1.5">
                                    {request.steps
                                        .slice()
                                        .sort((a, b) => a.stepOrder - b.stepOrder)
                                        .map((s) => (
                                            <div key={s.id} className="flex items-center justify-between rounded-lg border border-[#e0e3e5] px-3 py-1.5 text-sm">
                                                <span className="text-[#191c1e]">{s.stepNameSnapshot}</span>
                                                <span className="text-xs text-[#8a8f94]">{t(STEP_STATUS_KEY[s.status] ?? "stepWaiting")}</span>
                                            </div>
                                        ))}
                                </div>
                            </div>
                        )}

                        {actionResult === null && !canAct && (
                            <p className="rounded-lg border border-[#f5d0a9] bg-[#fff8ee] px-4 py-3 text-sm text-[#8a5a00]">{t("notActionableNotice")}</p>
                        )}

                        {canAct && (
                            <div className="space-y-3 border-t border-[#e0e3e5] pt-4">
                                {currentStep?.requireSignatureSnapshot && (
                                    <p className="rounded-lg border border-[#e0e3e5] bg-[#f8fafc] px-3 py-2 text-xs text-[#5e3f3a]">
                                        {t("signatureAutoNotice")}
                                    </p>
                                )}
                                <label className="block">
                                    <span className="mb-1 block text-[11px] font-semibold uppercase text-[#8a8f94]">{t("commentLabel")}</span>
                                    <textarea
                                        value={comment}
                                        onChange={(e) => setComment(e.target.value)}
                                        rows={3}
                                        className="w-full rounded-lg border border-[#e0e3e5] bg-white px-3 py-2 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3]"
                                    />
                                </label>

                                {actionError && (
                                    <p className="rounded-lg border border-[#e9bcb6] bg-[#fff4f2] px-4 py-3 text-sm text-[#930006]">{actionError}</p>
                                )}

                                <div className="flex gap-2">
                                    <button
                                        onClick={handleApprove}
                                        disabled={isApproving || isRejecting}
                                        className="flex-1 cursor-pointer rounded-lg bg-[#1e7a34] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#166028] disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        {isApproving ? t("approving") : t("approveButton")}
                                    </button>
                                    <button
                                        onClick={handleReject}
                                        disabled={isApproving || isRejecting}
                                        className="flex-1 cursor-pointer rounded-lg bg-[#930006] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#7a0005] disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        {isRejecting ? t("rejecting") : t("rejectButton")}
                                    </button>
                                </div>
                            </div>
                        )}

                        {actionResult === "approved" && (
                            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                                {t("approveSuccessMessage")}
                            </div>
                        )}
                        {actionResult === "rejected" && (
                            <div className="rounded-lg border border-[#e9bcb6] bg-[#fff4f2] px-4 py-3 text-sm text-[#930006]">
                                {t("rejectSuccessMessage")}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
