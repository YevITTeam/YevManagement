"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";

import { UserSignatureApi } from "@/modules/attendance/api/user-signature.api";
import type { SignatureConfirmationPreviewDto } from "@/modules/attendance/types/user-signature.dto";
import { getApiErrorMessage } from "@/lib/apiError";
import { useFetchEffect } from "@/modules/common/hooks/useFetchEffect";

// Route public (không đăng nhập SPA, bảo mật bằng token trong URL) — docs/attendance-api-fe.md §6b.
// Mở qua link email "Xác nhận cập nhật chữ ký".
export default function SignatureConfirmPage() {
    const searchParams = useSearchParams();
    const token = searchParams.get("token") ?? "";

    const [preview, setPreview] = useState<SignatureConfirmationPreviewDto | null>(null);
    const [isConfirming, setIsConfirming] = useState(false);
    const [confirmed, setConfirmed] = useState(false);
    const [confirmError, setConfirmError] = useState<string | null>(null);

    // Thiếu token ném lỗi dạng JSON {message} để getApiErrorMessage bên trong useFetchEffect parse ra
    // đúng câu thông báo riêng này thay vì rơi về fallback chung.
    const { isLoading, error: loadError } = useFetchEffect(
        () =>
            token
                ? UserSignatureApi.getSignatureConfirmation(token)
                : Promise.reject(new Error(JSON.stringify({ message: "Thiếu token xác nhận trong đường link." }))),
        [token],
        (data) => setPreview(data),
        "Không thể tải yêu cầu xác nhận chữ ký."
    );

    const handleConfirm = async () => {
        setIsConfirming(true);
        setConfirmError(null);
        try {
            await UserSignatureApi.confirmSignature(token);
            setConfirmed(true);
        } catch (err) {
            console.error(err);
            setConfirmError(getApiErrorMessage(err, "Xác nhận cập nhật chữ ký thất bại."));
        } finally {
            setIsConfirming(false);
        }
    };

    return (
        <div className="mx-auto max-w-lg px-4 py-12">
            <div className="rounded-xl border border-[#e0e3e5] bg-white p-6 shadow-sm">
                <h1 className="text-xl font-semibold text-[#191c1e]">Xác nhận cập nhật chữ ký</h1>

                {isLoading && <p className="mt-4 text-sm text-[#5e3f3a]">Đang tải...</p>}

                {!isLoading && loadError && (
                    <p className="mt-4 rounded-lg border border-[#e9bcb6] bg-[#fff4f2] px-4 py-3 text-sm text-[#930006]">
                        {loadError}
                    </p>
                )}

                {!isLoading && !loadError && preview && !confirmed && (
                    <div className="mt-4 space-y-4">
                        <p className="text-sm text-[#5e3f3a]">
                            Tài khoản: <span className="font-semibold text-[#191c1e]">{preview.userName}</span>
                        </p>
                        <img
                            src={`data:image/png;base64,${preview.signatureImage}`}
                            alt="Chữ ký mới đang chờ xác nhận"
                            className="h-24 w-full rounded-lg border border-[#e0e3e5] bg-white object-contain"
                        />
                        <p className="text-sm text-[#191c1e]">
                            Bạn có xác nhận cập nhật chữ ký này không? Link hết hạn lúc{" "}
                            <span className="font-semibold">{new Date(preview.expiresAt).toLocaleString("vi-VN")}</span>.
                        </p>
                        {confirmError && (
                            <p className="rounded-lg border border-[#e9bcb6] bg-[#fff4f2] px-4 py-3 text-sm text-[#930006]">
                                {confirmError}
                            </p>
                        )}
                        <button
                            onClick={handleConfirm}
                            disabled={isConfirming}
                            className="cursor-pointer w-full rounded-lg bg-[#e3000f] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#b40009] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {isConfirming ? "Đang xác nhận..." : "Xác nhận cập nhật"}
                        </button>
                    </div>
                )}

                {confirmed && (
                    <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                        Cập nhật chữ ký thành công. Bạn có thể quay lại ứng dụng và tiếp tục sử dụng bình thường.
                    </div>
                )}
            </div>
        </div>
    );
}
