using System;
using System.Collections.Generic;
using System.Text;

namespace Asset.Application.Dtos.DeviceConfigurations
{
    public class DeviceConfigurationHistoryDto
    {
        public int Id { get; set; }
        public int DeviceConfigurationId { get; set; }
        public string? Mainboard { get; set; }
        public string? Cpu { get; set; }
        public string? Ram { get; set; }
        public string? HardDrive { get; set; }
        public string? Monitor { get; set; }
        public string? Mouse { get; set; }
        public string? Keyboard { get; set; }
        public string? Headphone { get; set; }
        public string? Speaker { get; set; }
        public string? Ups { get; set; }
        public string? Psu { get; set; }
        public string? Os { get; set; }
        public string? Vga { get; set; }
        public string? Maker { get; set; }
        public string? Model { get; set; }
        public string? PowerAdapter { get; set; }
        public string? WirelessCard { get; set; }
        public string? Nic { get; set; }
        public string? Other { get; set; }
        public string? Note { get; set; }
        public DateTime EditedAt { get; set; }
        public string EditedBy { get; set; } = null!;
    }
}
