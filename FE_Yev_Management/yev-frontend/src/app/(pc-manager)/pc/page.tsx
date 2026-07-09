"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import DeviceFilterBar, { type DeviceFilters } from "../../../modules/pc-management/components/DeviceFilterBar";
import PrintDeviceCodeDialog from "../../../modules/pc-management/components/PrintDeviceCodeDialog";
import DeviceForm, { type DeviceFormValues } from "../../../modules/pc-management/components/devices/DeviceForm";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import { DeviceApi } from "../../../modules/pc-management/api/device.api";
import type { DeviceDto, DeviceGetDto } from "../../../modules/pc-management/types/device.dto";
import { getApiErrorMessage } from "@/lib/apiError";
import { useRouter } from 'next/navigation';
const statusLabels: Record<number, string> = {
  0: "Chưa sử dụng",
  1: "Đang sử dụng",
  2: "Chờ thanh lý",
  3: "Đã thanh lý",
  4: "Thuê ngoài",
};

const statusClasses: Record<number, string> = {
  0: "border border-[#e0e3e5] bg-[#f8fafc] text-[#5e3f3a]",
  1: "border border-[#e9bcb6] bg-[#fff4f2] text-[#930006]",
  2: "border border-[#d8e2ff] bg-[#f4f5ff] text-[#004494]",
  3: "border border-[#ffdad6] bg-[#fff8f7] text-[#93000a]",
  4: "border border-[#dae2fd] bg-[#f5f7ff] text-[#5c647a]",
};

const defaultFilters: DeviceFilters = {
  deviceCode: "",
  manager: "",
  ipAddress: "",
  supplierName: "",
  purchaseDate: "",
  branch: "",
  deviceType: "",
  status: "",
  expiryDate: "",
};

function formatDate(value: string | null) {
  if (!value) {
    return "-";
  }
  return new Date(value).toLocaleDateString("vi-VN");
}

export default function PcDashboardPage() {
  const [filters, setFilters] = useState<DeviceFilters>(defaultFilters);
  const [devices, setDevices] = useState<DeviceDto[]>([]);
  const [pageIndex, setPageIndex] = useState(1);
  const [pageSize] = useState(50);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [hasPreviousPage, setHasPreviousPage] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPrintOpen, setIsPrintOpen] = useState(false);
  const router = useRouter();

  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [editingDevice, setEditingDevice] = useState<DeviceGetDto | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingEditTarget, setIsLoadingEditTarget] = useState(false);

  const [deletingDevice, setDeletingDevice] = useState<DeviceDto | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Reset back to page 1 whenever a server-backed filter changes, so pagination reflects the new result set.
  useEffect(() => {
    setPageIndex(1);
  }, [filters.deviceCode, filters.manager, filters.ipAddress, filters.supplierName, filters.purchaseDate]);

  useEffect(() => {
    let isCancelled = false;

    const fetchDevices = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const result = await DeviceApi.getDevicePageNation({
          pageIndex,
          pageSize,
          deviceCode: filters.deviceCode || undefined,
          manager: filters.manager || undefined,
          ipAddress: filters.ipAddress || undefined,
          supplierName: filters.supplierName || undefined,
          purchaseDate: filters.purchaseDate || undefined,
        });
        if (isCancelled) return;

        setDevices(result.data);
        setTotalCount(result.totalCount);
        setTotalPages(result.totalPages);
        setHasNextPage(result.hasNextPage);
        setHasPreviousPage(result.hasPreviousPage);
      } catch (err) {
        if (!isCancelled) {
          setError(getApiErrorMessage(err, "Không thể tải danh sách thiết bị."));
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    };

    fetchDevices();

    return () => {
      isCancelled = true;
    };
  }, [pageIndex, pageSize, filters.deviceCode, filters.manager, filters.ipAddress, filters.supplierName, filters.purchaseDate]);

  const refetchDevices = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await DeviceApi.getDevicePageNation({
        pageIndex,
        pageSize,
        deviceCode: filters.deviceCode || undefined,
        manager: filters.manager || undefined,
        ipAddress: filters.ipAddress || undefined,
        supplierName: filters.supplierName || undefined,
        purchaseDate: filters.purchaseDate || undefined,
      });
      setDevices(result.data);
      setTotalCount(result.totalCount);
      setTotalPages(result.totalPages);
      setHasNextPage(result.hasNextPage);
      setHasPreviousPage(result.hasPreviousPage);
    } catch (err) {
      setError(getApiErrorMessage(err, "Không thể tải danh sách thiết bị."));
    } finally {
      setIsLoading(false);
    }
  };

  const openCreateForm = () => {
    setFormMode("create");
    setEditingDevice(null);
    setFormOpen(true);
  };

  const openEditForm = async (device: DeviceDto) => {
    setIsLoadingEditTarget(true);
    try {
      const detail = await DeviceApi.getDeviceById(device.id);
      setFormMode("edit");
      setEditingDevice(detail);
      setFormOpen(true);
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Không thể tải thông tin thiết bị."));
    } finally {
      setIsLoadingEditTarget(false);
    }
  };

  const closeForm = () => {
    if (isSaving) return;
    setFormOpen(false);
    setEditingDevice(null);
  };

  const handleSubmitForm = async (values: DeviceFormValues) => {
    setIsSaving(true);
    try {
      if (formMode === "create") {
        await DeviceApi.createDevice({ id: 0, ...values });
        toast.success("Tạo thiết bị thành công");
      } else if (editingDevice) {
        await DeviceApi.updateDevice(editingDevice.id, { id: editingDevice.id, ...values });
        toast.success("Cập nhật thiết bị thành công");
      }
      setFormOpen(false);
      setEditingDevice(null);
      await refetchDevices();
    } catch (err) {
      toast.error(getApiErrorMessage(err, formMode === "create" ? "Tạo thiết bị thất bại" : "Cập nhật thiết bị thất bại"));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingDevice) return;
    setIsDeleting(true);
    try {
      await DeviceApi.deleteDevice(deletingDevice.id);
      toast.success("Xoá thiết bị thành công");
      setDeletingDevice(null);
      await refetchDevices();
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Xoá thiết bị thất bại"));
    } finally {
      setIsDeleting(false);
    }
  };

  // Branch/device type/status/expiry aren't supported by the API yet, so they can only narrow down the devices already loaded on the current page.
  const filteredDevices = useMemo(() => {
    return devices.filter((device) => {
      const matchesBranch = !filters.branch || device.branchName.toLowerCase().includes(filters.branch.toLowerCase());
      const matchesDeviceType = !filters.deviceType || device.deviceTypeName === filters.deviceType;
      const matchesStatus =
        !filters.status ||
        (filters.status === "Chưa sử dụng" && device.status === 0) ||
        (filters.status === "Đang sử dụng" && device.status === 1) ||
        (filters.status === "Chờ thanh lý" && device.status === 2) ||
        (filters.status === "Đã thanh lý" && device.status === 3) ||
        (filters.status === "Thuê ngoài" && device.status === 4);
      const matchesExpiry = !filters.expiryDate || (device.expirationDate ? device.expirationDate <= filters.expiryDate : false);

      return matchesBranch && matchesDeviceType && matchesStatus && matchesExpiry;
    });
  }, [devices, filters.branch, filters.deviceType, filters.status, filters.expiryDate]);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[#191c1e]">Quản lý Thiết bị</h1>
          <p className="mt-1 text-[15px] text-[#5e3f3a]">Quản lý và theo dõi thiết bị phần cứng qua các văn phòng.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => router.push("/pc/reports")}
            className="cursor-pointer rounded-md border border-[#e0e3e5] bg-white px-3 py-1.5 text-xs font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6]"
          >
            📊 Xem báo cáo
          </button>
          <button className="cursor-pointer rounded-md border border-[#e0e3e5] bg-white px-3 py-1.5 text-xs font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6]">
            ↻ Đồng bộ Tanium
          </button>
          <button className="cursor-pointer rounded-md border border-[#e0e3e5] bg-white px-3 py-1.5 text-xs font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6]">
            ⤴ Nhập từ Excel
          </button>
          <button
            onClick={() => setIsPrintOpen(true)}
            className="cursor-pointer rounded-md border border-[#e0e3e5] bg-white px-3 py-1.5 text-xs font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6]"
          >
            🖨 In mã thiết bị
          </button>
          <button
            onClick={openCreateForm}
            className="cursor-pointer rounded-md bg-[#e3000f] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#b40009]"
          >
            + Thêm mới
          </button>
        </div>
      </div>

      <section className="overflow-hidden border border-[#e0e3e5] bg-white">
        <div className="border-b border-[#e0e3e5] bg-[#f8fafc] p-4">
          <DeviceFilterBar onFilter={setFilters} />
        </div>

        <div className="flex flex-col gap-3 border-b border-[#e0e3e5] bg-white p-4 md:flex-row md:items-center md:justify-between">
          <div className="text-sm font-medium text-[#5e3f3a]">
            {isLoading
              ? "Đang tải dữ liệu..."
              : `Hiển thị ${filteredDevices.length} / ${devices.length} bản ghi (trang ${pageIndex}/${totalPages}, tổng ${totalCount})`}
          </div>
        </div>

        {error && (
          <div className="border-b border-[#e9bcb6] bg-[#fff4f2] px-4 py-3 text-sm text-[#930006]">{error}</div>
        )}

        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-[#e0e3e5] bg-[#f8fafc] text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">
                <th className="whitespace-nowrap px-4 py-3">Thiết bị</th>
                <th className="whitespace-nowrap px-4 py-3">Loại / NCC</th>
                <th className="whitespace-nowrap px-4 py-3">Chi nhánh</th>
                <th className="whitespace-nowrap px-4 py-3">IP</th>
                <th className="whitespace-nowrap px-4 py-3">Người quản lý</th>
                <th className="whitespace-nowrap px-4 py-3">Mua / Hết hạn</th>
                <th className="whitespace-nowrap px-4 py-3">Trạng thái</th>
                <th className="whitespace-nowrap px-4 py-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {!isLoading && filteredDevices.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-sm text-[#5e3f3a]">
                    Không có dữ liệu thiết bị.
                  </td>
                </tr>
              )}
              {filteredDevices.map((device) => (
                <tr key={device.id} className="border-b border-[#f1f5f9] hover:bg-[#f8fafc]">
                  <td className="whitespace-nowrap px-4 py-3 align-top">
                    <div className="text-sm font-semibold text-[#191c1e]">{device.deviceCode}</div>
                    <div className="max-w-[200px] truncate text-xs text-[#5e3f3a]" title={device.deviceName}>
                      {device.deviceName}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 align-top">
                    <div className="text-sm text-[#191c1e]">{device.deviceTypeName}</div>
                    <div className="max-w-[160px] truncate text-xs text-[#5e3f3a]" title={device.supplierName}>
                      {device.supplierName}
                    </div>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <div className="max-w-[160px] truncate text-sm text-[#5e3f3a]" title={device.branchName}>
                      {device.branchName}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 align-top text-sm text-[#5e3f3a]">{device.ipAddress ?? "-"}</td>
                  <td className="whitespace-nowrap px-4 py-3 align-top">
                    <div className="text-sm text-[#191c1e]">{device.manager}</div>
                    <div className="max-w-[180px] truncate text-xs text-[#5e3f3a]" title={device.email ?? undefined}>
                      {device.email ?? "-"}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 align-top text-xs text-[#5e3f3a]">
                    <div>Mua: {formatDate(device.purchaseDate)}</div>
                    <div>HSD: {formatDate(device.expirationDate)}</div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 align-top">
                    <span
                      className={`inline-flex whitespace-nowrap px-3 py-1 text-xs font-semibold ${statusClasses[device.status] ?? statusClasses[0]}`}
                    >
                      {statusLabels[device.status] ?? "Không xác định"}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 align-top text-right text-sm">
                    <div className="inline-flex items-center gap-3">
                      <button
                        onClick={() => router.push(`/pc/devices/${device.id}`)}
                        className="cursor-pointer font-semibold text-[#5e3f3a] transition hover:text-[#191c1e]"
                        title="Chi tiết"
                      >
                        Chi tiết
                      </button>
                      <button
                        onClick={() => openEditForm(device)}
                        disabled={isLoadingEditTarget}
                        className="cursor-pointer font-semibold text-[#5e3f3a] transition hover:text-[#191c1e] disabled:opacity-50"
                        title="Sửa"
                      >
                        Sửa
                      </button>
                      <button
                        onClick={() => setDeletingDevice(device)}
                        className="cursor-pointer font-semibold text-[#930006] transition hover:text-[#e3000f]"
                        title="Xoá"
                      >
                        Xoá
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t border-[#e0e3e5] p-4">
          <button
            className="cursor-pointer text-sm text-[#5e3f3a] disabled:opacity-50"
            disabled={!hasPreviousPage || isLoading}
            onClick={() => setPageIndex((current) => Math.max(1, current - 1))}
          >
            Trang trước
          </button>
          <div className="flex h-8 items-center px-3 text-sm font-semibold text-[#191c1e]">
            Trang {pageIndex} / {totalPages}
          </div>
          <button
            className="cursor-pointer text-sm text-[#5e3f3a] disabled:opacity-50"
            disabled={!hasNextPage || isLoading}
            onClick={() => setPageIndex((current) => current + 1)}
          >
            Trang sau
          </button>
        </div>
      </section>

      <PrintDeviceCodeDialog
        isOpen={isPrintOpen}
        devices={filteredDevices}
        onClose={() => setIsPrintOpen(false)}
      />

      <DeviceForm
        isOpen={formOpen}
        mode={formMode}
        initial={editingDevice}
        loading={isSaving}
        onClose={closeForm}
        onSubmit={handleSubmitForm}
      />

      <ConfirmDialog
        isOpen={deletingDevice !== null}
        title="Xoá thiết bị"
        message={
          <>
            Bạn có chắc muốn xoá thiết bị <strong>{deletingDevice?.deviceCode}</strong> không? Hành động này không thể
            hoàn tác.
          </>
        }
        approveLabel="Xoá"
        deniedLabel="Huỷ"
        loading={isDeleting}
        onApprove={handleDelete}
        onDenied={() => {
          if (!isDeleting) setDeletingDevice(null);
        }}
      />
    </div>
  );
}
