"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-toastify";
import { ArrowDownAZ, ArrowUpAZ, ArrowRightLeft, ArrowUpDown, ChevronDown, Copy, Eye, Pencil, ChevronLeft, ChevronRight, FileBarChart, Plus, Printer, RefreshCw, Trash2, Upload, X } from "lucide-react";
import RowActionsMenu from "@/modules/pc-management/components/RowActionsMenu";
import DeviceFilterBar, { type DeviceFilters } from "@/modules/pc-management/components/DeviceFilterBar";
import PrintDeviceQrLabelsDialog from "@/modules/pc-management/components/PrintDeviceQrLabelsDialog";
import DeviceForm, { type DeviceFormValues } from "@/modules/pc-management/components/devices/DeviceForm";
import TransferDeviceDialog from "@/modules/pc-management/components/devices/TransferDeviceDialog";
import ImportDeviceDialog from "@/modules/pc-management/components/devices/ImportDeviceDialog";
import ImportDeviceConfigurationDialog from "@/modules/pc-management/components/devices/ImportDeviceConfigurationDialog";
import ImportDeviceLiquidationDialog from "@/modules/pc-management/components/devices/ImportDeviceLiquidationDialog";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import { DeviceApi } from "@/modules/pc-management/api/device.api";
import type { DeviceDto, DeviceGetDto, SkippedDeviceDto } from "@/modules/pc-management/types/device.dto";
import { getApiErrorMessage } from "@/lib/apiError";
import { useRouter } from '@/navigation';
import { useFetchEffect } from "@/modules/common/hooks/useFetchEffect";
const statusLabels: Record<number, string> = {
  0: "Chưa sử dụng",
  1: "Đang sử dụng",
  2: "Chờ thanh lý",
  3: "Đã thanh lý",
  4: "Đang sửa chữa",
};

const statusClasses: Record<number, string> = {
  0: "border border-[#cbd5e1] bg-[#eef2f6] text-[#475569]",
  1: "border border-[#16a34a] bg-[#16a34a] text-white",
  2: "border border-[#f59e0b] bg-[#fef3c7] text-[#b45309]",
  3: "border border-[#dc2626] bg-[#dc2626] text-white",
  4: "border border-[#8b5cf6] bg-[#ede9fe] text-[#6d28d9]",
};

const defaultFilters: DeviceFilters = {
  deviceCode: "",
  manager: "",
  ipAddress: "",
  email: "",
  supplierName: "",
  purchaseDate: "",
  branch: "",
  deviceType: "",
  status: "",
  expiryDate: "",
  serialNumber: "",
  isUseUsb: "",
  requiresDailyCheck: "",
  groupId: "",
  departmentId: "",
};

function formatDate(value: string | null) {
  if (!value) {
    return "-";
  }
  return new Date(value).toLocaleDateString("vi-VN");
}

// Suggests the next code for a duplicated device (e.g. "YDC-1877" -> "YDC-1878"), keeping zero padding;
// codes without a numeric tail are returned unchanged.
function incrementDeviceCode(code: string): string {
  const match = code.match(/^(.*?)(\d+)$/);
  if (!match) return code;
  const [, prefix, digits] = match;
  const nextDigits = String(Number(digits) + 1).padStart(digits.length, "0");
  return `${prefix}${nextDigits}`;
}


export default function DeviceList() {
  const [filters, setFilters] = useState<DeviceFilters>(defaultFilters);
  const [devices, setDevices] = useState<DeviceDto[]>([]);
  const [pageIndex, setPageIndex] = useState(1);
  const [pageSize] = useState(50);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [hasPreviousPage, setHasPreviousPage] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isTaniumImportOpen, setIsTaniumImportOpen] = useState(false);
  const [isLiquidationImportOpen, setIsLiquidationImportOpen] = useState(false);
  const router = useRouter();

  // Secondary actions are grouped under one menu to save toolbar space; "+ Add" stays separate as the primary action.
  const [isActionsMenuOpen, setIsActionsMenuOpen] = useState(false);
  const actionsMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isActionsMenuOpen) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (actionsMenuRef.current?.contains(event.target as Node)) return;
      setIsActionsMenuOpen(false);
    };
    const handleKey = (event: KeyboardEvent) => event.key === "Escape" && setIsActionsMenuOpen(false);
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKey);
    };
  }, [isActionsMenuOpen]);

  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [editingDevice, setEditingDevice] = useState<DeviceGetDto | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingEditTarget, setIsLoadingEditTarget] = useState(false);

  const [deletingDevice, setDeletingDevice] = useState<DeviceDto | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Map keeps labels for selected devices that left the current page/search; intentionally not reset when
  // `devices` changes so users can search several times and print once.
  const [selectedDevices, setSelectedDevices] = useState<Map<number, string>>(new Map());
  const selectedIds = useMemo(() => Array.from(selectedDevices.keys()), [selectedDevices]);
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  // undefined = BE default (purchaseDate desc); true/false = deviceCode asc/desc.
  const [sortDeviceCodeAscending, setSortDeviceCodeAscending] = useState<boolean | undefined>(undefined);
  // Numeric IP sort; only one sort mode is active at a time.
  const [sortIpAddressAscending, setSortIpAddressAscending] = useState<boolean | undefined>(undefined);
  const [transferringDevice, setTransferringDevice] = useState<{ id: number; deviceCode: string; deviceName: string } | null>(null);
  // Prefills the new device when opening Transfer from an Excel import's pendingTransfers.
  const [transferPresetNewDeviceId, setTransferPresetNewDeviceId] = useState<number | null>(null);
  // Offer label printing right after a manual create, like the Excel import flow.
  const [printPromptDevice, setPrintPromptDevice] = useState<{ id: number; deviceCode: string } | null>(null);
  // Shared by bulk printing (grid selection) and printing right after a manual create; null = closed.
  const [qrPrintDeviceIds, setQrPrintDeviceIds] = useState<number[] | null>(null);

  const toggleSortDeviceCode = () => {
    setSortIpAddressAscending(undefined);
    setSortDeviceCodeAscending((current) => (current === undefined ? true : current === true ? false : undefined));
  };

  const toggleSortIpAddress = () => {
    setSortDeviceCodeAscending(undefined);
    setSortIpAddressAscending((current) => (current === undefined ? true : current === true ? false : undefined));
  };

  // The table is usually wider than the screen (multi-line IP/email), so allow mouse drag to scroll horizontally.
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isDragScrolling, setIsDragScrolling] = useState(false);
  const dragStateRef = useRef({ startX: 0, scrollLeft: 0 });

  const handleDragStart = (event: React.MouseEvent<HTMLDivElement>) => {
    const container = scrollContainerRef.current;
    if (!container) return;
    // Don't start dragging from interactive elements inside the table.
    if ((event.target as HTMLElement).closest("button, a, input, select, textarea")) return;
    setIsDragScrolling(true);
    dragStateRef.current = { startX: event.pageX - container.offsetLeft, scrollLeft: container.scrollLeft };
  };

  const handleDragMove = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragScrolling) return;
    const container = scrollContainerRef.current;
    if (!container) return;
    event.preventDefault();
    const x = event.pageX - container.offsetLeft;
    const walk = x - dragStateRef.current.startX;
    container.scrollLeft = dragStateRef.current.scrollLeft - walk;
  };

  const handleDragEnd = () => setIsDragScrolling(false);

  // Reset to page 1 on filter change; snapshot compared during render instead of an effect.
  const filtersKey = JSON.stringify([
    filters.deviceCode,
    filters.manager,
    filters.ipAddress,
    filters.email,
    filters.supplierName,
    filters.purchaseDate,
    filters.branch,
    filters.deviceType,
    filters.status,
    filters.expiryDate,
    filters.serialNumber,
    filters.isUseUsb,
    filters.requiresDailyCheck,
    filters.groupId,
    filters.departmentId,
    sortDeviceCodeAscending,
    sortIpAddressAscending,
  ]);
  const [prevFiltersKey, setPrevFiltersKey] = useState(filtersKey);
  if (prevFiltersKey !== filtersKey) {
    setPrevFiltersKey(filtersKey);
    setPageIndex(1);
  }

  // Every filter maps to a Device/grid-list query param, so filtering and paging stay server-side.
  const { isLoading, error, refetch: refetchDevices } = useFetchEffect(
    () =>
      DeviceApi.getDevicePageNation({
        pageIndex,
        pageSize,
        deviceCode: filters.deviceCode || undefined,
        manager: filters.manager || undefined,
        ipAddress: filters.ipAddress || undefined,
        email: filters.email || undefined,
        supplierName: filters.supplierName || undefined,
        purchaseDate: filters.purchaseDate || undefined,
        serialNumber: filters.serialNumber || undefined,
        isUseUsb: filters.isUseUsb === "" ? undefined : filters.isUseUsb === "true",
        requiresDailyCheck: filters.requiresDailyCheck === "" ? undefined : filters.requiresDailyCheck === "true",
        groupId: filters.groupId === "" ? undefined : Number(filters.groupId),
        departmentId: filters.departmentId === "" ? undefined : Number(filters.departmentId),
        branchId: filters.branch === "" ? undefined : Number(filters.branch),
        deviceTypeId: filters.deviceType === "" ? undefined : Number(filters.deviceType),
        // "outsourced" is a dropdown-only sentinel mapped to IsOutsourced (Device.Status is only 0-3).
        status: filters.status === "" || filters.status === "outsourced" ? undefined : Number(filters.status),
        isOutsourced: filters.status === "outsourced" ? true : undefined,
        expiryDate: filters.expiryDate || undefined,
        sortDeviceCodeAscending,
        sortIpAddressAscending,
      }),
    [pageIndex, pageSize, filtersKey],
    (result) => {
      setDevices(result.data);
      setTotalCount(result.totalCount);
      setTotalPages(result.totalPages);
      setHasNextPage(result.hasNextPage);
      setHasPreviousPage(result.hasPreviousPage);
    },
    "Không thể tải danh sách thiết bị.",
    undefined,
    "devices"
  );

  const toggleSelectDevice = (device: DeviceDto) => {
    setSelectedDevices((current) => {
      const next = new Map(current);
      if (next.has(device.id)) next.delete(device.id);
      else next.set(device.id, device.deviceCode);
      return next;
    });
  };

  // Only toggles devices on the current page; selections from earlier searches/pages are kept.
  const toggleSelectAll = () => {
    const allVisibleSelected = devices.length > 0 && devices.every((device) => selectedDevices.has(device.id));
    setSelectedDevices((current) => {
      const next = new Map(current);
      devices.forEach((device) => {
        if (allVisibleSelected) next.delete(device.id);
        else next.set(device.id, device.deviceCode);
      });
      return next;
    });
  };

  const removeSelectedDevice = (id: number) => {
    setSelectedDevices((current) => {
      const next = new Map(current);
      next.delete(id);
      return next;
    });
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    setIsBulkDeleting(true);
    try {
      const { deletedCount, skippedDevices } = await DeviceApi.bulkDeleteDevices(selectedIds);

      if (deletedCount > 0) {
        toast.success(`Xoá thành công ${deletedCount} thiết bị`);
      }
      if (skippedDevices.length > 0) {
        toast.warning(
          `Bỏ qua ${skippedDevices.length} thiết bị: ` +
            skippedDevices.map((skipped: SkippedDeviceDto) => `${skipped.deviceCode} (${skipped.reason})`).join(", ")
        );
      }

      setIsBulkDeleteOpen(false);
      setSelectedDevices(new Map());
      await refetchDevices();
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Xoá thiết bị thất bại"));
    } finally {
      setIsBulkDeleting(false);
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

  // Duplicate copies everything except IP/serial/manager/email, which are unique per physical machine;
  // the device code is auto-incremented as a suggestion.
  const openDuplicateForm = async (device: DeviceDto) => {
    setIsLoadingEditTarget(true);
    try {
      const detail = await DeviceApi.getDeviceById(device.id);
      setFormMode("create");
      setEditingDevice({
        ...detail,
        deviceCode: incrementDeviceCode(detail.deviceCode),
        manager: "",
        managerDomainAccount: null,
        serialNumber: "",
        emails: [],
        ipAddresses: [],
      });
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
        const created = await DeviceApi.createDevice({ id: 0, ...values });
        toast.success("Tạo thiết bị thành công");
        setPrintPromptDevice({ id: created.id, deviceCode: created.deviceCode });
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

  const handlePrintSelectedDevices = () => {
    if (selectedIds.length === 0) {
      toast.error("Vui lòng chọn ít nhất một thiết bị để in.");
      return;
    }

    setQrPrintDeviceIds(selectedIds);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-lg font-semibold text-[#191c1e]" title="Quản lý và theo dõi thiết bị phần cứng qua các văn phòng.">
          Quản lý Thiết bị
        </h1>

        <div className="flex flex-wrap items-center gap-2">
          <div ref={actionsMenuRef} className="relative">
            <button
              onClick={() => setIsActionsMenuOpen((current) => !current)}
              className="cursor-pointer flex h-8 items-center gap-1.5 rounded-md border border-[#e0e3e5] bg-white px-3 text-xs! font-semibold! text-[#191c1e] transition hover:bg-[#f2f4f6]"
              aria-haspopup="menu"
              aria-expanded={isActionsMenuOpen}
            >
              Thao tác
              <ChevronDown className="h-3.5 w-3.5" />
            </button>

            {isActionsMenuOpen && (
              <div
                role="menu"
                className="absolute right-0 top-full z-20 mt-1 w-max min-w-[200px] overflow-hidden rounded-lg border border-[#e0e3e5] bg-white py-1 shadow-lg"
              >
                <button
                  role="menuitem"
                  onClick={() => {
                    setIsActionsMenuOpen(false);
                    router.push("/pc/reports");
                  }}
                  className="flex w-full cursor-pointer items-center gap-2 whitespace-nowrap px-3 py-1.5 text-left text-xs! font-semibold! text-[#5e3f3a] transition hover:bg-[#f8fafc] hover:text-[#191c1e]"
                >
                  <FileBarChart className="h-3.5 w-3.5" /> Xem báo cáo
                </button>
                <button
                  role="menuitem"
                  onClick={() => {
                    setIsActionsMenuOpen(false);
                    setIsTaniumImportOpen(true);
                  }}
                  className="flex w-full cursor-pointer items-center gap-2 whitespace-nowrap px-3 py-1.5 text-left text-xs! font-semibold! text-[#5e3f3a] transition hover:bg-[#f8fafc] hover:text-[#191c1e]"
                >
                  <RefreshCw className="h-3.5 w-3.5" /> Đồng bộ từ Tanium
                </button>
                <button
                  role="menuitem"
                  onClick={() => {
                    setIsActionsMenuOpen(false);
                    setIsImportOpen(true);
                  }}
                  className="flex w-full cursor-pointer items-center gap-2 whitespace-nowrap px-3 py-1.5 text-left text-xs! font-semibold! text-[#5e3f3a] transition hover:bg-[#f8fafc] hover:text-[#191c1e]"
                >
                  <Upload className="h-3.5 w-3.5" /> Nhập từ Excel
                </button>
                <button
                  role="menuitem"
                  onClick={() => {
                    setIsActionsMenuOpen(false);
                    setIsLiquidationImportOpen(true);
                  }}
                  className="flex w-full cursor-pointer items-center gap-2 whitespace-nowrap px-3 py-1.5 text-left text-xs! font-semibold! text-[#5e3f3a] transition hover:bg-[#f8fafc] hover:text-[#191c1e]"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Nhập thanh lý hàng loạt
                </button>
              </div>
            )}
          </div>
          <button
            onClick={openCreateForm}
            className="cursor-pointer inline-flex h-8 items-center gap-1.5 rounded-md bg-[#e3000f] px-3 text-xs! font-semibold! text-white transition hover:bg-[#b40009]"
          >
            <Plus className="h-3.5 w-3.5" /> Thêm mới
          </button>
        </div>
      </div>

      <section className="overflow-hidden border border-[#e0e3e5] bg-white">
        <div className="border-b border-[#e0e3e5] bg-[#f8fafc] p-2.5">
          <DeviceFilterBar onFilter={setFilters} />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e0e3e5] bg-white px-3 py-1.5">
          <div className="text-xs font-medium text-[#5e3f3a]">
            {isLoading
              ? "Đang tải dữ liệu..."
              : `Hiển thị ${devices.length} bản ghi (trang ${pageIndex}/${totalPages}, tổng ${totalCount})`}
          </div>

          {selectedIds.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-[#5e3f3a]">Đã chọn {selectedIds.length} thiết bị</span>
              <button
                onClick={() => setSelectedDevices(new Map())}
                className="cursor-pointer text-xs! font-semibold! text-[#5e3f3a] underline-offset-2 transition hover:text-[#191c1e] hover:underline"
              >
                Bỏ chọn tất cả
              </button>
              <button
                onClick={handlePrintSelectedDevices}
                className="flex h-7 cursor-pointer items-center gap-1.5 rounded-md border border-[#e0e3e5] bg-white px-2.5 text-xs! font-semibold! text-[#191c1e] transition hover:bg-[#f2f4f6]"
              >
                <Printer className="h-3.5 w-3.5" /> In tem QR
              </button>
              <button
                onClick={() => setIsBulkDeleteOpen(true)}
                className="flex h-7 cursor-pointer items-center gap-1.5 rounded-md border border-[#930006] bg-white px-2.5 text-xs! font-semibold! text-[#930006] transition hover:bg-[#fff4f2]"
              >
                <Trash2 className="h-3.5 w-3.5" /> Xoá đã chọn
              </button>
            </div>
          )}
        </div>

        {/* Selection persists across searches/pages, so show it as removable badges even when off-screen. */}
        {selectedIds.length > 0 && (
          <div className="flex max-h-24 flex-wrap gap-1 overflow-y-auto border-b border-[#e0e3e5] bg-[#fff8f6] px-3 py-1.5">
            {Array.from(selectedDevices.entries()).map(([id, code]) => (
              <span
                key={id}
                className="inline-flex items-center gap-1 rounded-md border border-[#e0e3e5] bg-white px-2 py-0.5 text-xs font-medium text-[#191c1e]"
              >
                {code}
                <button
                  type="button"
                  onClick={() => removeSelectedDevice(id)}
                  className="cursor-pointer text-[#8a8f94] transition hover:text-[#e3000f]"
                  aria-label={`Bỏ chọn ${code}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}

        {error && (
          <div className="border-b border-[#e9bcb6] bg-[#fff4f2] px-3 py-2 text-xs text-[#930006]">{error}</div>
        )}

        <div
          ref={scrollContainerRef}
          onMouseDown={handleDragStart}
          onMouseMove={handleDragMove}
          onMouseUp={handleDragEnd}
          onMouseLeave={handleDragEnd}
          className={`overflow-x-auto overflow-y-auto ${isDragScrolling ? "cursor-grabbing select-none" : "cursor-grab"}`}
          style={{ maxHeight: "calc(100vh - 250px)", minHeight: 320 }}
        >
          <table className="w-auto border-collapse text-left">
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-[#e0e3e5] bg-[#f8fafc] text-[11px] font-semibold uppercase tracking-[0.06em] text-[#5e3f3a]">
                <th className="w-10 whitespace-nowrap px-3 py-1.5">
                  <input
                    type="checkbox"
                    className="h-4 w-4 cursor-pointer accent-[#e3000f]"
                    checked={devices.length > 0 && devices.every((device) => selectedDevices.has(device.id))}
                    onChange={toggleSelectAll}
                    aria-label="Chọn tất cả (trang hiện tại)"
                  />
                </th>
                <th className="whitespace-nowrap px-3 py-1.5">
                  <button
                    type="button"
                    onClick={toggleSortDeviceCode}
                    className="cursor-pointer inline-flex items-center gap-1.5 text-[11px]! font-semibold! uppercase tracking-[0.06em] text-[#5e3f3a] transition hover:text-[#191c1e]"
                    title="Sắp xếp theo mã thiết bị"
                  >
                    Thiết bị
                    {sortDeviceCodeAscending === undefined && <ArrowUpDown className="h-3.5 w-3.5" />}
                    {sortDeviceCodeAscending === true && <ArrowDownAZ className="h-3.5 w-3.5" />}
                    {sortDeviceCodeAscending === false && <ArrowUpAZ className="h-3.5 w-3.5" />}
                  </button>
                </th>
                <th className="whitespace-nowrap px-3 py-1.5">Loại / NCC</th>
                <th className="whitespace-nowrap px-3 py-1.5">Chi nhánh</th>
                <th className="whitespace-nowrap px-3 py-1.5">
                  <button
                    type="button"
                    onClick={toggleSortIpAddress}
                    className="cursor-pointer inline-flex items-center gap-1.5 text-[11px]! font-semibold! uppercase tracking-[0.06em] text-[#5e3f3a] transition hover:text-[#191c1e]"
                    title="Sắp xếp theo địa chỉ IP"
                  >
                    Địa chỉ IP
                    {sortIpAddressAscending === undefined && <ArrowUpDown className="h-3.5 w-3.5" />}
                    {sortIpAddressAscending === true && <ArrowDownAZ className="h-3.5 w-3.5" />}
                    {sortIpAddressAscending === false && <ArrowUpAZ className="h-3.5 w-3.5" />}
                  </button>
                </th>
                <th className="whitespace-nowrap px-3 py-1.5">Người quản lý</th>
                <th className="whitespace-nowrap px-3 py-1.5">Email</th>
                <th className="whitespace-nowrap px-3 py-1.5">Mua / Hết hạn</th>
                <th className="whitespace-nowrap px-3 py-1.5">Trạng thái</th>
                <th className="w-full px-3 py-1.5">Ghi chú</th>
                <th className="sticky right-0 z-10 w-10 whitespace-nowrap bg-[#f8fafc] px-2 py-1.5 text-right shadow-[-8px_0_8px_-8px_rgba(0,0,0,0.08)]">
                  <span className="sr-only">Hành động</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {!isLoading && devices.length === 0 && (
                <tr>
                  <td colSpan={11} className="px-4 py-8 text-center text-sm text-[#5e3f3a]">
                    Không có dữ liệu thiết bị.
                  </td>
                </tr>
              )}
              {devices.map((device) => (
                <tr key={device.id} className="group border-b border-[#f1f5f9] bg-white even:bg-[#f2f4f7] hover:bg-[#e8ecf1]">
                  <td className="w-10 whitespace-nowrap px-3 py-1.5 align-top">
                    <input
                      type="checkbox"
                      className="h-4 w-4 cursor-pointer accent-[#e3000f]"
                      checked={selectedDevices.has(device.id)}
                      onChange={() => toggleSelectDevice(device)}
                      aria-label={`Chọn thiết bị ${device.deviceCode}`}
                    />
                  </td>
                  <td className="whitespace-nowrap px-3 py-1.5 align-top">
                    <div className="text-sm font-semibold text-[#191c1e]">{device.deviceCode}</div>
                    <div className="max-w-[200px] truncate text-xs text-[#5e3f3a]" title={device.deviceName}>
                      {device.deviceName}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-1.5 align-top">
                    <div className="text-sm text-[#191c1e]">{device.deviceTypeName}</div>
                    <div className="max-w-[160px] truncate text-xs text-[#5e3f3a]" title={device.supplierName}>
                      {device.supplierName}
                    </div>
                  </td>
                  <td className="px-3 py-1.5 align-top">
                    <div className="max-w-[120px] truncate text-xs text-[#5e3f3a]" title={device.branchName}>
                      {device.branchName}
                    </div>
                    <div className="max-w-[120px] truncate text-sm text-[#191c1e]" title={device.departmentName ?? undefined}>
                      {device.departmentName || "-"}
                    </div>
                    <div className="max-w-[120px] truncate text-sm text-[#191c1e]" title={device.groupName ?? undefined}>
                      {device.groupName || "-"}
                    </div>
                  </td>
                  <td className="px-3 py-1.5 align-top">
                    {device.ipAddresses.length > 0 ? (
                      <div className="flex flex-col items-start gap-0.5">
                        {device.ipAddresses.map((ip, index) => (
                          <span
                            key={index}
                            className="whitespace-nowrap rounded-md border border-[#e0e3e5] bg-[#f8fafc] px-2 py-0.5 text-xs font-medium text-[#191c1e]"
                          >
                            {ip}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-sm text-[#5e3f3a]">-</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-1.5 align-top">
                    <div className="text-sm text-[#191c1e]">{device.manager || "-"}</div>
                    {device.managerDomainAccount && (
                      <div className="max-w-[160px] truncate text-xs text-[#8a8f94]" title={`Tài khoản domain: ${device.managerDomainAccount}`}>
                        {device.managerDomainAccount}
                      </div>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-1.5 align-top">
                    {device.emails.length > 0 ? (
                      <div className="flex flex-col gap-0.5">
                        {device.emails.map((email, index) => (
                          <div key={index} className="text-xs text-[#5e3f3a]">
                            {email}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-sm text-[#5e3f3a]">-</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-1.5 align-top text-xs text-[#5e3f3a]">
                    <div>Mua: {formatDate(device.purchaseDate)}</div>
                    <div>HSD: {formatDate(device.expirationDate)}</div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-1.5 align-top">
                    <span
                      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusClasses[device.status] ?? statusClasses[0]}`}
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
                      {statusLabels[device.status] ?? "Không xác định"}
                    </span>
                  </td>
                  <td className="w-full px-3 py-1.5 align-top">
                    <div className="line-clamp-2 text-xs text-[#5e3f3a]" title={device.note ?? undefined}>
                      {device.note || "-"}
                    </div>
                  </td>
                  <td className="sticky right-0 w-10 whitespace-nowrap bg-inherit px-2 py-1.5 align-top text-right text-sm shadow-[-8px_0_8px_-8px_rgba(0,0,0,0.08)]">
                    <div className="inline-flex justify-end">
                      <RowActionsMenu
                        actions={[
                          { label: "Chi tiết", icon: Eye, onClick: () => router.push({ pathname: "/pc/devices", query: { id: String(device.id) } }) },
                          { label: "Sửa", icon: Pencil, onClick: () => openEditForm(device), disabled: isLoadingEditTarget },
                          { label: "Nhân bản", icon: Copy, onClick: () => openDuplicateForm(device), disabled: isLoadingEditTarget },
                          {
                            label: "Chuyển máy",
                            icon: ArrowRightLeft,
                            onClick: () => {
                              setTransferPresetNewDeviceId(null);
                              setTransferringDevice(device);
                            },
                            disabled: device.status === 3,
                          },
                          { label: "Xoá", icon: Trash2, onClick: () => setDeletingDevice(device), variant: "danger" },
                        ]}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-[#e0e3e5] px-3 py-1.5">
          <button
            className="flex h-7 cursor-pointer items-center gap-1 rounded-md px-2 text-xs! text-[#5e3f3a] transition hover:bg-[#f2f4f6] disabled:cursor-not-allowed disabled:opacity-40"
            disabled={!hasPreviousPage || isLoading}
            onClick={() => setPageIndex((current) => Math.max(1, current - 1))}
          >
            <ChevronLeft className="h-3.5 w-3.5" /> Trang trước
          </button>
          <div className="text-xs font-semibold text-[#191c1e]">
            Trang {pageIndex} / {totalPages}
          </div>
          <button
            className="flex h-7 cursor-pointer items-center gap-1 rounded-md px-2 text-xs! text-[#5e3f3a] transition hover:bg-[#f2f4f6] disabled:cursor-not-allowed disabled:opacity-40"
            disabled={!hasNextPage || isLoading}
            onClick={() => setPageIndex((current) => current + 1)}
          >
            Trang sau <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </section>

      <ImportDeviceDialog
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        onImported={() => {
          setIsImportOpen(false);
          refetchDevices();
        }}
        onRequestTransfer={({ oldDeviceId, oldDeviceCode, newDeviceId }) => {
          setIsImportOpen(false);
          refetchDevices();
          setTransferPresetNewDeviceId(newDeviceId);
          setTransferringDevice({ id: oldDeviceId, deviceCode: oldDeviceCode, deviceName: "" });
        }}
      />

      <ImportDeviceConfigurationDialog
        isOpen={isTaniumImportOpen}
        onClose={() => setIsTaniumImportOpen(false)}
        onImported={() => {
          setIsTaniumImportOpen(false);
          refetchDevices();
        }}
      />

      <ImportDeviceLiquidationDialog
        isOpen={isLiquidationImportOpen}
        onClose={() => setIsLiquidationImportOpen(false)}
        onImported={() => {
          setIsLiquidationImportOpen(false);
          refetchDevices();
        }}
      />

      <TransferDeviceDialog
        isOpen={transferringDevice !== null}
        oldDevice={transferringDevice}
        initialNewDeviceId={transferPresetNewDeviceId}
        onClose={() => {
          setTransferringDevice(null);
          setTransferPresetNewDeviceId(null);
        }}
        onTransferred={() => {
          setTransferringDevice(null);
          setTransferPresetNewDeviceId(null);
          refetchDevices();
        }}
      />

      <DeviceForm
        isOpen={formOpen}
        mode={formMode}
        initial={editingDevice}
        loading={isSaving}
        onClose={closeForm}
        onSubmit={handleSubmitForm}
      />

      <PrintDeviceQrLabelsDialog
        isOpen={qrPrintDeviceIds !== null}
        deviceIds={qrPrintDeviceIds ?? []}
        onClose={() => setQrPrintDeviceIds(null)}
        onPrinted={() => setSelectedDevices(new Map())}
      />

      <ConfirmDialog
        isOpen={printPromptDevice !== null}
        title="In mã thiết bị"
        message={`Đã tạo thiết bị ${printPromptDevice?.deviceCode ?? ""} thành công. Bạn có muốn in mã thiết bị vừa tạo không?`}
        approveLabel="In mã"
        deniedLabel="Để sau"
        onApprove={() => {
          if (printPromptDevice) setQrPrintDeviceIds([printPromptDevice.id]);
          setPrintPromptDevice(null);
        }}
        onDenied={() => setPrintPromptDevice(null)}
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

      <ConfirmDialog
        isOpen={isBulkDeleteOpen}
        title="Xoá thiết bị"
        message={
          <>
            Bạn có chắc muốn xoá <strong>{selectedIds.length}</strong> thiết bị đã chọn không? Hành động này không thể
            hoàn tác.
          </>
        }
        approveLabel="Xoá"
        deniedLabel="Huỷ"
        loading={isBulkDeleting}
        onApprove={handleBulkDelete}
        onDenied={() => {
          if (!isBulkDeleting) setIsBulkDeleteOpen(false);
        }}
      />
    </div>
  );
}
