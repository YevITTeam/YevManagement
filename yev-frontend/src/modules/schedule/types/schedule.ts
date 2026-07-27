// Kiểu dữ liệu cho module "Lịch trình phát triển phần mềm" (công cụ quản lý dự án mini).
// Toàn bộ dữ liệu được lưu dưới dạng JSON trong file src/assets/file-schedule/LichTrinh.txt
// (đọc/ghi qua route handler /api/schedule — thuần FE Next.js, không liên quan BE .NET).

// Trạng thái của một task.
export type TaskStatus = "todo" | "in_progress" | "done";

// Thành viên tham gia dự án (để giao task).
export interface Member {
  id: string;
  name: string;
}

// Một task trong kế hoạch (trước đây là "step").
export interface ScheduleTask {
  id: string;
  content: string; // nội dung task
  assigneeId: string; // id thành viên phụ trách ("" = chưa giao)
  status: TaskStatus; // trạng thái
  dueDate: string; // hạn hoàn thành, ISO "YYYY-MM-DD" ("" = chưa đặt)
  completedDate: string; // ngày hoàn thành thực tế, ISO "YYYY-MM-DD" ("" = chưa xong)
}

// Một kế hoạch phát triển.
export interface SchedulePlan {
  id: string;
  name: string; // tên kế hoạch
  startDate: string; // ngày bắt đầu, ISO "YYYY-MM-DD" ("" = chưa đặt)
  endDate: string; // ngày kết thúc, ISO "YYYY-MM-DD" ("" = chưa đặt)
  tasks: ScheduleTask[]; // danh sách task
}

// Toàn bộ dữ liệu bảng lịch trình (lưu trong 1 file).
export interface ScheduleBoard {
  members: Member[];
  plans: SchedulePlan[];
}
