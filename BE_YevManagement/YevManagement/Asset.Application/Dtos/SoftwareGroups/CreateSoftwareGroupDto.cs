using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Text;

namespace Asset.Application.Dtos.SoftwareGroups
{
    public class CreateSoftwareGroupDto
    {
        [Required(ErrorMessage = "Mã nhóm phần mềm không được để trống")]
        public string GroupCode { get; set; } = null!;

        [Required(ErrorMessage = "Tên nhóm phần mềm không được để trống")]
        public string GroupName { get; set; } = null!;
    }
}
