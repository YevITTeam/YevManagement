using System;

namespace Asset.Domain.Entities;

// Snapshot 1 Device thuộc xưởng của phiên tại thời điểm start (asset-module.md §1.22). Quét mã không
// khớp bản ghi nào ở đây (mã không tồn tại, hoặc thiết bị thuộc xưởng khác/phát sinh sau khi snapshot)
// bị từ chối thẳng ở Service, KHÔNG tạo bản ghi mới — quyết định người dùng, không có khái niệm
// "quét thừa/lạ".
public partial class InventorySessionItem
{
    public int Id { get; set; }

    public int SessionId { get; set; }

    public int DeviceId { get; set; }

    public DateTime? ScannedAt { get; set; }

    public string? ScannedBy { get; set; }

    public int Status { get; set; }

    public string? Note { get; set; }

    public virtual InventorySession Session { get; set; } = null!;

    public virtual Device Device { get; set; } = null!;
}
