"use client";

import { useState } from "react";
import { Link } from "@/navigation";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { toast } from "react-toastify";

import { DeviceApi } from "@/modules/pc-management/api/device.api";
import type { DeviceDetailDto } from "@/modules/pc-management/types/device.dto";
import DeviceForm, { type DeviceFormValues } from "./DeviceForm";
import DeviceConfigurationPanel from "./DeviceConfigurationPanel";
import DeviceSoftwarePanel from "./DeviceSoftwarePanel";
import DeviceTransferHistoryPanel from "./DeviceTransferHistoryPanel";
import DeviceAuditHistoryPanel from "./DeviceAuditHistoryPanel";
import TransferDeviceDialog from "./TransferDeviceDialog";
import { useAuth } from "@/modules/auth/context/AuthContext";
import { hasPermission } from "@/modules/auth/lib/permissions";
import { getApiErrorMessage } from "@/lib/apiError";
import { useFetchEffect } from "@/modules/common/hooks/useFetchEffect";

interface DeviceDetailProps {
    deviceId: number;
}

type DetailTab = "configuration" | "software" | "transfer-history" | "audit-history";

function formatDate(value: string | null) {
    if (!value) return "-";
    return new Date(value).toLocaleDateString("vi-VN");
}

const infoLabelClassName = "text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]";

export default function DeviceDetail({ deviceId }: DeviceDetailProps) {
    const { user } = useAuth();
    const canViewAuditTrail = hasPermission(user, "Asset.AuditTrail.View");
    const [detail, setDetail] = useState<DeviceDetailDto | null>(null);
    const [activeTab, setActiveTab] = useState<DetailTab>("configuration");

    const [formOpen, setFormOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [transferOpen, setTransferOpen] = useState(false);

    const { isLoading, error, refetch: fetchDetail } = useFetchEffect(
        () => DeviceApi.getDeviceDetailById(deviceId),
        [deviceId],
        (result) => setDetail(result),
        "Không thể tải chi tiết thiết bị."
    );

    const handleSubmitForm = async (values: DeviceFormValues) => {
        if (!detail) return;
        setIsSaving(true);
        try {
            await DeviceApi.updateDevice(detail.device.id, { id: detail.device.id, ...values });
            toast.success("Cập nhật thiết bị thành công");
            setFormOpen(false);
            await fetchDetail();
        } catch (err) {
            toast.error(getApiErrorMessage(err, "Cập nhật thiết bị thất bại"));
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading && !detail) {
        return <div className="p-8 text-center text-sm text-[#5e3f3a]">Đang tải chi tiết thiết bị...</div>;
    }

    if (error && !detail) {
        return (
            <div className="space-y-4">
                <Link href="/pc" prefetch={false} className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#5e3f3a] hover:text-[#191c1e]">
                    <ArrowLeft className="h-4 w-4" /> Quay lại danh sách
</Link>
                <div className="rounded-xl border border-[#e9bcb6] bg-[#fff4f2] px-4 py-3 text-sm text-[#930006]">{error}</div>
            </div>
        );
    }

    if (!detail) return null;

    const { device } = detail;

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                    <Link href="/pc" prefetch={false} className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#5e3f3a] hover:text-[#191c1e]">
                        <ArrowLeft className="h-4 w-4" /> Quay lại danh sách
                    </Link>
                    <h1 className="mt-2 text-2xl font-semibold text-[#191c1e]">{device.deviceCode}</h1>
                    <p className="mt-1 text-[15px] text-[#5e3f3a]">{device.deviceName}</p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <button
                        onClick={() => fetchDetail()}
                        disabled={isLoading}
                        className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#e0e3e5] bg-white px-3 py-1.5 text-xs font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6] disabled:opacity-50"
                    >
                        <RefreshCw className="h-3.5 w-3.5" /> Làm mới
                    </button>
                    <button
                        onClick={() => setTransferOpen(true)}
                        disabled={device.status === 3}
                        className="cursor-pointer rounded-lg border border-[#e0e3e5] bg-white px-3 py-1.5 text-xs font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        Chuyển máy
                    </button>
                    <button
                        onClick={() => setFormOpen(true)}
                        className="cursor-pointer rounded-lg bg-[#e3000f] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#b40009]"
                    >
                        Sửa thiết bị
                    </button>
                </div>
            </div>

            <section className="rounded-xl border border-[#e0e3e5] bg-white p-6 shadow-sm">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <div>
                        <div className={infoLabelClassName}>Loại thiết bị</div>
                        <div className="mt-1 text-sm text-[#191c1e]">{device.deviceTypeName}</div>
                    </div>
                    <div>
                        <div className={infoLabelClassName}>Nhà cung cấp</div>
                        <div className="mt-1 text-sm text-[#191c1e]">{device.supplierName}</div>
                    </div>
                    <div>
                        <div className={infoLabelClassName}>Chi nhánh</div>
                        <div className="mt-1 text-sm text-[#191c1e]">{device.branchName}</div>
                    </div>
                    <div>
                        <div className={infoLabelClassName}>Nhóm</div>
                        <div className="mt-1 text-sm text-[#191c1e]">{device.groupName || "-"}</div>
                    </div>
                    <div>
                        <div className={infoLabelClassName}>Bộ phận</div>
                        <div className="mt-1 text-sm text-[#191c1e]">{device.departmentName || "-"}</div>
                    </div>
                    <div>
                        <div className={infoLabelClassName}>Trạng thái</div>
                        <div className="mt-1 text-sm text-[#191c1e]">{device.statusText}</div>
                    </div>
                    <div>
                        <div className={infoLabelClassName}>Người quản lý</div>
                        <div className="mt-1 text-sm text-[#191c1e]">{device.manager}</div>
                    </div>
                    <div>
                        <div className={infoLabelClassName}>Email</div>
                        <div className="mt-1 space-y-0.5 text-sm text-[#191c1e]">
                            {device.emails.length > 0
                                ? device.emails.map((item) => (
                                      <div key={item.id}>
                                          {item.email}
                                          {item.note && <span className="text-xs text-[#5e3f3a]"> ({item.note})</span>}
                                      </div>
                                  ))
                                : "-"}
                        </div>
                    </div>
                    <div>
                        <div className={infoLabelClassName}>Địa chỉ IP</div>
                        <div className="mt-1 text-sm text-[#191c1e]">
                            {device.ipAddresses.length > 0 ? device.ipAddresses.map((ip) => ip.ipAddress).join(", ") : "-"}
                        </div>
                    </div>
                    <div>
                        <div className={infoLabelClassName}>Thuê ngoài</div>
                        <div className="mt-1 text-sm text-[#191c1e]">{device.isOutsourced ? "Có" : "Không"}</div>
                    </div>
                    <div>
                        <div className={infoLabelClassName}>Số Serial</div>
                        <div className="mt-1 text-sm text-[#191c1e]">{device.serialNumber || "-"}</div>
                    </div>
                    <div>
                        <div className={infoLabelClassName}>Sử dụng USB</div>
                        <div className="mt-1 text-sm text-[#191c1e]">{device.isUseUsb ? "Có" : "Không"}</div>
                    </div>
                    <div>
                        <div className={infoLabelClassName}>Ngày mua</div>
                        <div className="mt-1 text-sm text-[#191c1e]">{formatDate(device.purchaseDate)}</div>
                    </div>
                    <div>
                        <div className={infoLabelClassName}>Khấu hao</div>
                        <div className="mt-1 text-sm text-[#191c1e]">{device.depreciationMonths} tháng</div>
                    </div>
                    <div>
                        <div className={infoLabelClassName}>Hết hạn</div>
                        <div className="mt-1 text-sm text-[#191c1e]">{formatDate(device.expirationDate)}</div>
                    </div>
                    <div>
                        <div className={infoLabelClassName}>Ghi chú</div>
                        <div className="mt-1 text-sm text-[#191c1e]">{device.note || "-"}</div>
                    </div>
                    {device.suggestedNewDeviceCode && (
                        <div>
                            <div className={infoLabelClassName}>Gợi ý máy mới thay thế</div>
                            <div className="mt-1 text-sm text-[#191c1e]">{device.suggestedNewDeviceCode}</div>
                        </div>
                    )}
                </div>
            </section>

            <div className="flex gap-1 border-b border-[#e0e3e5]">
                {[
                    { key: "configuration" as const, label: "Cấu hình phần cứng" },
                    { key: "software" as const, label: "Phần mềm" },
                    { key: "transfer-history" as const, label: "Lịch sử chuyển máy" },
                    ...(canViewAuditTrail ? [{ key: "audit-history" as const, label: "Lịch sử thao tác" }] : []),
                ].map((tab) => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className={`cursor-pointer border-b-2 px-4 py-2.5 text-sm font-semibold transition ${
                            activeTab === tab.key
                                ? "border-[#e3000f] text-[#191c1e]"
                                : "border-transparent text-[#5e3f3a] hover:text-[#191c1e]"
                        }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {activeTab === "configuration" && (
                <DeviceConfigurationPanel
                    deviceId={device.id}
                    deviceCode={device.deviceCode}
                    configuration={detail.configuration}
                    onChanged={fetchDetail}
                />
            )}
            {activeTab === "software" && (
                <DeviceSoftwarePanel deviceId={device.id} softwares={detail.softwares} onChanged={fetchDetail} />
            )}
            {activeTab === "transfer-history" && <DeviceTransferHistoryPanel deviceId={device.id} />}
            {activeTab === "audit-history" && canViewAuditTrail && <DeviceAuditHistoryPanel deviceId={device.id} />}

            <DeviceForm
                isOpen={formOpen}
                mode="edit"
                initial={device}
                loading={isSaving}
                onClose={() => !isSaving && setFormOpen(false)}
                onSubmit={handleSubmitForm}
            />

            <TransferDeviceDialog
                isOpen={transferOpen}
                oldDevice={device}
                onClose={() => setTransferOpen(false)}
                onTransferred={() => {
                    setTransferOpen(false);
                    fetchDetail();
                }}
            />
        </div>
    );
}
