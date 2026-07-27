"use client";

import { Plus, Trash2 } from "lucide-react";

import type { Member, ScheduleTask, TaskStatus } from "../types/schedule";
import { getVariance, initialsOf, memberColor, statusMeta, TASK_STATUSES, varianceMeta } from "../lib/task";

interface PlanTaskTableProps {
  tasks: ScheduleTask[];
  members: Member[];
  onUpdateTask: (taskId: string, patch: Partial<ScheduleTask>) => void;
  onAddTask: () => void;
  onDeleteTask: (taskId: string) => void;
}

const cellInputClass =
  "h-9 w-full rounded-lg border border-[#e0e3e5] bg-white px-2 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3]";

export default function PlanTaskTable({ tasks, members, onUpdateTask, onAddTask, onDeleteTask }: PlanTaskTableProps) {
  return (
    <div className="pt-4">
      {tasks.length === 0 ? (
        <p className="pb-3 text-sm text-[#5e3f3a]">Chưa có task nào. Bấm “Thêm task” để bắt đầu.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-[720px] border-collapse text-left">
            <thead>
              <tr className="border-b border-[#e0e3e5] text-[11px] font-semibold uppercase tracking-[0.12em] text-[#5e3f3a]">
                <th className="px-2 py-2">Trạng thái</th>
                <th className="px-2 py-2">Nội dung task</th>
                <th className="px-2 py-2">Phụ trách</th>
                <th className="px-2 py-2">Hạn</th>
                <th className="px-2 py-2">Hoàn thành</th>
                <th className="px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => {
                const variance = getVariance(task.dueDate, task.completedDate);
                const vMeta = varianceMeta(variance);
                const assigneeIndex = members.findIndex((member) => member.id === task.assigneeId);
                const assignee = assigneeIndex >= 0 ? members[assigneeIndex] : null;

                return (
                  <tr key={task.id} className="border-b border-[#f1f5f9] align-middle">
                    <td className="px-2 py-2">
                      <select
                        value={task.status}
                        onChange={(event) => onUpdateTask(task.id, { status: event.target.value as TaskStatus })}
                        className={`h-8 cursor-pointer rounded-full border-0 px-2.5 text-xs font-semibold outline-none ${statusMeta[task.status].badgeClass}`}
                      >
                        {TASK_STATUSES.map((status) => (
                          <option key={status} value={status}>
                            {statusMeta[status].label}
                          </option>
                        ))}
                      </select>
                    </td>

                    <td className="px-2 py-2">
                      <input
                        value={task.content}
                        onChange={(event) => onUpdateTask(task.id, { content: event.target.value })}
                        placeholder="Nội dung task..."
                        className={`${cellInputClass} min-w-[180px]`}
                      />
                    </td>

                    <td className="px-2 py-2">
                      <div className="flex items-center gap-2">
                        {assignee && (
                          <span
                            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white"
                            style={{ backgroundColor: memberColor(assigneeIndex) }}
                            title={assignee.name}
                          >
                            {initialsOf(assignee.name)}
                          </span>
                        )}
                        <select
                          value={task.assigneeId}
                          onChange={(event) => onUpdateTask(task.id, { assigneeId: event.target.value })}
                          className={`${cellInputClass} min-w-[130px] cursor-pointer`}
                        >
                          <option value="">— Chưa giao —</option>
                          {members.map((member) => (
                            <option key={member.id} value={member.id}>
                              {member.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </td>

                    <td className="px-2 py-2">
                      <input
                        type="date"
                        value={task.dueDate}
                        onChange={(event) => onUpdateTask(task.id, { dueDate: event.target.value })}
                        className={`${cellInputClass} min-w-[140px]`}
                      />
                    </td>

                    <td className="px-2 py-2">
                      {task.status === "done" ? (
                        <div className="flex flex-col gap-1">
                          <input
                            type="date"
                            value={task.completedDate}
                            onChange={(event) => onUpdateTask(task.id, { completedDate: event.target.value })}
                            className={`${cellInputClass} min-w-[140px]`}
                          />
                          {vMeta && <span className={`text-[11px] font-semibold ${vMeta.className}`}>{vMeta.label}</span>}
                        </div>
                      ) : (
                        <span className="text-sm text-[#9aa0a6]">—</span>
                      )}
                    </td>

                    <td className="px-2 py-2 text-right">
                      <button
                        onClick={() => onDeleteTask(task.id)}
                        className="cursor-pointer rounded-lg p-1.5 text-[#930006] transition hover:bg-[#fff4f2]"
                        aria-label="Xoá task"
                        title="Xoá task"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <button
        onClick={onAddTask}
        className="mt-3 inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#e0e3e5] bg-white px-3 py-1.5 text-xs font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6]"
      >
        <Plus className="h-3.5 w-3.5" /> Thêm task
      </button>
    </div>
  );
}
