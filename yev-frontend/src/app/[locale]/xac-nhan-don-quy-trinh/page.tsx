import { Suspense } from "react";
import WorkflowApprovalConfirmPage from "@/modules/workflow/components/public-confirm/WorkflowApprovalConfirmPage";

// Public route opened from the Workflow pending-approval email; no SPA login.
export default function Page() {
    return (
        <Suspense fallback={<div className="py-16 text-center text-sm text-[#5e3f3a]">Đang tải...</div>}>
            <WorkflowApprovalConfirmPage />
        </Suspense>
    );
}
