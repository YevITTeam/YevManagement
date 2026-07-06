using System;
using System.Collections.Generic;

namespace Asset.Domain;

public partial class CauHinhThietBi
{
    public int Id { get; set; }

    public int ThietBiId { get; set; }

    public string? Mainboard { get; set; }

    public string? Cpu { get; set; }

    public string? Ram { get; set; }

    public string? Ocung { get; set; }

    public string? Monitor { get; set; }

    public string? Mouse { get; set; }

    public string? Keyboard { get; set; }

    public string? Headphone { get; set; }

    public string? Speaker { get; set; }

    public string? Ups { get; set; }

    public string? Psu { get; set; }

    public string? Os { get; set; }

    public string? Vga { get; set; }

    public string? GhiChu { get; set; }

    public virtual ThietBi ThietBi { get; set; } = null!;
}
