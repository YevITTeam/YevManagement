// Tiện ích xử lý ngày cho module lịch trình. Dùng UTC xuyên suốt để tránh lệch múi giờ khi
// so sánh/cộng ngày (chỉ quan tâm tới ngày, không quan tâm giờ).

const MS_PER_DAY = 86_400_000;

// Parse chuỗi "YYYY-MM-DD" → Date (UTC 00:00). Trả null nếu sai định dạng / không hợp lệ.
export const parseDate = (value: string): Date | null => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(date.getTime())) return null;
  // Chặn ngày kiểu 2026-02-31 bị JS tự "tràn" sang tháng sau.
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null;
  }
  return date;
};

// Date → chuỗi ISO "YYYY-MM-DD".
export const toISODate = (date: Date): string => date.toISOString().slice(0, 10);

// Cộng thêm n ngày (n có thể âm) vào một Date UTC.
export const addDays = (date: Date, n: number): Date => new Date(date.getTime() + n * MS_PER_DAY);

// Số ngày từ a → b (b - a). Cùng ngày = 0.
export const diffDays = (a: Date, b: Date): number => Math.round((b.getTime() - a.getTime()) / MS_PER_DAY);

// Hôm nay theo UTC (đã cắt về 00:00) để so sánh với domain của biểu đồ.
export const todayUTC = (): Date => {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
};

// Định dạng hiển thị tiếng Việt "dd/MM/yyyy".
export const formatVN = (date: Date): string => {
  const d = String(date.getUTCDate()).padStart(2, "0");
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${d}/${m}/${date.getUTCFullYear()}`;
};

// Định dạng ngắn "dd/MM" cho mốc trục biểu đồ.
export const formatShort = (date: Date): string => {
  const d = String(date.getUTCDate()).padStart(2, "0");
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${d}/${m}`;
};
