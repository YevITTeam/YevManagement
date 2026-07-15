using System.ComponentModel.DataAnnotations;

namespace Attendance.Application.Dtos.UserSignatures
{
    public class UpsertUserSignatureDto
    {
        [Required(ErrorMessage = "Ảnh chữ ký không được để trống")]
        public byte[] SignatureImage { get; set; } = null!;
    }
}
