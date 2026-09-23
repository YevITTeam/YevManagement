using System;
using System.Collections.Generic;
using System.Text;

namespace Asset.Application.Dtos.Devices
{
    public class DeviceFilterRequest
    {
        public int PageIndex { get; set; } = 1;
        public int PageSize { get; set; } = 50;

        public string? DeviceCode { get; set; }
        public string? Manager { get; set; }
        public string? PurchaseDate { get; set; }
        public string? IpAddress { get; set; }
        public string? Email { get; set; }
        public string? SupplierName { get; set; }
        public int? GroupId { get; set; }
        public int? DepartmentId { get; set; }
        public string? Note { get; set; }
        public bool? IsOutsourced { get; set; }
        public string? SerialNumber { get; set; }
        public bool? IsUseUsb { get; set; }
        // Lọc máy đã tick "Cần kiểm tra hằng ngày (QR)" — dùng cho màn Thiết bị gom nhanh máy cần in QR
        // cho phòng server (asset-module.md §1.19/§1.21).
        public bool? RequiresDailyCheck { get; set; }
        public int? BranchId { get; set; }
        public int? DeviceTypeId { get; set; }
        // 0=PendingUse, 1=InUse, 2=PendingLiquidation, 3=Liquidated (Asset.Domain.Enums.DeviceStatus).
        public int? Status { get; set; }
        // Thiết bị hết hạn vào hoặc trước ngày này (Device.ExpirationDate <= ExpiryDate).
        public DateTime? ExpiryDate { get; set; }

        // 2026-07-10: sort by DeviceCode, null = keep the default OrderByDescending(PurchaseDate).
        // true = ascending, false = descending.
        public bool? SortDeviceCodeAscending { get; set; }

        // 2026-07-30 — name-based filters, added for the AI chat (the grid UI filters by id via its own
        // dropdowns and does not send these; all optional, so nothing existing changes).
        //
        // Two reasons they filter by NAME rather than id, deliberately:
        // 1. BranchName had no filter at all before, so "các máy ở chi nhánh Dĩ An" — a question the data
        //    fully supports (Device.BranchId exists, DeviceGridDto.BranchName is returned) — simply could
        //    not be answered.
        // 2. GroupName/DepartmentName duplicate GroupId/DepartmentId on purpose. Making the model do
        //    name→id in a separate tool call first is exactly where the small local model breaks: it
        //    narrates the 2-step plan ("tôi sẽ tìm ID bộ phận rồi mới tìm máy") and ends the turn without
        //    calling anything. Accepting the name directly collapses the chain into 1 tool call.
        // Same Contains() semantics as SupplierName, which was already name-based.
        public string? BranchName { get; set; }
        public string? GroupName { get; set; }
        public string? DepartmentName { get; set; }
    }
}
