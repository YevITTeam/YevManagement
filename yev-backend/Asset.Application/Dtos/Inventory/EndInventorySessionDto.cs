using System.Collections.Generic;

namespace Asset.Application.Dtos.Inventory
{
    // Ghi chú tự do cho các thiết bị còn Pending khi kết thúc phiên (bị ép thành Missing) — không có
    // checklist lỗi dạng tick sẵn, cùng quyết định đơn giản hoá như EndServerCheckSessionDto.
    public class EndInventorySessionDto
    {
        public List<EndInventoryItemInputDto> Items { get; set; } = new();
    }

    public class EndInventoryItemInputDto
    {
        public int InventorySessionItemId { get; set; }
        public string? Note { get; set; }
    }
}
