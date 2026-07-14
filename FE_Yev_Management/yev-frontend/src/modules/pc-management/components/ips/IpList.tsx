"use client";
import { useRef, useState } from "react";

import IpAddressList from "./IpAddressList";
import IpPrefixList from "./IpPrefixList";
import type { ListHandle } from "../list-toolbar";

type IpTab = "addresses" | "prefixes";

const tabs: { key: IpTab; label: string }[] = [
    { key: "addresses", label: "Địa chỉ IP" },
    { key: "prefixes", label: "Dải mạng (Prefix)" },
];

export default function IpList() {
    const [activeTab, setActiveTab] = useState<IpTab>("addresses");
    const [loading, setLoading] = useState(false);

    const addressRef = useRef<ListHandle>(null);
    const prefixRef = useRef<ListHandle>(null);
    const activeRef = activeTab === "addresses" ? addressRef : prefixRef;
    // IpAddress không còn tạo thủ công (docs/asset-api-fe.md §4.2) — chỉ sinh
    // hàng loạt khi tạo dải mạng, nên tab "Địa chỉ IP" không có nút "Thêm".
    const addLabel = activeTab === "prefixes" ? "+ Thêm dải mạng" : null;

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-2xl font-semibold text-[#191c1e]">Quản lý IP</h1>
                    <p className="mt-1 text-[15px] text-[#5e3f3a]">
                        Quản lý địa chỉ IP và các dải mạng (prefix) sử dụng trong hệ thống.
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
                    {addLabel && (
                        <button
                            onClick={() => activeRef.current?.openCreate()}
                            className="cursor-pointer rounded-lg bg-[#e3000f] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#b40009]"
                        >
                            {addLabel}
                        </button>
                    )}
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

            {activeTab === "addresses" ? (
                <IpAddressList ref={addressRef} onLoadingChange={setLoading} />
            ) : (
                <IpPrefixList ref={prefixRef} onLoadingChange={setLoading} />
            )}
        </div>
    );
}
