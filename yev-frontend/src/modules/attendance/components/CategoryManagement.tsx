"use client";
import { useCallback, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";

import DepartmentList from "./departments/DepartmentList";
import GroupList from "./groups/GroupList";
import ReasonList from "./reasons/ReasonList";
import OtCaseList from "./ot-cases/OtCaseList";
import EmployeeList from "./employees/EmployeeList";
import type { ListHandle } from "./list-toolbar";

type CategoryTab = "departments" | "groups" | "reasons" | "ot-cases" | "employees";

const tabs: { key: CategoryTab; label: string; addLabel: string }[] = [
    { key: "departments", label: "Phòng ban", addLabel: "+ Thêm phòng ban" },
    { key: "groups", label: "Bộ phận", addLabel: "+ Thêm bộ phận" },
    { key: "reasons", label: "Lý do", addLabel: "+ Thêm lý do" },
    { key: "ot-cases", label: "Trường hợp OT", addLabel: "+ Thêm trường hợp OT" },
    { key: "employees", label: "Nhân viên", addLabel: "+ Thêm nhân viên" },
];

export default function CategoryManagement() {
    const [activeTab, setActiveTab] = useState<CategoryTab>("departments");
    // Tab nào đã từng được xem thì mới mount (và giữ mounted luôn sau đó) — chỉ tab "departments"
    // (mặc định) mount ngay từ đầu. Tránh gọi song song cả 5 API mỗi lần vào màn "Danh mục" trong khi
    // đa số user chỉ xem 1-2 tab/lượt, nhưng vẫn giữ được lợi ích "chuyển tab tức thì, không tải lại"
    // cho những tab đã ghé qua trong phiên này.
    const [visitedTabs, setVisitedTabs] = useState<Set<CategoryTab>>(() => new Set(["departments"]));
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

    // onLoadingChange phải giữ nguyên identity qua các lần render — nếu truyền inline
    // arrow function, effect trong mỗi List (dep [isLoading, onLoadingChange]) sẽ nghĩ prop
    // đổi mỗi lần CategoryManagement render lại, chạy lại effect, gọi setLoadingByTab, khiến
    // CategoryManagement render lại... lặp vô hạn ("Maximum update depth exceeded").
    const handleDepartmentLoadingChange = useCallback(
        (value: boolean) => setLoadingByTab((current) => ({ ...current, departments: value })),
        []
    );
    const handleGroupLoadingChange = useCallback(
        (value: boolean) => setLoadingByTab((current) => ({ ...current, groups: value })),
        []
    );
    const handleReasonLoadingChange = useCallback(
        (value: boolean) => setLoadingByTab((current) => ({ ...current, reasons: value })),
        []
    );
    const handleOtCaseLoadingChange = useCallback(
        (value: boolean) => setLoadingByTab((current) => ({ ...current, "ot-cases": value })),
        []
    );
    const handleEmployeeLoadingChange = useCallback(
        (value: boolean) => setLoadingByTab((current) => ({ ...current, employees: value })),
        []
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-2xl font-semibold text-[#191c1e]">Danh mục tăng ca</h1>
                    <p className="mt-1 text-[15px] text-[#5e3f3a]">
                        Quản lý Phòng ban, Bộ phận, Lý do, Trường hợp OT và Nhân viên dùng khi lập đơn tăng ca.
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <button
                        onClick={() => activeRef.current?.refresh()}
                        disabled={loading}
                        className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#e0e3e5] bg-white px-3 py-1.5 text-xs font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6] disabled:opacity-50"
                    >
                        <RefreshCw className="h-3.5 w-3.5" /> Làm mới
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
                            onClick={() => {
                                setActiveTab(tab.key);
                                setVisitedTabs((current) => (current.has(tab.key) ? current : new Set(current).add(tab.key)));
                            }}
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
                Mount theo kiểu "lazy, rồi giữ luôn" — tab nào chưa từng bấm vào thì chưa mount (chưa gọi
                API), tab nào đã ghé qua thì giữ mounted (ẩn bằng "hidden", không unmount) để chuyển qua
                lại tức thì, không tải lại. Khác với mount cả 5 song song ngay từ đầu (bản cũ): tránh gọi
                5 API cùng lúc khi phần lớn lượt vào màn "Danh mục" chỉ cần xem 1-2 tab.
            */}
            {visitedTabs.has("departments") && (
                <div className={activeTab === "departments" ? "" : "hidden"}>
                    <DepartmentList ref={departmentRef} onLoadingChange={handleDepartmentLoadingChange} />
                </div>
            )}
            {visitedTabs.has("groups") && (
                <div className={activeTab === "groups" ? "" : "hidden"}>
                    <GroupList ref={groupRef} onLoadingChange={handleGroupLoadingChange} />
                </div>
            )}
            {visitedTabs.has("reasons") && (
                <div className={activeTab === "reasons" ? "" : "hidden"}>
                    <ReasonList ref={reasonRef} onLoadingChange={handleReasonLoadingChange} />
                </div>
            )}
            {visitedTabs.has("ot-cases") && (
                <div className={activeTab === "ot-cases" ? "" : "hidden"}>
                    <OtCaseList ref={otCaseRef} onLoadingChange={handleOtCaseLoadingChange} />
                </div>
            )}
            {visitedTabs.has("employees") && (
                <div className={activeTab === "employees" ? "" : "hidden"}>
                    <EmployeeList ref={employeeRef} onLoadingChange={handleEmployeeLoadingChange} />
                </div>
            )}
        </div>
    );
}
