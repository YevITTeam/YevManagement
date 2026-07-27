using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Text;

namespace Asset.Application.Dtos.Branches
{
    public class CreateBranchDto
    {
        [Required(ErrorMessage = "Mã chi nhánh không được để trống")]
        public string BranchCode { get; set; } = null!;

        [Required(ErrorMessage = "Tên chi nhánh không được để trống")]
        public string BranchName { get; set; } = null!;
    }
}
