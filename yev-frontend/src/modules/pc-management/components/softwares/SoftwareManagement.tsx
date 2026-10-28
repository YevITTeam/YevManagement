"use client";
import { useRef, useState } from "react";
import { RefreshCw } from "lucide-react";

import SoftwareList from "./SoftwareList";
import SoftwareGroupList from "../software-groups/SoftwareGroupList";
import type { ListHandle } from "../list-toolbar";

import { usePersistedTab } from "@/modules/common/hooks/usePersistedTab";

type SoftwareTab = "softwares" | "groups";

const tabs: { key: SoftwareTab; label: string }[] = [
    { key: "softwares", label: "Phần mềm" },
    { key: "groups", label: "Nhóm phần mềm" },
];

export default function SoftwareManagement() {
    const [activeTab, setActiveTab] = usePersistedTab<SoftwareTab>("pc-software-tab", ["softwares", "groups"], "softwares");
    const [loading, setLoading] = useState(false);

    const softwareRef = useRef<ListHandle>(null);
    const groupRef = useRef<ListHandle>(null);
    const activeRef = activeTab === "softwares" ? softwareRef : groupRef;
    const addLabel = activeTab === "softwares" ? "+ Thêm phần mềm" : "+ Thêm nhóm phần mềm";

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-lg font-semibold text-[#191c1e]">Quản lý phần mềm</h1>
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
                        {addLabel}
                    </button>
                </div>
            </div>

            <div className="flex gap-1 border-b border-[#e0e3e5]">
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

            {activeTab === "softwares" ? (
                <SoftwareList ref={softwareRef} onLoadingChange={setLoading} />
            ) : (
                <SoftwareGroupList ref={groupRef} onLoadingChange={setLoading} />
            )}
        </div>
    );
}
