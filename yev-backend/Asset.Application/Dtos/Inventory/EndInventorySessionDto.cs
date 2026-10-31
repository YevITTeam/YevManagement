using System.Collections.Generic;

namespace Asset.Application.Dtos.Inventory
{
    // Free-text note for items still Pending at session end (forced to Missing); no checklist by design.
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
