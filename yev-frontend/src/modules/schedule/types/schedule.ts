// Stored as JSON in src/assets/file-schedule/LichTrinh.txt via the Next route /api/schedule;
// not backed by the .NET BE.

export type TaskStatus = "todo" | "in_progress" | "done";

export interface Member {
  id: string;
  name: string;
}

export interface ScheduleTask {
  id: string;
  content: string;
  assigneeId: string; // "" = unassigned
  status: TaskStatus;
  dueDate: string; // ISO "YYYY-MM-DD", "" = not set
  completedDate: string; // ISO "YYYY-MM-DD", "" = not done
}

export interface SchedulePlan {
  id: string;
  name: string;
  startDate: string; // ISO "YYYY-MM-DD", "" = not set
  endDate: string; // ISO "YYYY-MM-DD", "" = not set
  tasks: ScheduleTask[];
}

export interface ScheduleBoard {
  members: Member[];
  plans: SchedulePlan[];
}
