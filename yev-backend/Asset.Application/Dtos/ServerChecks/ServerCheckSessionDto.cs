using System;
using System.Collections.Generic;

namespace Asset.Application.Dtos.ServerChecks
{
    public class ServerCheckSessionDto
    {
        public int Id { get; set; }
        public DateTime CheckDate { get; set; }
        public int? BranchId { get; set; }
        public string? BranchName { get; set; }
        public DateTime StartedAt { get; set; }
        public string StartedBy { get; set; } = null!;
        public DateTime? EndedAt { get; set; }
        public string? EndedBy { get; set; }
        public int Status { get; set; }
        public string StatusText { get; set; } = null!;
        public int TotalCount { get; set; }
        public int ScannedCount { get; set; }
        public List<ServerCheckItemDto> Items { get; set; } = new();
        public List<ServerCheckManualResultDto> ManualResults { get; set; } = new();
    }
}
