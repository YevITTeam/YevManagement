"use client";

import { useState } from "react";
import { X } from "lucide-react";
import type { SoftwareDto } from "@/modules/pc-management/types/software.dto";
import type { SoftwareGroupDto } from "@/modules/pc-management/types/software-group.dto";
import { useDialogReset } from "@/modules/common/hooks/useDialogReset";

export interface SoftwareFormValues {
    softwareCode: string;
    softwareName: string;
    softwareType: string;
    publisher: string;
    softwareQuantity: string;
    softwarePriority: string;
    softwareGroupId: string;
}

interface SoftwareFormProps {
    isOpen: boolean;
    mode: "create" | "edit";
    initial?: SoftwareDto | null;
    groups: SoftwareGroupDto[];
    loading?: boolean;
    onClose: () => void;
    onSubmit: (values: SoftwareFormValues) => void | Promise<void>;
}

const emptyValues: SoftwareFormValues = {
    softwareCode: "",
    softwareName: "",
    softwareType: "",
    publisher: "",
    softwareQuantity: "",
    softwarePriority: "",
    softwareGroupId: "",
};

const fieldLabelClassName = "mb-1.5 block text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]";
const fieldClassName =
    "h-10 w-full rounded-lg border border-[#e0e3e5] bg-white px-3 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3] disabled:cursor-not-allowed disabled:bg-[#f8fafc]";

export default function SoftwareForm({ isOpen, mode, initial, groups, loading = false, onClose, onSubmit }: SoftwareFormProps) {
    const [values, setValues] = useState<SoftwareFormValues>(emptyValues);

    useDialogReset(isOpen, initial, (current) => {
        setValues(
            current
                ? {
                      softwareCode: current.softwareCode,
                      softwareName: current.softwareName,
                      softwareType: current.softwareType ?? "",
                      publisher: current.publisher ?? "",
                      softwareQuantity: current.softwareQuantity != null ? String(current.softwareQuantity) : "",
                      softwarePriority: current.softwarePriority != null ? String(current.softwarePriority) : "",
                      softwareGroupId: current.softwareGroupId != null ? String(current.softwareGroupId) : "",
                  }
                : emptyValues
        );
    });

    if (!isOpen) return null;

    const handleChange = (field: keyof SoftwareFormValues, value: string) => {
        setValues((current) => ({ ...current, [field]: value }));
    };

    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault();
        if (!values.softwareCode.trim() || !values.softwareName.trim() || !values.softwareGroupId) return;
        onSubmit(values);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="fixed inset-0 bg-black/40" onClick={() => !loading && onClose()} />

            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="software-form-title"
                className="z-60 mx-4 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-[#e0e3e5] bg-white p-6 shadow-xl"
            >
                <div className="mb-4 flex items-center justify-between border-b border-[#e0e3e5] pb-4">
                    <h3 id="software-form-title" className="text-lg font-semibold text-[#191c1e]">
                        {mode === "create" ? "Thêm phần mềm" : "Cập nhật phần mềm"}
                    </h3>
                    <button
                        type="button"
                        onClick={() => !loading && onClose()}
                        className="cursor-pointer text-[#5e3f3a] transition hover:text-[#191c1e]"
                        aria-label="Đóng"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <label className="block">
                            <span className={fieldLabelClassName}>Mã phần mềm</span>
                            <input
                                value={values.softwareCode}
                                onChange={(event) => handleChange("softwareCode", event.target.value)}
                                placeholder="Nhập mã phần mềm..."
                                disabled={loading}
                                autoFocus
                                required
                                className={fieldClassName}
                            />
                        </label>

                        <label className="block">
                            <span className={fieldLabelClassName}>Tên phần mềm</span>
                            <input
                                value={values.softwareName}
                                onChange={(event) => handleChange("softwareName", event.target.value)}
                                placeholder="Nhập tên phần mềm..."
                                disabled={loading}
                                required
                                className={fieldClassName}
                            />
                        </label>
                    </div>

                    <label className="block">
                        <span className={fieldLabelClassName}>Nhóm phần mềm</span>
                        <select
                            value={values.softwareGroupId}
                            onChange={(event) => handleChange("softwareGroupId", event.target.value)}
                            disabled={loading}
                            required
                            className={fieldClassName}
                        >
                            <option value="" disabled>
                                -- Chọn nhóm phần mềm --
                            </option>
                            {groups.map((group) => (
                                <option key={group.id} value={group.id}>
                                    {group.groupName}
                                </option>
                            ))}
                        </select>
                    </label>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <label className="block">
                            <span className={fieldLabelClassName}>Loại phần mềm</span>
                            <input
                                value={values.softwareType}
                                onChange={(event) => handleChange("softwareType", event.target.value)}
                                placeholder="Nhập loại phần mềm..."
                                disabled={loading}
                                className={fieldClassName}
                            />
                        </label>

                        <label className="block">
                            <span className={fieldLabelClassName}>Nhà phát hành</span>
                            <input
                                value={values.publisher}
                                onChange={(event) => handleChange("publisher", event.target.value)}
                                placeholder="Nhập nhà phát hành..."
                                disabled={loading}
                                className={fieldClassName}
                            />
                        </label>
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <label className="block">
                            <span className={fieldLabelClassName}>Số lượng</span>
                            <input
                                type="number"
                                min={0}
                                value={values.softwareQuantity}
                                onChange={(event) => handleChange("softwareQuantity", event.target.value)}
                                placeholder="Nhập số lượng..."
                                disabled={loading}
                                className={fieldClassName}
                            />
                        </label>

                        <label className="block">
                            <span className={fieldLabelClassName}>Độ ưu tiên</span>
                            <input
                                type="number"
                                min={0}
                                value={values.softwarePriority}
                                onChange={(event) => handleChange("softwarePriority", event.target.value)}
                                placeholder="Nhập độ ưu tiên..."
                                disabled={loading}
                                className={fieldClassName}
                            />
                        </label>
                    </div>

                    <div className="flex justify-end gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={loading}
                            className="cursor-pointer rounded-lg border border-[#e0e3e5] bg-white px-4 py-2 text-sm font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            Huỷ
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="cursor-pointer rounded-lg bg-[#e3000f] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#b40009] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {loading ? "Đang lưu..." : mode === "create" ? "Tạo mới" : "Lưu thay đổi"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
