import { Suspense } from "react";
import SecondaryPasswordConfirmPage from "@/modules/attendance/components/public-confirm/SecondaryPasswordConfirmPage";

// Public route opened from the secondary-password confirmation email; no SPA login.
export default function Page() {
    return (
        <Suspense fallback={<div className="py-16 text-center text-sm text-[#5e3f3a]">Đang tải...</div>}>
            <SecondaryPasswordConfirmPage />
        </Suspense>
    );
}
