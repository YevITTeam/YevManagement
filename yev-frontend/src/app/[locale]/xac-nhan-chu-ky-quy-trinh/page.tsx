import { Suspense } from "react";
import EmployeeSignatureConfirmPage from "@/modules/workflow/components/public-confirm/EmployeeSignatureConfirmPage";

// Route public — mở qua link email "Xác nhận cập nhật chữ ký" của module Workflow (mirror
// xac-nhan-chu-ky của Attendance — 2 route tách riêng vì workflow-module.md §1.1 module độc lập).
// Không nằm trong sơ đồ menu, không cần đăng nhập SPA.
export default function Page() {
    return (
        <Suspense fallback={<div className="py-16 text-center text-sm text-[#5e3f3a]">Đang tải...</div>}>
            <EmployeeSignatureConfirmPage />
        </Suspense>
    );
}
