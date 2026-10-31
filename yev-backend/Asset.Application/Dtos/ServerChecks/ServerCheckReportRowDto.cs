using System;
using System.Collections.Generic;

namespace Asset.Application.Dtos.ServerChecks
{
    // 1 row = 1 day, matching "Sheet1" of the paper template; a category is OK only when ALL its devices were scanned.
    // Categories with no devices in scope get *Status = null (not applicable).
    public class ServerCheckReportRowDto
    {
        public DateTime CheckDate { get; set; }
        public int SessionId { get; set; }
        public int? BranchId { get; set; }
        public string? BranchName { get; set; }
        public int SessionStatus { get; set; }
        public string SessionStatusText { get; set; } = null!;

        public bool? ServerStatus { get; set; }
        public string? ServerNote { get; set; }

        public bool? NetworkStatus { get; set; }
        public string? NetworkNote { get; set; }

        public bool? UpsStatus { get; set; }
        public string? UpsNote { get; set; }

        public bool? AirConditionerStatus { get; set; }
        public string? AirConditionerNote { get; set; }

        public List<ServerCheckManualResultDto> ManualResults { get; set; } = new();

        public string? CheckedBy { get; set; }
    }
}
