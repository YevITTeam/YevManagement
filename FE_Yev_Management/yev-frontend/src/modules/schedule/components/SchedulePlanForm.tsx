"use client";

import { useState } from "react";
import { X } from "lucide-react";

import type { SchedulePlan } from "../types/schedule";
import { useDialogReset } from "@/modules/common/hooks/useDialogReset";

export interface SchedulePlanFormValues {
  name: string;
  startDate: string;
  endDate: string;
}

interface SchedulePlanFormProps {
  isOpen: boolean;
  mode: "create" | "edit";
  initial?: SchedulePlan | null;
  onClose: () => void;
  onSubmit: (values: SchedulePlanFormValues) => void;
}

const fieldLabelClassName = "mb-1.5 block text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]";
const fieldClassName =
  "h-10 w-full rounded-lg border border-[#e0e3e5] bg-white px-3 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3]";

export default function SchedulePlanForm({ isOpen, mode, initial, onClose, onSubmit }: SchedulePlanFormProps) {
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  useDialogReset(isOpen, initial, (current) => {
    setName(current?.name ?? "");
    setStartDate(current?.startDate ?? "");
    setEndDate(current?.endDate ?? "");
  });

  // Ngày kết thúc không được trước ngày bắt đầu.
  const dateError = startDate && endDate && endDate < startDate ? "Ngày kết thúc phải sau ngày bắt đầu." : "";

  if (!isOpen) return null;

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim() || dateError) return;
    onSubmit({ name: name.trim(), startDate, endDate });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="schedule-form-title"
        className="z-60 mx-4 w-full max-w-md rounded-xl border border-[#e0e3e5] bg-white p-6 shadow-xl"
      >
        <div className="mb-4 flex items-center justify-between border-b border-[#e0e3e5] pb-4">
          <h3 id="schedule-form-title" className="text-lg font-semibold text-[#191c1e]">
            {mode === "create" ? "Thêm kế hoạch" : "Cập nhật kế hoạch"}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer text-[#5e3f3a] transition hover:text-[#191c1e]"
            aria-label="Đóng"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block">
            <span className={fieldLabelClassName}>Tên kế hoạch</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Nhập tên kế hoạch..."
              autoFocus
              required
              className={fieldClassName}
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className={fieldLabelClassName}>Ngày bắt đầu</span>
              <input
                type="date"
                value={startDate}
                max={endDate || undefined}
                onChange={(event) => setStartDate(event.target.value)}
                className={fieldClassName}
              />
            </label>
            <label className="block">
              <span className={fieldLabelClassName}>Ngày kết thúc</span>
              <input
                type="date"
                value={endDate}
                min={startDate || undefined}
                onChange={(event) => setEndDate(event.target.value)}
                className={fieldClassName}
              />
            </label>
          </div>
          {dateError && <p className="text-xs font-medium text-[#930006]">{dateError}</p>}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="cursor-pointer rounded-lg border border-[#e0e3e5] bg-white px-4 py-2 text-sm font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6]"
            >
              Huỷ
            </button>
            <button
              type="submit"
              disabled={Boolean(dateError)}
              className="cursor-pointer rounded-lg bg-[#e3000f] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#b40009] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {mode === "create" ? "Thêm vào danh sách" : "Cập nhật"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
