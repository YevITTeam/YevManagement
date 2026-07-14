import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

import type { Member, ScheduleBoard, SchedulePlan, ScheduleTask, TaskStatus } from "@/modules/schedule/types/schedule";

// Route handler thuần FE (chạy trên Next server, KHÔNG gọi BE .NET). Đọc/ghi trực tiếp file
// LichTrinh.txt trên đĩa. Dữ liệu lưu dưới dạng JSON để round-trip (đọc → sửa → ghi) chắc chắn.
const FILE_PATH = path.join(process.cwd(), "src", "assets", "file-schedule", "LichTrinh.txt");

// Không cache — luôn đọc nội dung mới nhất từ đĩa.
export const dynamic = "force-dynamic";

const toStringSafe = (value: unknown): string => (typeof value === "string" ? value : "");

const makeId = (): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const VALID_STATUS = new Set<TaskStatus>(["todo", "in_progress", "done"]);

// Chuẩn hoá 1 task, có migrate dữ liệu cũ (step chỉ có `done: boolean`).
const sanitizeTasks = (raw: unknown): ScheduleTask[] => {
  if (!Array.isArray(raw)) return [];

  return raw.map((item): ScheduleTask => {
    const task = (item ?? {}) as Record<string, unknown>;
    const statusRaw = toStringSafe(task.status);
    const status: TaskStatus = VALID_STATUS.has(statusRaw as TaskStatus)
      ? (statusRaw as TaskStatus)
      : task.done === true
        ? "done"
        : "todo";

    return {
      id: toStringSafe(task.id) || makeId(),
      content: toStringSafe(task.content),
      assigneeId: toStringSafe(task.assigneeId),
      status,
      dueDate: toStringSafe(task.dueDate),
      completedDate: toStringSafe(task.completedDate),
    };
  });
};

const sanitizePlans = (raw: unknown): SchedulePlan[] => {
  if (!Array.isArray(raw)) return [];

  return raw.map((item): SchedulePlan => {
    const plan = (item ?? {}) as Record<string, unknown>;
    // Nhận cả `tasks` (mới) lẫn `steps` (cũ) để không mất dữ liệu.
    const tasksRaw = Array.isArray(plan.tasks) ? plan.tasks : Array.isArray(plan.steps) ? plan.steps : [];

    return {
      id: toStringSafe(plan.id) || makeId(),
      name: toStringSafe(plan.name),
      startDate: toStringSafe(plan.startDate),
      endDate: toStringSafe(plan.endDate),
      tasks: sanitizeTasks(tasksRaw),
    };
  });
};

const sanitizeMembers = (raw: unknown): Member[] => {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item): Member => {
      const member = (item ?? {}) as Record<string, unknown>;
      return { id: toStringSafe(member.id) || makeId(), name: toStringSafe(member.name) };
    })
    .filter((member) => member.name.trim().length > 0);
};

// Hỗ trợ cả định dạng cũ (mảng plans thuần) lẫn mới (object { members, plans }).
const sanitizeBoard = (raw: unknown): ScheduleBoard => {
  if (Array.isArray(raw)) return { members: [], plans: sanitizePlans(raw) };
  const obj = (raw ?? {}) as Record<string, unknown>;
  return { members: sanitizeMembers(obj.members), plans: sanitizePlans(obj.plans) };
};

// Đọc file → parse JSON. Nếu file trống / không phải JSON → trả board rỗng.
const readBoard = async (): Promise<ScheduleBoard> => {
  let content: string;
  try {
    content = await fs.readFile(FILE_PATH, "utf-8");
  } catch {
    return { members: [], plans: [] };
  }

  const trimmed = content.trim();
  if (!trimmed) return { members: [], plans: [] };

  try {
    return sanitizeBoard(JSON.parse(trimmed));
  } catch {
    return { members: [], plans: [] };
  }
};

export async function GET() {
  try {
    const board = await readBoard();
    return NextResponse.json(board);
  } catch (error) {
    console.error("Đọc lịch trình thất bại:", error);
    return NextResponse.json({ message: "Không thể đọc file lịch trình." }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const board = sanitizeBoard(body);

    await fs.mkdir(path.dirname(FILE_PATH), { recursive: true });
    await fs.writeFile(FILE_PATH, JSON.stringify(board, null, 2), "utf-8");

    return NextResponse.json(board);
  } catch (error) {
    console.error("Ghi lịch trình thất bại:", error);
    return NextResponse.json({ message: "Không thể lưu file lịch trình." }, { status: 500 });
  }
}
