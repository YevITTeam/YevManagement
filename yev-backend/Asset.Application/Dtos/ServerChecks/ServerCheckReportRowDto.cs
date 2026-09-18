using System;
using System.Collections.Generic;

namespace Asset.Application.Dtos.ServerChecks
{
    // 1 dòng = 1 ngày, khớp layout "Sheet1" của file mẫu (mỗi loại thiết bị gộp thành 1 cột: OK khi
    // TOÀN BỘ thiết bị loại đó trong phiên được quét — CLAUDE.md §2 luật 2 quyết định). Category nào
    // không có thiết bị nào trong phạm vi (vd chưa khai báo UPS) → *Status = null (không áp dụng).
    public class ServerCheckReportRowDto
    {
        public DateTime CheckDate { get; set; }
        public int SessionId { get; set; }
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
