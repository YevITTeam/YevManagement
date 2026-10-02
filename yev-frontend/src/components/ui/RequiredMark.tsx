// Dấu (*) đỏ đặt cạnh label của field bắt buộc nhập — dùng chung cho mọi form Asset/Attendance.
// Màu #930006 khớp đúng convention đã có sẵn ở SecondaryPasswordDialog.tsx (màu "lỗi" trong bảng màu
// thương hiệu, AGENTS.md §4.7) — không dùng đỏ nhấn #e3000f vì đó là màu hành động (nút/link).
export function RequiredMark() {
    return (
        <span className="text-[#930006]" aria-hidden="true">
            {" "}
            *
        </span>
    );
}
