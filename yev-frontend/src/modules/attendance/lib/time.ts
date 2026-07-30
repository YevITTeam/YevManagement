// TimeOnly string "HH:mm:ss" (hoặc "HH:mm") từ BE — tính số giờ giữa 2 mốc trong CÙNG 1 ngày.
// BE đã validate endTime luôn > startTime khi lưu (OtFormService.ValidateEmployeesAsync), nên FE
// không cần xử lý trường hợp qua đêm — chỉ Math.max(0, ...) phòng dữ liệu cũ/hiếm gặp bất thường.
export function calculateHours(startTime: string, endTime: string): number {
    const [startH, startM] = startTime.split(":").map(Number);
    const [endH, endM] = endTime.split(":").map(Number);
    const minutes = endH * 60 + endM - (startH * 60 + startM);
    return Math.max(0, minutes / 60);
}

// Cùng quy ước hiển thị "{value}h" đã dùng cho monthToDate/yearToDate/totalHour trên các màn OT —
// làm tròn 2 chữ số thập phân, bỏ số 0 thừa (2 → "2h", 2.5 → "2.5h", 2.25 → "2.25h").
export function formatHours(hours: number): string {
    const rounded = Math.round(hours * 100) / 100;
    return `${rounded}h`;
}
