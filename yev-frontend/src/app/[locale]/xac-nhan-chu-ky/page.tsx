import { Suspense } from "react";
import SignatureConfirmPage from "@/modules/attendance/components/public-confirm/SignatureConfirmPage";

// Public route opened from the signature-confirmation email; no SPA login.
export default function Page() {
    return (
        <Suspense fallback={<div className="py-16 text-center text-sm text-[#5e3f3a]">Đang tải...</div>}>
            <SignatureConfirmPage />
        </Suspense>
    );
}
