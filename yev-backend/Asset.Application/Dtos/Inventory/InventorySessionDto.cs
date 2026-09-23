using System;
using System.Collections.Generic;

namespace Asset.Application.Dtos.Inventory
{
    public class InventorySessionDto
    {
        public int Id { get; set; }
        public int BranchId { get; set; }
        public string? BranchName { get; set; }
        public DateTime StartedAt { get; set; }
        public string StartedBy { get; set; } = null!;
        public DateTime? EndedAt { get; set; }
        public string? EndedBy { get; set; }
        public int Status { get; set; }
        public string StatusText { get; set; } = null!;
        public int TotalCount { get; set; }
        public int FoundCount { get; set; }
        public int MissingCount { get; set; }
        public List<InventorySessionItemDto> Items { get; set; } = new();
    }
}
