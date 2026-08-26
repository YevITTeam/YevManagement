using System.ComponentModel.DataAnnotations;

namespace Workflow.Application.Dtos.EmployeeSignatures
{
    public class UpsertEmployeeSignatureDto
    {
        [Required(ErrorMessage = "Ảnh chữ ký không được để trống")]
        public byte[] SignatureImage { get; set; } = null!;
    }
}
