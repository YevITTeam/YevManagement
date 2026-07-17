"use client";

import { useState } from "react";
import { toast } from "react-toastify";

import { UserSignatureApi } from "@/modules/attendance/api/user-signature.api";
import type { UserSignatureDto } from "@/modules/attendance/types/user-signature.dto";
import SignatureCanvas from "./SignatureCanvas";
import { getApiErrorMessage } from "@/lib/apiError";
import { useFetchEffect } from "@/modules/common/hooks/useFetchEffect";

// docs/attendance-api-fe.md §6/§6b — mỗi user tự đăng ký 1 chữ ký, BE tự lấy chữ ký này khi tạo/duyệt
// đơn. ⚠️ 2026-07-16: PUT /me KHÔNG còn áp dụng ngay — chỉ gửi email xác nhận, chữ ký cũ vẫn có hiệu
// lực cho tới khi user tự bấm xác nhận qua link email (trang public /xac-nhan-chu-ky).
export default function UserSignaturePanel() {
    const [signature, setSignature] = useState<UserSignatureDto | null>(null);
    const [draftBase64, setDraftBase64] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [confirmationSent, setConfirmationSent] = useState(false);

    const { isLoading } = useFetchEffect(
        () => UserSignatureApi.getMySignature(),
        [],
        (data) => setSignature(data),
        "Không thể tải chữ ký.",
        (message) => toast.error(message)
    );

    const handleSave = async () => {
        if (!draftBase64) {
            toast.error("Vui lòng ký vào khung trước khi lưu.");
            return;
        }
        setIsSaving(true);
        try {
            await UserSignatureApi.upsertMySignature({ signatureImage: draftBase64 });
            setConfirmationSent(true);
            toast.success("Đã gửi email xác nhận cập nhật chữ ký — vui lòng kiểm tra hộp thư trong 30 phút.");
        } catch (err) {
            console.error(err);
            toast.error(getApiErrorMessage(err, "Gửi yêu cầu cập nhật chữ ký thất bại"));
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-semibold text-[#191c1e]">Chữ ký của tôi</h1>
                <p className="mt-1 text-[15px] text-[#5e3f3a]">
                    Đăng ký chữ ký cá nhân — BE tự dùng chữ ký này khi bạn tạo đơn (Người đề nghị) hoặc duyệt đơn tăng ca.
                </p>
            </div>

            <section className="max-w-xl space-y-4 rounded-xl border border-[#e0e3e5] bg-white p-6 shadow-sm">
                {isLoading ? (
                    <div className="py-8 text-center text-sm text-[#5e3f3a]">Đang tải dữ liệu...</div>
                ) : (
                    <>
                        <div>
                            <div className="mb-1.5 text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">
                                Chữ ký đang có hiệu lực
                            </div>
                            {signature ? (
                                <>
                                    <img
                                        src={`data:image/png;base64,${signature.signatureImage}`}
                                        alt="Chữ ký hiện tại"
                                        className="h-24 w-full rounded-lg border border-[#e0e3e5] bg-white object-contain"
                                    />
                                    <p className="mt-1 text-xs text-[#5e3f3a]">
                                        Cập nhật lần cuối: {new Date(signature.updatedAt).toLocaleString("vi-VN")}
                                    </p>
                                </>
                            ) : (
                                <p className="rounded-lg border border-[#f5d0a9] bg-[#fff4e5] px-3 py-2 text-sm text-[#9a5b00]">
                                    Chưa đăng ký chữ ký.
                                </p>
                            )}
                        </div>

                        {confirmationSent ? (
                            <div className="rounded-lg border border-[#f5d0a9] bg-[#fff4e5] px-4 py-3 text-sm text-[#9a5b00]">
                                Đã gửi email xác nhận cập nhật chữ ký — vui lòng kiểm tra hộp thư và bấm xác nhận trong vòng
                                30 phút. Chữ ký cũ vẫn có hiệu lực cho tới khi bạn xác nhận xong.
                            </div>
                        ) : (
                            <>
                                <div>
                                    <div className="mb-1.5 text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">
                                        Ký chữ ký mới
                                    </div>
                                    <SignatureCanvas key="draft" onChange={setDraftBase64} disabled={isSaving} />
                                </div>
                                <div className="flex justify-end">
                                    <button
                                        onClick={handleSave}
                                        disabled={isSaving}
                                        className="cursor-pointer rounded-lg bg-[#e3000f] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#b40009] disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        {isSaving ? "Đang gửi..." : "Gửi email xác nhận cập nhật"}
                                    </button>
                                </div>
                            </>
                        )}
                    </>
                )}
            </section>
        </div>
    );
}
