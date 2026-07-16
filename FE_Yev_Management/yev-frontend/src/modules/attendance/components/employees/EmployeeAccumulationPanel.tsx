"use client";

import { useEffect, useState } from "react";
import { toast } from "react-toastify";

import { EmployeeApi } from "@/modules/attendance/api/employee.api";
import type { EmployeeDto } from "@/modules/attendance/types/employee.dto";
import { getApiErrorMessage } from "@/lib/apiError";

const fieldLabelClassName = "mb-1.5 block text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]";
const fieldClassName =
    "h-10 w-full rounded-lg border border-[#e0e3e5] bg-white px-3 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3] disabled:cursor-not-allowed disabled:bg-[#f8fafc]";

// docs/attendance-api-fe.md §3.6 — mọi user đăng nhập (kể cả không có Role nghiệp vụ) đều gọi được,
// chỉ hoạt động nếu Admin đã gán Employee.userName = username AD của họ.
export default function EmployeeAccumulationPanel() {
    const [employee, setEmployee] = useState<EmployeeDto | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [notLinked, setNotLinked] = useState(false);

    const [monthToDate, setMonthToDate] = useState(0);
    const [yearToDate, setYearToDate] = useState(0);
    const [isSaving, setIsSaving] = useState(false);

    const fetchMe = async () => {
        setIsLoading(true);
        setNotLinked(false);
        try {
            const data = await EmployeeApi.getMe();
            setEmployee(data);
            setMonthToDate(data.monthToDate);
            setYearToDate(data.yearToDate);
        } catch (err) {
            console.error(err);
            setNotLinked(true);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchMe();
    }, []);

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!employee) return;
        if (monthToDate < 0 || yearToDate < 0) {
            toast.error("Lũy kế không được âm.");
            return;
        }
        setIsSaving(true);
        try {
            await EmployeeApi.adjustAccumulation(employee.id, { monthToDate, yearToDate });
            toast.success("Cập nhật lũy kế thành công");
            await fetchMe();
        } catch (err) {
            console.error(err);
            toast.error(getApiErrorMessage(err, "Cập nhật lũy kế thất bại"));
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return <div className="py-16 text-center text-sm text-[#5e3f3a]">Đang tải dữ liệu...</div>;
    }

    if (notLinked || !employee) {
        return (
            <div className="rounded-lg border border-[#e9bcb6] bg-[#fff4f2] px-4 py-3 text-sm text-[#930006]">
                Tài khoản chưa được gán nhân viên tương ứng, liên hệ Admin.
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-semibold text-[#191c1e]">Lũy kế của tôi</h1>
                <p className="mt-1 text-[15px] text-[#5e3f3a]">
                    {employee.code} — {employee.lastName} {employee.firstName} ({employee.groupNameVn})
                </p>
            </div>

            <section className="max-w-xl space-y-4 rounded-xl border border-[#e0e3e5] bg-white p-6 shadow-sm">
                <p className="text-xs text-[#5e3f3a]">
                    Lũy kế đang phản ánh tháng {employee.accumulationMonth}/{employee.accumulationYear}. Chỉnh trực tiếp
                    nếu giờ OT thực tế khác với đơn đã đăng ký — không cần đợi có đơn OT mới.
                </p>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <label className="block">
                            <span className={fieldLabelClassName}>Lũy kế tháng (giờ)</span>
                            <input
                                type="number"
                                step="0.5"
                                min={0}
                                value={monthToDate}
                                onChange={(event) => setMonthToDate(Number(event.target.value))}
                                disabled={isSaving}
                                className={fieldClassName}
                            />
                        </label>
                        <label className="block">
                            <span className={fieldLabelClassName}>Lũy kế năm (giờ)</span>
                            <input
                                type="number"
                                step="0.5"
                                min={0}
                                value={yearToDate}
                                onChange={(event) => setYearToDate(Number(event.target.value))}
                                disabled={isSaving}
                                className={fieldClassName}
                            />
                        </label>
                    </div>

                    <div className="flex justify-end">
                        <button
                            type="submit"
                            disabled={isSaving}
                            className="cursor-pointer rounded-lg bg-[#e3000f] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#b40009] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {isSaving ? "Đang lưu..." : "Lưu lũy kế"}
                        </button>
                    </div>
                </form>
            </section>
        </div>
    );
}
