using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Text;

namespace Asset.Application.Dtos.Suplliers
{
    public class CreateSupplierDto
    {
        [Required(ErrorMessage = "Mã nhà cung cấp không được để trống")]
        public string SupplierCode { get; set; } = null!;

        [Required(ErrorMessage = "Tên nhà cung cấp không được để trống")]
        public string SupplierName { get; set; } = null!;
    }
}
