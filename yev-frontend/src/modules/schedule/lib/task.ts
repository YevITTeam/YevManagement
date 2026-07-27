import type { TaskStatus } from "../types/schedule";
import { diffDays, parseDate } from "./date";

// Thứ tự trạng thái hiển thị trong dropdown.
export const TASK_STATUSES: TaskStatus[] = ["todo", "in_progress", "done"];

// Metadata hiển thị cho từng trạng thái (nhãn tiếng Việt + class màu badge).
export const statusMeta: Record<TaskStatus, { label: string; badgeClass: string; dotClass: string }> = {
  todo: { label: "Chưa làm", badgeClass: "bg-[#f1f5f9] text-[#5e3f3a]", dotClass: "bg-[#9aa0a6]" },
  in_progress: { label: "Đang làm", badgeClass: "bg-[#fff4e5] text-[#b45309]", dotClass: "bg-[#d97706]" },
  done: { label: "Hoàn thành", badgeClass: "bg-[#e6f6ec] text-[#047857]", dotClass: "bg-[#059669]" },
};

// Bảng màu cho avatar thành viên (gán theo thứ tự).
const MEMBER_COLORS = ["#e3000f", "#2563eb", "#059669", "#d97706", "#7c3aed", "#0891b2", "#db2777", "#65a30d"];
export const memberColor = (index: number): string => MEMBER_COLORS[index % MEMBER_COLORS.length];

// Lấy chữ cái viết tắt của tên (avatar): "Nguyễn Văn An" → "NA".
export const initialsOf = (name: string): string => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

export type Variance = { kind: "early" | "ontime" | "late" | "none"; days: number };

// So sánh ngày hoàn thành thực tế với hạn: sớm / đúng / trễ bao nhiêu ngày.
export const getVariance = (dueDate: string, completedDate: string): Variance => {
  const due = parseDate(dueDate);
  const done = parseDate(completedDate);
  if (!due || !done) return { kind: "none", days: 0 };
  const delta = diffDays(done, due); // due - done: dương = xong trước hạn
  if (delta > 0) return { kind: "early", days: delta };
  if (delta < 0) return { kind: "late", days: -delta };
  return { kind: "ontime", days: 0 };
};

// Nhãn + màu cho một variance (dùng chung ở nhiều chỗ).
export const varianceMeta = (v: Variance): { label: string; className: string } | null => {
  switch (v.kind) {
    case "early":
      return { label: `Sớm ${v.days} ngày`, className: "text-[#047857]" };
    case "late":
      return { label: `Trễ ${v.days} ngày`, className: "text-[#930006]" };
    case "ontime":
      return { label: "Đúng hạn", className: "text-[#5e3f3a]" };
    default:
      return null;
  }
};
