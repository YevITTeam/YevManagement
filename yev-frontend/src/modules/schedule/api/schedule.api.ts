import type { ScheduleBoard } from "../types/schedule";

// Hits the internal Next.js route handler, so plain relative fetch instead of lib/client.ts (BE prefix + token).
const ENDPOINT = "/api/schedule";

const parseError = async (response: Response, fallback: string): Promise<string> => {
  try {
    const data = await response.json();
    if (data && typeof data.message === "string" && data.message.trim()) return data.message;
  } catch {
    // Not JSON: use the fallback.
  }
  return fallback;
};

export const ScheduleApi = {
  getBoard: async (): Promise<ScheduleBoard> => {
    const response = await fetch(ENDPOINT, { cache: "no-store" });
    if (!response.ok) throw new Error(await parseError(response, "Không thể đọc lịch trình."));
    const data = (await response.json()) as Partial<ScheduleBoard>;
    return { members: data.members ?? [], plans: data.plans ?? [] };
  },

  // Overwrites the whole LichTrinh.txt file.
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
