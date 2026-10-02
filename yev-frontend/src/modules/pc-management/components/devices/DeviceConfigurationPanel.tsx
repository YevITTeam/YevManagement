"use client";

import { useState } from "react";
import { toast } from "react-toastify";

import { DeviceConfigurationApi } from "@/modules/pc-management/api/device-configuration.api";
import type {
    DeviceComponentFields,
    DeviceConfigurationDto,
    DeviceConfigurationHistoryDto,
    DeviceConfigurationInitialDto,
} from "@/modules/pc-management/types/device-configuration.dto";
import { getApiErrorMessage } from "@/lib/apiError";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import { useFetchEffect } from "@/modules/common/hooks/useFetchEffect";
import { Trash2 } from "lucide-react";

interface DeviceConfigurationPanelProps {
    deviceId: number;
    deviceCode: string;
    configuration: DeviceConfigurationDto | null;
    onChanged: () => void;
}

type ComponentFormValues = Record<keyof DeviceComponentFields, string>;

// Fields shown in the UI. Hidden columns (see hiddenFieldKeys) stay in the API payload so stored values are never wiped.
const componentFieldDefs: { key: keyof DeviceComponentFields; label: string }[] = [
    { key: "maker", label: "Hãng sản xuất" },
    { key: "model", label: "Model" },
    { key: "cpu", label: "CPU" },
    { key: "ram", label: "RAM" },
    { key: "hardDrive", label: "Ổ cứng" },
    { key: "monitor", label: "Màn hình" },
    { key: "os", label: "Hệ điều hành" },
    { key: "headphone", label: "Tai nghe" },
    { key: "ups", label: "UPS" },
    { key: "nic", label: "MAC address LAN" },
];

const hiddenFieldKeys: (keyof DeviceComponentFields)[] = [
    "mainboard",
    "vga",
    "mouse",
    "keyboard",
    "speaker",
    "psu",
    "powerAdapter",
    "wirelessCard",
];

const emptyComponentValues: ComponentFormValues = componentFieldDefs.reduce((acc, field) => {
    acc[field.key] = "";
    return acc;
}, {} as ComponentFormValues);

const fieldLabelClassName = "mb-1.5 block text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]";
const fieldClassName =
    "h-10 w-full rounded-lg border border-[#e0e3e5] bg-white px-3 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3] disabled:cursor-not-allowed disabled:bg-[#f8fafc]";

function toFormValues(source: DeviceComponentFields | null): ComponentFormValues {
    if (!source) return emptyComponentValues;
    return componentFieldDefs.reduce((acc, field) => {
        acc[field.key] = source[field.key] ?? "";
        return acc;
    }, {} as ComponentFormValues);
}

function ReadOnlyComponentGrid({ source }: { source: DeviceComponentFields & { other: string | null; note: string | null } }) {
    const filled = componentFieldDefs.filter((field) => source[field.key]);
    if (filled.length === 0 && !source.other && !source.note) {
        return <p className="py-4 text-center text-sm text-[#5e3f3a]">Không có dữ liệu.</p>;
    }
    return (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filled.map((field) => (
                <div key={field.key}>
                    <div className="text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">{field.label}</div>
                    <div className="mt-1 text-sm text-[#191c1e]">{source[field.key]}</div>
                </div>
            ))}
            {source.other && (
                <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">Khác</div>
                    <div className="mt-1 text-sm text-[#191c1e]">{source.other}</div>
                </div>
            )}
            {source.note && (
                <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">Ghi chú</div>
                    <div className="mt-1 text-sm text-[#191c1e]">{source.note}</div>
                </div>
            )}
        </div>
    );
}

export default function DeviceConfigurationPanel({ deviceId, deviceCode, configuration, onChanged }: DeviceConfigurationPanelProps) {
    const [values, setValues] = useState<ComponentFormValues>(() => toFormValues(configuration));
    const [other, setOther] = useState(() => configuration?.other ?? "");
    const [note, setNote] = useState(() => configuration?.note ?? "");
    const [isSaving, setIsSaving] = useState(false);
    const [deletingConfig, setDeletingConfig] = useState(false);
    const [isDeletingConfig, setIsDeletingConfig] = useState(false);

    const [deletingInitial, setDeletingInitial] = useState(false);
    const [isDeletingInitial, setIsDeletingInitial] = useState(false);

    const [initialSnapshot, setInitialSnapshot] = useState<DeviceConfigurationInitialDto | null>(null);
    const [history, setHistory] = useState<DeviceConfigurationHistoryDto[]>([]);

    // Đổ lại field khi `configuration` (prop) đổi — so sánh snapshot ngay trong render thay effect
    // (xem AGENTS.md "Pattern reset Form dialog"), vì đây là "adjust state when a prop changes".
    const [prevConfiguration, setPrevConfiguration] = useState(configuration);
    if (prevConfiguration !== configuration) {
        setPrevConfiguration(configuration);
        setValues(toFormValues(configuration));
        setOther(configuration?.other ?? "");
        setNote(configuration?.note ?? "");
    }

    const { isLoading: isLoadingInitial } = useFetchEffect(
        () => (configuration ? DeviceConfigurationApi.getInitialConfiguration(configuration.id) : Promise.resolve(null)),
        [configuration?.id],
        (data) => setInitialSnapshot(data),
        "Không thể tải cấu hình ban đầu.",
        undefined,
        "device-config-initial"
    );

    const { isLoading: isLoadingHistory } = useFetchEffect(
        () => (configuration ? DeviceConfigurationApi.getConfigurationHistory(configuration.id) : Promise.resolve([])),
        [configuration?.id],
        (data) => setHistory(data),
        "Không thể tải lịch sử sửa chữa.",
        undefined,
        "device-config-history"
    );

    const handleChange = (field: keyof DeviceComponentFields, value: string) => {
        setValues((current) => ({ ...current, [field]: value }));
    };

    const buildPayload = () => {
        const payload: Partial<DeviceComponentFields> & { other: string | null; note: string | null } = {
            other: other.trim() ? other.trim() : null,
            note: note.trim() ? note.trim() : null,
        };
        componentFieldDefs.forEach((field) => {
            payload[field.key] = values[field.key].trim() ? values[field.key].trim() : null;
        });
        hiddenFieldKeys.forEach((key) => {
            payload[key] = configuration?.[key] ?? null;
        });
        return payload;
    };

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        setIsSaving(true);
        try {
            if (!configuration) {
                await DeviceConfigurationApi.createConfiguration({ deviceId, ...buildPayload() });
                toast.success("Tạo cấu hình phần cứng thành công");
            } else {
                await DeviceConfigurationApi.updateConfiguration(configuration.id, buildPayload());
                toast.success("Cập nhật cấu hình phần cứng thành công");
            }
            onChanged();
        } catch (err) {
            toast.error(getApiErrorMessage(err, "Lưu cấu hình phần cứng thất bại"));
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteConfig = async () => {
        if (!configuration) return;
        setIsDeletingConfig(true);
        try {
            await DeviceConfigurationApi.deleteConfiguration(configuration.id);
            toast.success("Xoá cấu hình phần cứng thành công");
            setDeletingConfig(false);
            onChanged();
        } catch (err) {
            toast.error(getApiErrorMessage(err, "Xoá cấu hình phần cứng thất bại"));
        } finally {
            setIsDeletingConfig(false);
        }
    };

    const handleDeleteInitial = async () => {
        if (!initialSnapshot) return;
        setIsDeletingInitial(true);
        try {
            await DeviceConfigurationApi.deleteInitialConfiguration(initialSnapshot.id);
            toast.success("Xoá cấu hình ban đầu thành công");
            setDeletingInitial(false);
            setInitialSnapshot(null);
        } catch (err) {
            toast.error(getApiErrorMessage(err, "Xoá cấu hình ban đầu thất bại"));
        } finally {
            setIsDeletingInitial(false);
        }
    };

    return (
        <div className="space-y-6">
            <section className="rounded-xl border border-[#e0e3e5] bg-white p-6 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                    <div>
                        <h3 className="text-base font-semibold text-[#191c1e]">
                            {configuration ? "Cấu hình phần cứng" : "Chưa có cấu hình phần cứng"}
                        </h3>
                        <p className="mt-1 text-xs text-[#5e3f3a]">
                            {configuration
                                ? `Cấu hình hiện tại của thiết bị ${deviceCode}.`
                                : "Nhập cấu hình phần cứng lần đầu cho thiết bị này."}
                        </p>
                    </div>
                    {configuration && (
                        <button
                            type="button"
                            onClick={() => setDeletingConfig(true)}
                            className="cursor-pointer text-sm font-semibold text-[#930006] transition hover:text-[#e3000f]"
                        >
                            Xoá cấu hình
                        </button>
                    )}
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
                        {componentFieldDefs.map((field) => (
                            <label key={field.key} className="block">
                                <span className={fieldLabelClassName}>{field.label}</span>
                                <input
                                    value={values[field.key]}
                                    onChange={(event) => handleChange(field.key, event.target.value)}
                                    disabled={isSaving}
                                    className={fieldClassName}
                                />
                            </label>
                        ))}
                    </div>

                    <label className="block">
                        <span className={fieldLabelClassName}>Khác</span>
                        <input value={other} onChange={(event) => setOther(event.target.value)} disabled={isSaving} className={fieldClassName} />
                    </label>

                    <label className="block">
                        <span className={fieldLabelClassName}>Ghi chú</span>
                        <textarea
                            value={note}
                            onChange={(event) => setNote(event.target.value)}
                            disabled={isSaving}
                            rows={2}
                            className="w-full rounded-lg border border-[#e0e3e5] bg-white px-3 py-2 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3] disabled:cursor-not-allowed disabled:bg-[#f8fafc]"
                        />
                    </label>

                    <div className="flex justify-end">
                        <button
                            type="submit"
                            disabled={isSaving}
                            className="cursor-pointer rounded-lg bg-[#e3000f] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#b40009] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {isSaving ? "Đang lưu..." : configuration ? "Lưu thay đổi" : "Tạo cấu hình"}
                        </button>
                    </div>
                </form>
            </section>

            {configuration && (
                <>
                    <section className="rounded-xl border border-[#e0e3e5] bg-white p-6 shadow-sm">
                        <div className="mb-4 flex items-center justify-between">
                            <h3 className="text-base font-semibold text-[#191c1e]">Cấu hình ban đầu</h3>
                            {initialSnapshot && (
                                <button
                                    type="button"
                                    onClick={() => setDeletingInitial(true)}
                                    className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border transition disabled:cursor-not-allowed disabled:opacity-40 border-[#e9bcb6] text-[#930006] hover:bg-[#fff4f2]"
                                    title="Xoá"
                                    aria-label="Xoá"
                                >
                                    <Trash2 className="h-3.5 w-3.5" />
                                </button>
                            )}
                        </div>
                        {isLoadingInitial ? (
                            <p className="py-4 text-center text-sm text-[#5e3f3a]">Đang tải...</p>
                        ) : initialSnapshot ? (
                            <ReadOnlyComponentGrid source={initialSnapshot} />
                        ) : (
                            <p className="py-4 text-center text-sm text-[#5e3f3a]">Chưa có snapshot cấu hình ban đầu.</p>
                        )}
                    </section>

                    <section className="overflow-hidden rounded-xl border border-[#e0e3e5] bg-white shadow-sm">
                        <div className="border-b border-[#e0e3e5] bg-[#f8fafc] p-4">
                            <h3 className="text-base font-semibold text-[#191c1e]">Lịch sử sửa chữa / thay thế</h3>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="min-w-full border-collapse text-left">
                                <thead>
                                    <tr className="border-b border-[#e0e3e5] bg-[#f8fafc] text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">
                                        <th className="whitespace-nowrap px-4 py-3">Thời gian</th>
                                        <th className="whitespace-nowrap px-4 py-3">Người sửa</th>
                                        <th className="px-4 py-3">Chi tiết thay đổi</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {isLoadingHistory && (
                                        <tr>
                                            <td colSpan={3} className="px-4 py-8 text-center text-sm text-[#5e3f3a]">
                                                Đang tải...
                                            </td>
                                        </tr>
                                    )}
                                    {!isLoadingHistory && history.length === 0 && (
                                        <tr>
                                            <td colSpan={3} className="px-4 py-8 text-center text-sm text-[#5e3f3a]">
                                                Chưa có lịch sử sửa chữa.
                                            </td>
                                        </tr>
                                    )}
                                    {history.map((entry) => (
                                        <tr key={entry.id} className="border-b border-[#f1f5f9] align-top">
                                            <td className="whitespace-nowrap px-4 py-3 text-sm text-[#191c1e]">
                                                {new Date(entry.editedAt).toLocaleString("vi-VN")}
                                            </td>
                                            <td className="whitespace-nowrap px-4 py-3 text-sm text-[#5e3f3a]">{entry.editedBy || "-"}</td>
                                            <td className="px-4 py-3">
                                                <ReadOnlyComponentGrid source={entry} />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </section>
                </>
            )}

            <ConfirmDialog
                isOpen={deletingConfig}
                title="Xoá cấu hình phần cứng"
                message="Hành động này sẽ xoá cứng cấu hình hiện tại, kèm theo cấu hình ban đầu và toàn bộ lịch sử sửa chữa. Không thể hoàn tác."
                approveLabel="Xoá"
                deniedLabel="Huỷ"
                loading={isDeletingConfig}
                onApprove={handleDeleteConfig}
                onDenied={() => {
                    if (!isDeletingConfig) setDeletingConfig(false);
                }}
            />

            <ConfirmDialog
                isOpen={deletingInitial}
                title="Xoá cấu hình ban đầu"
                message="Bạn có chắc muốn xoá riêng snapshot cấu hình ban đầu này không?"
                approveLabel="Xoá"
                deniedLabel="Huỷ"
                loading={isDeletingInitial}
                onApprove={handleDeleteInitial}
                onDenied={() => {
                    if (!isDeletingInitial) setDeletingInitial(false);
                }}
            />
        </div>
    );
}
