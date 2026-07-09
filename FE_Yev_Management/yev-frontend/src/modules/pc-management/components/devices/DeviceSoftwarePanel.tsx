"use client";

import { useEffect, useState } from "react";
import { toast } from "react-toastify";

import { DeviceSoftwareApi } from "@/modules/pc-management/api/device-software.api";
import type { DeviceSoftwareDeviceDto } from "@/modules/pc-management/types/device-software.dto";
import { getApiErrorMessage } from "@/lib/apiError";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import DeviceSoftwarePickerDialog from "./DeviceSoftwarePickerDialog";

interface DeviceSoftwarePanelProps {
    deviceId: number;
    softwares: DeviceSoftwareDeviceDto[];
    onChanged: () => void;
}

function formatDate(value: string | null) {
    if (!value) return "-";
    return new Date(value).toLocaleDateString("vi-VN");
}

function toDateInputValue(value: string | null) {
    if (!value) return "";
    return value.slice(0, 10);
}

const fieldLabelClassName = "mb-1.5 block text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]";
const fieldClassName =
    "h-10 w-full rounded-lg border border-[#e0e3e5] bg-white px-3 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3] disabled:cursor-not-allowed disabled:bg-[#f8fafc]";

export default function DeviceSoftwarePanel({ deviceId, softwares, onChanged }: DeviceSoftwarePanelProps) {
    const [pickerOpen, setPickerOpen] = useState(false);

    const [editingItem, setEditingItem] = useState<DeviceSoftwareDeviceDto | null>(null);
    const [editLicenseKey, setEditLicenseKey] = useState("");
    const [editInstallDate, setEditInstallDate] = useState("");
    const [isSavingEdit, setIsSavingEdit] = useState(false);

    const [deletingItem, setDeletingItem] = useState<DeviceSoftwareDeviceDto | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    useEffect(() => {
        if (!editingItem) return;
        setEditLicenseKey(editingItem.licenseKey ?? "");
        setEditInstallDate(toDateInputValue(editingItem.installDate));
    }, [editingItem]);

    const openEdit = (item: DeviceSoftwareDeviceDto) => setEditingItem(item);
    const closeEdit = () => {
        if (isSavingEdit) return;
        setEditingItem(null);
    };

    const handleSaveEdit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!editingItem) return;
        setIsSavingEdit(true);
        try {
            await DeviceSoftwareApi.updateDeviceSoftware({
                deviceId,
                softwareId: editingItem.softwareId,
                licenseKey: editLicenseKey.trim() ? editLicenseKey.trim() : null,
                installDate: editInstallDate || null,
            });
            toast.success("Cập nhật phần mềm thành công");
            setEditingItem(null);
            onChanged();
        } catch (err) {
            toast.error(getApiErrorMessage(err, "Cập nhật phần mềm thất bại"));
        } finally {
            setIsSavingEdit(false);
        }
    };

    const handleDelete = async () => {
        if (!deletingItem) return;
        setIsDeleting(true);
        try {
            await DeviceSoftwareApi.deleteDeviceSoftware(deviceId, deletingItem.softwareId);
            toast.success("Gỡ phần mềm thành công");
            setDeletingItem(null);
            onChanged();
        } catch (err) {
            toast.error(getApiErrorMessage(err, "Gỡ phần mềm thất bại"));
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <div className="space-y-6">
            <section className="overflow-hidden rounded-xl border border-[#e0e3e5] bg-white shadow-sm">
                <div className="flex items-center justify-between border-b border-[#e0e3e5] bg-[#f8fafc] p-4">
                    <div>
                        <h3 className="text-base font-semibold text-[#191c1e]">Phần mềm đã cài</h3>
                        <p className="mt-0.5 text-xs text-[#5e3f3a]">{softwares.length} phần mềm đang cài trên thiết bị.</p>
                    </div>
                    <button
                        onClick={() => setPickerOpen(true)}
                        className="cursor-pointer rounded-lg bg-[#e3000f] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#b40009]"
                    >
                        Cập nhật phần mềm
                    </button>
                </div>

                <div className="overflow-x-auto">
                    <table className="min-w-full border-collapse text-left">
                        <thead>
                            <tr className="border-b border-[#e0e3e5] bg-[#f8fafc] text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">
                                <th className="whitespace-nowrap px-4 py-3">Tên phần mềm</th>
                                <th className="whitespace-nowrap px-4 py-3">Ngày cài</th>
                                <th className="whitespace-nowrap px-4 py-3">License key</th>
                                <th className="whitespace-nowrap px-4 py-3 text-right">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody>
                            {softwares.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="px-4 py-8 text-center text-sm text-[#5e3f3a]">
                                        Chưa cài phần mềm nào.
                                    </td>
                                </tr>
                            )}
                            {softwares.map((item) => (
                                <tr key={item.softwareId} className="border-b border-[#f1f5f9] hover:bg-[#f8fafc]">
                                    <td className="whitespace-nowrap px-4 py-3 text-sm font-semibold text-[#191c1e]">{item.softwareName}</td>
                                    <td className="whitespace-nowrap px-4 py-3 text-sm text-[#5e3f3a]">{formatDate(item.installDate)}</td>
                                    <td className="whitespace-nowrap px-4 py-3 text-sm text-[#5e3f3a]">{item.licenseKey || "-"}</td>
                                    <td className="whitespace-nowrap px-4 py-3 text-right text-sm">
                                        <div className="inline-flex items-center gap-3">
                                            <button
                                                onClick={() => openEdit(item)}
                                                className="cursor-pointer font-semibold text-[#5e3f3a] transition hover:text-[#191c1e]"
                                            >
                                                Sửa
                                            </button>
                                            <button
                                                onClick={() => setDeletingItem(item)}
                                                className="cursor-pointer font-semibold text-[#930006] transition hover:text-[#e3000f]"
                                            >
                                                Gỡ
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>

            {editingItem && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <div className="fixed inset-0 bg-black/40" onClick={closeEdit} />
                    <div
                        role="dialog"
                        aria-modal="true"
                        className="z-60 mx-4 w-full max-w-sm rounded-xl border border-[#e0e3e5] bg-white p-6 shadow-xl"
                    >
                        <h3 className="mb-4 text-lg font-semibold text-[#191c1e]">Sửa: {editingItem.softwareName}</h3>
                        <form onSubmit={handleSaveEdit} className="space-y-4">
                            <label className="block">
                                <span className={fieldLabelClassName}>License key</span>
                                <input
                                    value={editLicenseKey}
                                    onChange={(event) => setEditLicenseKey(event.target.value)}
                                    disabled={isSavingEdit}
                                    className={fieldClassName}
                                />
                            </label>
                            <label className="block">
                                <span className={fieldLabelClassName}>Ngày cài</span>
                                <input
                                    type="date"
                                    value={editInstallDate}
                                    onChange={(event) => setEditInstallDate(event.target.value)}
                                    disabled={isSavingEdit}
                                    className={fieldClassName}
                                />
                            </label>
                            <div className="flex justify-end gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={closeEdit}
                                    disabled={isSavingEdit}
                                    className="cursor-pointer rounded-lg border border-[#e0e3e5] bg-white px-4 py-2 text-sm font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6] disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    Huỷ
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSavingEdit}
                                    className="cursor-pointer rounded-lg bg-[#e3000f] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#b40009] disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {isSavingEdit ? "Đang lưu..." : "Lưu"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <ConfirmDialog
                isOpen={deletingItem !== null}
                title="Gỡ phần mềm"
                message={
                    <>
                        Bạn có chắc muốn gỡ <strong>{deletingItem?.softwareName}</strong> khỏi thiết bị này không?
                    </>
                }
                approveLabel="Gỡ"
                deniedLabel="Huỷ"
                loading={isDeleting}
                onApprove={handleDelete}
                onDenied={() => {
                    if (!isDeleting) setDeletingItem(null);
                }}
            />

            <DeviceSoftwarePickerDialog
                isOpen={pickerOpen}
                deviceId={deviceId}
                onClose={() => setPickerOpen(false)}
                onSynced={() => {
                    setPickerOpen(false);
                    onChanged();
                }}
            />
        </div>
    );
}
