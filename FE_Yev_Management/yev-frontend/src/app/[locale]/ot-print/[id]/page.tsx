import OtFormPrintView from "@/modules/attendance/components/ot-form/OtFormPrintView";

// Route riêng cho "In đơn" (docs/attendance-api-fe.md §8) — cố ý đặt NGOÀI nhóm (ot-manager) để không bị
// OtManagerSidebar/OtAccessGuard chen vào bản in; Header vẫn hiện nhưng bị ẩn qua CSS `print:hidden` khi
// in. Quyền xem vẫn do BE tự enforce qua permission Attendance.OTForm.View như mọi API khác.
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    return <OtFormPrintView id={Number(id)} />;
}
