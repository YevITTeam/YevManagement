namespace Asset.Application.Dtos.DeviceImports
{
    // 1 row skipped (not imported) at the Confirm step due to a validation error — different
    // from the old behavior (blocking the whole batch when any row had an error). Returned so
    // the FE can tell the user which row was not created and why (2026-07-11, changed per
    // user request).
    public class DeviceImportSkippedRowDto
    {
        public int RowNumber { get; set; }
        public string? DeviceCode { get; set; }
        public List<string> Errors { get; set; } = new();
    }
}
