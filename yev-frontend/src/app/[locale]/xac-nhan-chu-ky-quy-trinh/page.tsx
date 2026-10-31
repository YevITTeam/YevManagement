import { Suspense } from "react";
import EmployeeSignatureConfirmPage from "@/modules/workflow/components/public-confirm/EmployeeSignatureConfirmPage";

// Public route opened from the Workflow signature-confirmation email; no SPA login.
export default function Page() {
    return (
        <Suspense fallback={<div className="py-16 text-center text-sm text-[#5e3f3a]">Đang tải...</div>}>
            <EmployeeSignatureConfirmPage />
        </Suspense>
    );
}
