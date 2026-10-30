"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { toast } from "react-toastify";
import { useTranslations } from "next-intl";

import { UserSignatureApi } from "@/modules/attendance/api/user-signature.api";
import type { EmployeeDto } from "@/modules/attendance/types/employee.dto";
import SignatureUpload from "@/modules/attendance/components/signature/SignatureUpload";
import { getApiErrorMessage } from "@/lib/apiError";
import { useFetchEffect } from "@/modules/common/hooks/useFetchEffect";

interface EmployeeSignatureDialogProps {
    employee: EmployeeDto;
    onClose: () => void;
}

const fieldLabelClassName = "mb-1.5 block text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]";

export default function EmployeeSignatureDialog({ employee, onClose }: EmployeeSignatureDialogProps) {
    const t = useTranslations("Attendance.Employee");
    const tSignature = useTranslations("Attendance.UserSignature");
    const tCommon = useTranslations("Common");
    const userName = employee.userName!;
    const [current, setCurrent] = useState<string | null>(null);
    const [draftBase64, setDraftBase64] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    // A missing signature comes back as 404, which simply means "not registered yet".
    const { isLoading } = useFetchEffect(
        () => UserSignatureApi.getUserSignature(userName).catch(() => null),
        [userName],
        (data) => setCurrent(data?.signatureImage ?? null),
        tSignature("loadError"),
        (message) => toast.error(message),
        `employee-signature-${userName}`
    );

    const handleClose = () => {
        if (!isSaving) onClose();
    };

    const handleSave = async () => {
        if (!draftBase64) {
            toast.error(tSignature("chooseImageFirstError"));
            return;
        }
        setIsSaving(true);
        try {
            await UserSignatureApi.adminSetSignature(userName, { signatureImage: draftBase64 });
            toast.success(t("signatureSaveSuccess"));
            onClose();
        } catch (err) {
            console.error(err);
            toast.error(getApiErrorMessage(err, t("signatureSaveError")));
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="fixed inset-0 bg-black/40" onClick={handleClose} />
            <div role="dialog" aria-modal="true" className="z-60 mx-4 w-full max-w-md rounded-xl border border-[#e0e3e5] bg-white p-6 shadow-xl">
                <div className="mb-4 flex items-center justify-between border-b border-[#e0e3e5] pb-4">
                    <h3 className="text-lg font-semibold text-[#191c1e]">
                        {t("signatureDialogTitle")} — {employee.lastName} {employee.firstName} ({employee.code})
                    </h3>
                    <button
                        type="button"
                        onClick={handleClose}
                        className="cursor-pointer text-[#5e3f3a] transition hover:text-[#191c1e]"
                        aria-label={tCommon("close")}
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="space-y-4">
                    <div>
                        <span className={fieldLabelClassName}>{tSignature("currentSignatureLabel")}</span>
                        {isLoading ? (
                            <div className="py-6 text-center text-sm text-[#5e3f3a]">{tCommon("loading")}</div>
                        ) : current ? (
                            // eslint-disable-next-line @next/next/no-img-element -- base64 data URI
                            <img
                                src={`data:image/png;base64,${current}`}
                                alt={tSignature("currentSignatureAlt")}
                                className="h-24 w-full rounded-lg border border-[#e0e3e5] bg-white object-contain"
                            />
                        ) : (
                            <p className="text-sm text-[#9a5b00]">{tSignature("notRegistered")}</p>
                        )}
                    </div>

                    <div>
                        <span className={fieldLabelClassName}>{tSignature("uploadNewLabel")}</span>
                        <SignatureUpload onChange={setDraftBase64} disabled={isSaving} />
                    </div>

                    <div className="flex justify-end gap-3 pt-2">
                        <button
                            type="button"
                            onClick={handleClose}
                            disabled={isSaving}
                            className="cursor-pointer rounded-lg border border-[#e0e3e5] bg-white px-4 py-2 text-sm font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {tCommon("cancel")}
                        </button>
                        <button
                            type="button"
                            onClick={handleSave}
                            disabled={isSaving || !draftBase64}
                            className="cursor-pointer rounded-lg bg-[#e3000f] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#b40009] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {isSaving ? t("saving") : t("updateSubmit")}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
