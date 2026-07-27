import type { ScheduleBoard } from "../types/schedule";

// Gọi route handler nội bộ /api/schedule (thuần Next.js FE) — KHÔNG dùng lib/client.ts vì đó là
// wrapper cho BE .NET (tự thêm tiền tố NEXT_PUBLIC_API_URL + token). Ở đây là fetch tương đối tới
// chính app Next nên dùng fetch gốc.
const ENDPOINT = "/api/schedule";

const parseError = async (response: Response, fallback: string): Promise<string> => {
  try {
    const data = await response.json();
    if (data && typeof data.message === "string" && data.message.trim()) return data.message;
  } catch {
    // response không phải JSON — dùng fallback.
  }
  return fallback;
};

export const ScheduleApi = {
  // Đọc toàn bộ dữ liệu (thành viên + kế hoạch) từ file LichTrinh.txt.
  getBoard: async (): Promise<ScheduleBoard> => {
    const response = await fetch(ENDPOINT, { cache: "no-store" });
    if (!response.ok) throw new Error(await parseError(response, "Không thể đọc lịch trình."));
    const data = (await response.json()) as Partial<ScheduleBoard>;
    return { members: data.members ?? [], plans: data.plans ?? [] };
  },

  // Ghi đè toàn bộ dữ liệu xuống file LichTrinh.txt.
  saveBoard: async (board: ScheduleBoard): Promise<ScheduleBoard> => {
    const response = await fetch(ENDPOINT, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(board),
    });
    if (!response.ok) throw new Error(await parseError(response, "Không thể lưu lịch trình."));
    const data = (await response.json()) as Partial<ScheduleBoard>;
    return { members: data.members ?? [], plans: data.plans ?? [] };
  },
};
