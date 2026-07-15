"use client";

import { useEffect, useState } from "react";
import { toast } from "react-toastify";

import { UserSignatureApi } from "@/modules/attendance/api/user-signature.api";
import type { UserSignatureDto } from "@/modules/attendance/types/user-signature.dto";
import SignatureCanvas from "./SignatureCanvas";
import { getApiErrorMessage } from "@/lib/apiError";

// docs/attendance-api-fe.md §6 — mỗi user tự đăng ký 1 chữ ký dùng tham khảo/auto-fill lúc duyệt.
export default function UserSignaturePanel() {
    const [signature, setSignature] = useState<UserSignatureDto | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [draftBase64, setDraftBase64] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const fetchSignature = async () => {
        setIsLoading(true);
        try {
            const data = await UserSignatureApi.getMySignature();
            setSignature(data);
        } catch (err) {
            console.error(err);
            toast.error(getApiErrorMessage(err, "Không thể tải chữ ký."));
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchSignature();
    }, []);

    const handleSave = async () => {
        if (!draftBase64) {
            toast.error("Vui lòng ký vào khung trước khi lưu.");
            return;
        }
        setIsSaving(true);
        try {
            const data = await UserSignatureApi.upsertMySignature({ signatureImage: draftBase64 });
            setSignature(data);
            toast.success("Cập nhật chữ ký thành công");
        } catch (err) {
            console.error(err);
            toast.error(getApiErrorMessage(err, "Cập nhật chữ ký thất bại"));
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-semibold text-[#191c1e]">Chữ ký của tôi</h1>
                <p className="mt-1 text-[15px] text-[#5e3f3a]">
                    Đăng ký chữ ký cá nhân để dùng tham khảo/gợi ý điền sẵn khi duyệt đơn tăng ca.
                </p>
            </div>

            <section className="max-w-xl space-y-4 rounded-xl border border-[#e0e3e5] bg-white p-6 shadow-sm">
                {isLoading ? (
                    <div className="py-8 text-center text-sm text-[#5e3f3a]">Đang tải dữ liệu...</div>
                ) : (
                    <>
                        {signature?.updatedAt && (
                            <p className="text-xs text-[#5e3f3a]">
                                Cập nhật lần cuối: {new Date(signature.updatedAt).toLocaleString("vi-VN")}
                            </p>
                        )}
                        <SignatureCanvas
                            key={signature?.updatedAt ?? "empty"}
                            initialImage={signature?.signatureImage ?? null}
                            onChange={setDraftBase64}
                            disabled={isSaving}
                        />
                        <div className="flex justify-end">
                            <button
                                onClick={handleSave}
                                disabled={isSaving}
                                className="cursor-pointer rounded-lg bg-[#e3000f] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#b40009] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {isSaving ? "Đang lưu..." : "Lưu chữ ký"}
                            </button>
                        </div>
                    </>
                )}
            </section>
        </div>
    );
}
