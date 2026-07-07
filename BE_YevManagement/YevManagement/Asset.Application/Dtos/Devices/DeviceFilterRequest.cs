using System;
using System.Collections.Generic;
using System.Text;

namespace Asset.Application.Dtos.Devices
{
    public class DeviceFilterRequest
    {
        public int PageIndex { get; set; } = 1;
        public int PageSize { get; set; } = 50;

        public string? DeviceCode { get; set; } 
        public string? Manager { get; set; }   
        public string? PurchaseDate { get; set; }
        public string? IpAddress { get; set; }  
        public string? SupplierName { get; set; } 
        public string? Note { get; set; }  
    }
}
