using System;

namespace Attendance.Domain.Entities;

// One per form; a new upload replaces the previous file. Kept out of OtForm so list queries never load the file.
public partial class OtFormPaperScan
{
    public int Id { get; set; }

    public int OtFormId { get; set; }

    public string FileName { get; set; } = null!;

    public string ContentType { get; set; } = null!;

    public byte[] FileContent { get; set; } = null!;

    public string UploadedByUserName { get; set; } = null!;

    public string? UploadedByFullName { get; set; }

    public DateTime UploadedAt { get; set; }

    // Stores the Attendance.Domain.Enums.OtFormPaperScanStatus enum as an int.
    public int Status { get; set; }

    public string? ReviewedByUserName { get; set; }

    public string? ReviewedByFullName { get; set; }

    public DateTime? ReviewedAt { get; set; }

    public string? ReviewComment { get; set; }

    public virtual OtForm OtForm { get; set; } = null!;
}
