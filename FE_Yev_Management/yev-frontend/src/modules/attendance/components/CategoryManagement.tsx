"use client";
import { useRef, useState } from "react";

import DepartmentList from "./departments/DepartmentList";
import GroupList from "./groups/GroupList";
import ReasonList from "./reasons/ReasonList";
import OtCaseList from "./ot-cases/OtCaseList";
import EmployeeList from "./employees/EmployeeList";
import type { ListHandle } from "./list-toolbar";

type CategoryTab = "departments" | "groups" | "reasons" | "ot-cases" | "employees";

const tabs: { key: CategoryTab; label: string; addLabel: string }[] = [
    { key: "departments", label: "Bộ phận", addLabel: "+ Thêm bộ phận" },
    { key: "groups", label: "Nhóm", addLabel: "+ Thêm nhóm" },
    { key: "reasons", label: "Lý do", addLabel: "+ Thêm lý do" },
    { key: "ot-cases", label: "Trường hợp OT", addLabel: "+ Thêm trường hợp OT" },
    { key: "employees", label: "Nhân viên", addLabel: "+ Thêm nhân viên" },
];

export default function CategoryManagement() {
    const [activeTab, setActiveTab] = useState<CategoryTab>("departments");
    // Cả 5 list giờ mounted song song (xem ghi chú bên dưới) nên mỗi list phải báo loading vào
    // đúng slot riêng của nó — nếu dùng chung 1 state boolean, list nào báo xong (setLoading(false))
    // sau cùng sẽ đè mất trạng thái loading thật của tab đang xem.
    const [loadingByTab, setLoadingByTab] = useState<Record<CategoryTab, boolean>>({
        departments: false,
        groups: false,
        reasons: false,
        "ot-cases": false,
        employees: false,
    });
    const loading = loadingByTab[activeTab];

    const departmentRef = useRef<ListHandle>(null);
    const groupRef = useRef<ListHandle>(null);
    const reasonRef = useRef<ListHandle>(null);
    const otCaseRef = useRef<ListHandle>(null);
    const employeeRef = useRef<ListHandle>(null);

    const refByTab: Record<CategoryTab, React.RefObject<ListHandle | null>> = {
        departments: departmentRef,
        groups: groupRef,
        reasons: reasonRef,
        "ot-cases": otCaseRef,
        employees: employeeRef,
    };

    const activeRef = refByTab[activeTab];
    const activeTabMeta = tabs.find((tab) => tab.key === activeTab)!;

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-2xl font-semibold text-[#191c1e]">Danh mục tăng ca</h1>
                    <p className="mt-1 text-[15px] text-[#5e3f3a]">
                        Quản lý Bộ phận, Nhóm, Lý do, Trường hợp OT và Nhân viên dùng khi lập đơn tăng ca.
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <button
                        onClick={() => activeRef.current?.refresh()}
                        disabled={loading}
                        className="cursor-pointer rounded-lg border border-[#e0e3e5] bg-white px-3 py-1.5 text-xs font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6] disabled:opacity-50"
                    >
                        ↻ Làm mới
                    </button>
                    <button
                        onClick={() => activeRef.current?.openCreate()}
                        className="cursor-pointer rounded-lg bg-[#e3000f] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#b40009]"
                    >
                        {activeTabMeta.addLabel}
                    </button>
                </div>
            </div>

            <div className="flex flex-wrap gap-1 border-b border-[#e0e3e5]">
                {tabs.map((tab) => {
                    const isActive = activeTab === tab.key;
                    return (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className={`cursor-pointer border-b-2 px-4 py-2.5 text-sm font-semibold transition ${
                                isActive
                                    ? "border-[#e3000f] text-[#191c1e]"
                                    : "border-transparent text-[#5e3f3a] hover:text-[#191c1e]"
                            }`}
                        >
                            {tab.label}
                        </button>
                    );
                })}
            </div>

            {/*
                Cố ý giữ cả 5 list luôn mounted (ẩn/hiện bằng "hidden", không unmount) thay vì
                `{activeTab === "x" && <XList/>}` như trước — conditional mount khiến mỗi lần đổi tab
                list cũ bị huỷ và list mới phải gọi lại API + chờ load lại từ đầu, nên bấm qua đủ 5 tab
                là 5 lần chờ tuần tự. Giữ mounted giúp cả 5 API gọi song song ngay khi vào "Danh mục"
                (chỉ phải chờ 1 lần, tốc độ = list chậm nhất chứ không phải tổng cả 5) và tab đã xem rồi
                thì chuyển qua lại tức thì, không phải tải lại.
            */}
            <div className={activeTab === "departments" ? "" : "hidden"}>
                <DepartmentList ref={departmentRef} onLoadingChange={(value) => setLoadingByTab((current) => ({ ...current, departments: value }))} />
            </div>
            <div className={activeTab === "groups" ? "" : "hidden"}>
                <GroupList ref={groupRef} onLoadingChange={(value) => setLoadingByTab((current) => ({ ...current, groups: value }))} />
            </div>
            <div className={activeTab === "reasons" ? "" : "hidden"}>
                <ReasonList ref={reasonRef} onLoadingChange={(value) => setLoadingByTab((current) => ({ ...current, reasons: value }))} />
            </div>
            <div className={activeTab === "ot-cases" ? "" : "hidden"}>
                <OtCaseList ref={otCaseRef} onLoadingChange={(value) => setLoadingByTab((current) => ({ ...current, "ot-cases": value }))} />
            </div>
            <div className={activeTab === "employees" ? "" : "hidden"}>
                <EmployeeList ref={employeeRef} onLoadingChange={(value) => setLoadingByTab((current) => ({ ...current, employees: value }))} />
            </div>
        </div>
    );
}
