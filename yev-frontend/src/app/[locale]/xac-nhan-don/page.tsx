import { Suspense } from "react";
import OtFormEmailConfirmPage from "@/modules/attendance/components/public-confirm/OtFormEmailConfirmPage";

// Public route opened from the OT approve/reject email; no SPA login.
export default function Page() {
    return (
        <Suspense fallback={<div className="py-16 text-center text-sm text-[#5e3f3a]">Đang tải...</div>}>
            <OtFormEmailConfirmPage />
        </Suspense>
    );
}
