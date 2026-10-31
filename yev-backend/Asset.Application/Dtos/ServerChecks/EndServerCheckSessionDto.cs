using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace Asset.Application.Dtos.ServerChecks
{
    // Note applies only to items still Pending at session end; Ok items are left untouched.
    // ManualResults must cover every active ServerCheckManualItem.
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

        // ServerCheckItemStatus; only Ok(1)/Ng(2) accepted.
        [Required]
        public int Status { get; set; }

        public string? Note { get; set; }
    }
}
