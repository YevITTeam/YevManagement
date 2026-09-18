using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace Asset.Application.Dtos.ServerChecks
{
    // Note chỉ áp dụng cho item còn Pending (chưa quét) khi kết thúc phiên — item đã Ok giữ nguyên,
    // gửi kèm cũng bị bỏ qua. ManualResults bắt buộc đủ toàn bộ ServerCheckManualItem đang active.
    public class EndServerCheckSessionDto
    {
        public List<EndServerCheckItemNoteDto> Items { get; set; } = new();

        [Required(ErrorMessage = "Vui lòng xác nhận đủ các mục kiểm tra thủ công.")]
        public List<EndServerCheckManualResultDto> ManualResults { get; set; } = new();
    }

    public class EndServerCheckItemNoteDto
    {
        [Required]
        public int ServerCheckItemId { get; set; }

        public string? Note { get; set; }
    }

    public class EndServerCheckManualResultDto
    {
        [Required]
        public int ManualItemId { get; set; }

        // Asset.Domain.Enums.ServerCheckItemStatus — chỉ nhận Ok(1)/Ng(2).
        [Required]
        public int Status { get; set; }

        public string? Note { get; set; }
    }
}
