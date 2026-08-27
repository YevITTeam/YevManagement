import { Suspense } from "react";
import WorkflowApprovalConfirmPage from "@/modules/workflow/components/public-confirm/WorkflowApprovalConfirmPage";

// Route public — mở qua link email "Đơn chờ duyệt" (Pha 4C, workflow-module.md §6). Mirror
// xac-nhan-chu-ky-quy-trinh (Pha 4A) — 2 route tách riêng vì workflow-module.md §1.1 module độc lập.
// Không nằm trong sơ đồ menu, không cần đăng nhập SPA.
export default function Page() {
    return (
        <Suspense fallback={<div className="py-16 text-center text-sm text-[#5e3f3a]">Đang tải...</div>}>
            <WorkflowApprovalConfirmPage />
        </Suspense>
    );
}
