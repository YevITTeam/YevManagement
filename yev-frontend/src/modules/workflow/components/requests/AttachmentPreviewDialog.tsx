"use client";

import { useEffect, useState } from "react";
import { X, Download, AlertTriangle } from "lucide-react";
import { toast } from "react-toastify";
import { useTranslations } from "next-intl";

import { WorkflowRequestApi } from "@/modules/workflow/api/workflow-request.api";
import type { WorkflowAttachmentDto } from "@/modules/workflow/types/workflow-request.dto";
import { useFetchEffect } from "@/modules/common/hooks/useFetchEffect";

interface AttachmentPreviewDialogProps {
    attachment: WorkflowAttachmentDto;
    onClose: () => void;
}

type PreviewKind = "image" | "pdf" | "unsupported";

const IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".svg"];

// contentType do trình duyệt gửi lúc upload đôi khi không đáng tin (vd application/octet-stream) —
// dự phòng thêm bằng đuôi file. Chỉ hỗ trợ xem trước ảnh + PDF (2 loại trình duyệt tự render được
// bằng thẻ HTML thuần, KHÔNG cần thư viện đọc docx/xlsx — ngoài phạm vi tính năng này).
function getPreviewKind(contentType: string, fileName: string): PreviewKind {
    if (contentType.startsWith("image/")) return "image";
    if (contentType === "application/pdf") return "pdf";

    const ext = fileName.slice(fileName.lastIndexOf(".")).toLowerCase();
    if (IMAGE_EXTENSIONS.includes(ext)) return "image";
    if (ext === ".pdf") return "pdf";
    return "unsupported";
}

export default function AttachmentPreviewDialog({ attachment, onClose }: AttachmentPreviewDialogProps) {
    const t = useTranslations("Workflow.WorkflowRequest");
    const [blobUrl, setBlobUrl] = useState<string | null>(null);
    const [kind, setKind] = useState<PreviewKind>("unsupported");

    const { isLoading, error } = useFetchEffect(
        () => WorkflowRequestApi.downloadAttachment(attachment.id),
        [attachment.id],
        (result) => {
            setBlobUrl(URL.createObjectURL(result.blob));
            setKind(getPreviewKind(attachment.contentType, attachment.originalFileName));
        },
        t("previewLoadError"),
        (message) => toast.error(message)
    );

    // Blob URL chỉ sống trong bộ nhớ trình duyệt — phải tự revoke, không thì rò rỉ bộ nhớ mỗi lần
    // mở/đóng preview 1 file khác.
    useEffect(() => {
        return () => {
            if (blobUrl) URL.revokeObjectURL(blobUrl);
        };
    }, [blobUrl]);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [onClose]);

    const handleDownload = () => {
        if (!blobUrl) return;
        const link = document.createElement("a");
        link.href = blobUrl;
        link.download = attachment.originalFileName;
        link.click();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/60" onClick={onClose} />

            <div role="dialog" aria-modal="true" className="z-10 flex h-full max-h-[90vh] w-full max-w-4xl flex-col rounded-xl bg-white shadow-xl">
                <div className="flex items-center justify-between gap-3 border-b border-[#e0e3e5] px-5 py-3">
                    <p className="min-w-0 truncate text-sm font-semibold text-[#191c1e]">{attachment.originalFileName}</p>
                    <div className="flex shrink-0 items-center gap-1.5">
                        <button
                            onClick={handleDownload}
                            disabled={!blobUrl}
                            className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#e0e3e5] bg-white px-3 py-1.5 text-xs font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            <Download className="h-3.5 w-3.5" /> {t("downloadButton")}
                        </button>
                        <button onClick={onClose} className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-[#5e3f3a] hover:bg-[#f2f4f6]">
                            <X className="h-5 w-5" />
                        </button>
                    </div>
                </div>

                <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto bg-[#f8fafc] p-4">
                    {isLoading ? (
                        <p className="text-sm text-[#5e3f3a]">{t("previewLoading")}</p>
                    ) : error || !blobUrl ? (
                        <p className="text-sm text-[#930006]">{error ?? t("previewLoadError")}</p>
                    ) : kind === "image" ? (
                        // eslint-disable-next-line @next/next/no-img-element -- blob URL, next/image không hỗ trợ
                        <img src={blobUrl} alt={attachment.originalFileName} className="max-h-full max-w-full object-contain" />
                    ) : kind === "pdf" ? (
                        <iframe src={blobUrl} title={attachment.originalFileName} className="h-full w-full rounded-lg border border-[#e0e3e5] bg-white" />
                    ) : (
                        <div className="flex flex-col items-center gap-2 text-center">
                            <AlertTriangle className="h-8 w-8 text-[#8a5a00]" />
                            <p className="text-sm text-[#5e3f3a]">{t("previewUnsupported")}</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
