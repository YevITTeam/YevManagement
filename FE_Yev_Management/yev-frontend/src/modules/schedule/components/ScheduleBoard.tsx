"use client";

import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { CalendarClock, Pencil, Plus, RotateCw, Save, Trash2 } from "lucide-react";

import { ScheduleApi } from "../api/schedule.api";
import type { Member, SchedulePlan, ScheduleTask } from "../types/schedule";
import { diffDays, formatVN, parseDate, toISODate, todayUTC } from "../lib/date";
import { getVariance, varianceMeta } from "../lib/task";
import SchedulePlanForm, { type SchedulePlanFormValues } from "./SchedulePlanForm";
import ScheduleGantt from "./ScheduleGantt";
import MembersBar from "./MembersBar";
import PlanTaskTable from "./PlanTaskTable";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import { useFetchEffect } from "@/modules/common/hooks/useFetchEffect";

const makeId = (): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const emptyTask = (): ScheduleTask => ({
  id: makeId(),
  content: "",
  assigneeId: "",
  status: "todo",
  dueDate: "",
  completedDate: "",
});

export default function ScheduleBoard() {
  const [members, setMembers] = useState<Member[]>([]);
  const [plans, setPlans] = useState<SchedulePlan[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  // Có thay đổi chưa lưu xuống file hay không.
  const [dirty, setDirty] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [editingPlan, setEditingPlan] = useState<SchedulePlan | null>(null);

  const [deletingPlan, setDeletingPlan] = useState<SchedulePlan | null>(null);

  const { isLoading, error, refetch: fetchBoard } = useFetchEffect(
    () => ScheduleApi.getBoard(),
    [],
    (board) => {
      setMembers(board.members);
      setPlans(board.plans);
      setDirty(false);
    },
    "Không thể tải lịch trình.",
    (message) => toast.error(message)
  );

  // Cảnh báo khi rời trang mà còn thay đổi chưa lưu.
  useEffect(() => {
    if (!dirty) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  // --- Thành viên ---
  const addMember = (name: string) => {
    setMembers((current) => [...current, { id: makeId(), name }]);
    setDirty(true);
  };

  const removeMember = (id: string) => {
    setMembers((current) => current.filter((member) => member.id !== id));
    // Gỡ khỏi các task đang giao cho thành viên này.
    setPlans((current) =>
      current.map((plan) => ({
        ...plan,
        tasks: plan.tasks.map((task) => (task.assigneeId === id ? { ...task, assigneeId: "" } : task)),
      }))
    );
    setDirty(true);
  };

  // --- Kế hoạch ---
  const openCreateForm = () => {
    setFormMode("create");
    setEditingPlan(null);
    setFormOpen(true);
  };

  const openEditForm = (plan: SchedulePlan) => {
    setFormMode("edit");
    setEditingPlan(plan);
    setFormOpen(true);
  };

  const handleSubmitForm = (values: SchedulePlanFormValues) => {
    if (formMode === "create") {
      setPlans((current) => [...current, { id: makeId(), ...values, tasks: [] }]);
    } else if (editingPlan) {
      setPlans((current) => current.map((plan) => (plan.id === editingPlan.id ? { ...plan, ...values } : plan)));
    }
    setDirty(true);
    setFormOpen(false);
    setEditingPlan(null);
  };

  const handleDelete = () => {
    if (!deletingPlan) return;
    setPlans((current) => current.filter((plan) => plan.id !== deletingPlan.id));
    setDirty(true);
    setDeletingPlan(null);
  };

  // Kéo/thả bar trên biểu đồ để đổi ngày bắt đầu/kết thúc.
  const handleChangeDates = (planId: string, startISO: string, endISO: string) => {
    setPlans((current) =>
      current.map((plan) => (plan.id === planId ? { ...plan, startDate: startISO, endDate: endISO } : plan))
    );
    setDirty(true);
  };

  // --- Task ---
  const updateTask = (planId: string, taskId: string, patch: Partial<ScheduleTask>) => {
    setPlans((current) =>
      current.map((plan) => {
        if (plan.id !== planId) return plan;
        return {
          ...plan,
          tasks: plan.tasks.map((task) => {
            if (task.id !== taskId) return task;
            const next = { ...task, ...patch };
            // Chuyển sang "Hoàn thành" mà chưa có ngày → tự điền hôm nay; rời khỏi "Hoàn thành" → xoá ngày.
            if (patch.status && patch.status !== task.status) {
              if (patch.status === "done" && !next.completedDate) next.completedDate = toISODate(todayUTC());
              if (patch.status !== "done") next.completedDate = "";
            }
            return next;
          }),
        };
      })
    );
    setDirty(true);
  };

  const addTask = (planId: string) => {
    setPlans((current) =>
      current.map((plan) => (plan.id === planId ? { ...plan, tasks: [...plan.tasks, emptyTask()] } : plan))
    );
    setDirty(true);
  };

  const deleteTask = (planId: string, taskId: string) => {
    setPlans((current) =>
      current.map((plan) =>
        plan.id === planId ? { ...plan, tasks: plan.tasks.filter((task) => task.id !== taskId) } : plan
      )
    );
    setDirty(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const saved = await ScheduleApi.saveBoard({ members, plans });
      setMembers(saved.members);
      setPlans(saved.plans);
      setDirty(false);
      toast.success("Đã lưu lịch trình vào file");
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Lưu lịch trình thất bại");
    } finally {
      setIsSaving(false);
    }
  };

  // --- Thống kê tổng ---
  const allTasks = plans.flatMap((plan) => plan.tasks);
  const todayIso = toISODate(todayUTC());
  const stats = {
    total: allTasks.length,
    done: allTasks.filter((task) => task.status === "done").length,
    inProgress: allTasks.filter((task) => task.status === "in_progress").length,
    overdue: allTasks.filter((task) => task.status !== "done" && task.dueDate && task.dueDate < todayIso).length,
  };

  return (
    <div className="min-h-[80vh] bg-[#f8fafc] px-6 py-10">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-semibold text-[#191c1e]">
              <CalendarClock className="h-7 w-7 text-[#e3000f]" />
              Lịch trình phát triển phần mềm
            </h1>
            <p className="mt-1 text-[15px] text-[#5e3f3a]">
              Quản lý dự án: giao task cho thành viên, theo dõi trạng thái và tiến độ so với kế hoạch. Lưu vào file{" "}
              <span className="font-mono text-[13px]">LichTrinh.txt</span>.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={fetchBoard}
              disabled={isLoading || isSaving}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#e0e3e5] bg-white px-3 py-1.5 text-xs font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6] disabled:opacity-50"
            >
              <RotateCw className="h-3.5 w-3.5" /> Làm mới
            </button>
            <button
              onClick={openCreateForm}
              disabled={isSaving}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#e0e3e5] bg-white px-3 py-1.5 text-xs font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6] disabled:opacity-50"
            >
              <Plus className="h-3.5 w-3.5" /> Thêm kế hoạch
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving || !dirty}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-[#e3000f] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#b40009] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Save className="h-3.5 w-3.5" /> {isSaving ? "Đang lưu..." : "Lưu vào file"}
            </button>
          </div>
        </div>

        {dirty && (
          <div className="rounded-lg border border-[#f2c94c] bg-[#fffbeb] px-4 py-2.5 text-sm text-[#8a6d0b]">
            Bạn có thay đổi chưa lưu. Nhấn <strong>Lưu vào file</strong> để ghi vào LichTrinh.txt.
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-[#e9bcb6] bg-[#fff4f2] px-4 py-3 text-sm text-[#930006]">{error}</div>
        )}

        {isLoading ? (
          <div className="rounded-xl border border-[#e0e3e5] bg-white p-10 text-center text-sm text-[#5e3f3a]">
            Đang tải lịch trình...
          </div>
        ) : (
          <>
            <MembersBar members={members} onAdd={addMember} onRemove={removeMember} />

            {plans.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[#e0e3e5] bg-white p-10 text-center">
                <p className="text-sm text-[#5e3f3a]">Chưa có kế hoạch nào. Bấm “Thêm kế hoạch” để bắt đầu.</p>
              </div>
            ) : (
              <>
                {/* Thống kê nhanh */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <StatCard label="Tổng task" value={stats.total} />
                  <StatCard label="Hoàn thành" value={stats.done} tone="text-[#047857]" />
                  <StatCard label="Đang làm" value={stats.inProgress} tone="text-[#b45309]" />
                  <StatCard label="Trễ hạn" value={stats.overdue} tone="text-[#930006]" />
                </div>

                <ScheduleGantt plans={plans} onChangeDates={handleChangeDates} />

                <div className="flex flex-col gap-4">
                  {plans.map((plan) => (
                    <PlanCard
                      key={plan.id}
                      plan={plan}
                      members={members}
                      onEdit={() => openEditForm(plan)}
                      onDelete={() => setDeletingPlan(plan)}
                      onUpdateTask={(taskId, patch) => updateTask(plan.id, taskId, patch)}
                      onAddTask={() => addTask(plan.id)}
                      onDeleteTask={(taskId) => deleteTask(plan.id, taskId)}
                    />
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>

      <SchedulePlanForm
        isOpen={formOpen}
        mode={formMode}
        initial={editingPlan}
        onClose={() => {
          setFormOpen(false);
          setEditingPlan(null);
        }}
        onSubmit={handleSubmitForm}
      />

      <ConfirmDialog
        isOpen={deletingPlan !== null}
        title="Xoá kế hoạch"
        message={
          <>
            Bạn có chắc muốn xoá kế hoạch <strong>{deletingPlan?.name}</strong> không? Thay đổi chỉ áp dụng sau khi bạn
            nhấn “Lưu vào file”.
          </>
        }
        approveLabel="Xoá"
        deniedLabel="Huỷ"
        onApprove={handleDelete}
        onDenied={() => setDeletingPlan(null)}
      />
    </div>
  );
}

function StatCard({ label, value, tone = "text-[#191c1e]" }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-xl border border-[#e0e3e5] bg-white px-4 py-3 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#5e3f3a]">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${tone}`}>{value}</p>
    </div>
  );
}

interface PlanCardProps {
  plan: SchedulePlan;
  members: Member[];
  onEdit: () => void;
  onDelete: () => void;
  onUpdateTask: (taskId: string, patch: Partial<ScheduleTask>) => void;
  onAddTask: () => void;
  onDeleteTask: (taskId: string) => void;
}

function PlanCard({ plan, members, onEdit, onDelete, onUpdateTask, onAddTask, onDeleteTask }: PlanCardProps) {
  const start = parseDate(plan.startDate);
  const end = parseDate(plan.endDate);
  const durationDays = start && end && diffDays(start, end) >= 0 ? diffDays(start, end) + 1 : null;

  const doneCount = plan.tasks.filter((task) => task.status === "done").length;
  const progress = plan.tasks.length > 0 ? Math.round((doneCount / plan.tasks.length) * 100) : 0;

  // Tiến độ kế hoạch: khi tất cả task đã xong, so ngày xong muộn nhất với ngày kết thúc kế hoạch.
  const allDone = plan.tasks.length > 0 && doneCount === plan.tasks.length;
  const latestCompleted = allDone
    ? plan.tasks.reduce((acc, task) => (task.completedDate > acc ? task.completedDate : acc), "")
    : "";
  const planVariance = allDone && plan.endDate ? varianceMeta(getVariance(plan.endDate, latestCompleted)) : null;

  return (
    <div className="rounded-xl border border-[#e0e3e5] bg-white p-6 shadow-sm transition hover:shadow-md">
      <div className="flex flex-col gap-3 border-b border-[#f1f5f9] pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-[#191c1e]">{plan.name}</h3>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-[#5e3f3a]">
            {start && end && (
              <span className="inline-flex items-center gap-1 rounded-full bg-[#fff4f2] px-2.5 py-0.5 text-xs font-semibold text-[#e3000f]">
                <CalendarClock className="h-3.5 w-3.5" /> {formatVN(start)} → {formatVN(end)}
              </span>
            )}
            {durationDays !== null && <span className="text-xs">{durationDays} ngày</span>}
            {plan.tasks.length > 0 && (
              <span className="text-xs">
                {doneCount}/{plan.tasks.length} task ({progress}%)
              </span>
            )}
            {planVariance && (
              <span className={`text-xs font-semibold ${planVariance.className}`}>
                {planVariance.label} so với kế hoạch
              </span>
            )}
          </div>

          {plan.tasks.length > 0 && (
            <div className="mt-2 h-1.5 w-48 max-w-full overflow-hidden rounded-full bg-[#f1f5f9]">
              <div className="h-full rounded-full bg-[#e3000f]" style={{ width: `${progress}%` }} />
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={onEdit}
            className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-[#e0e3e5] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6]"
          >
            <Pencil className="h-3.5 w-3.5" /> Sửa
          </button>
          <button
            onClick={onDelete}
            className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-[#e0e3e5] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#930006] transition hover:bg-[#fff4f2]"
          >
            <Trash2 className="h-3.5 w-3.5" /> Xoá
          </button>
        </div>
      </div>

      <PlanTaskTable
        tasks={plan.tasks}
        members={members}
        onUpdateTask={onUpdateTask}
        onAddTask={onAddTask}
        onDeleteTask={onDeleteTask}
      />
    </div>
  );
}
