using System;
using System.Collections.Generic;
using System.Text;

namespace Asset.Application.Dtos.Suplliers
{
    public class SupplierDto
    {
        public int Id { get; set; }
        public string SupplierCode { get; set; } = null!;
        public string SupplierName { get; set; } = null!;
    }
}
