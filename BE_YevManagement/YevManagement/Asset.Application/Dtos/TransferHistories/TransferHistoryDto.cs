namespace Asset.Application.Dtos.TransferHistories
{
    public class TransferHistoryDto
    {
        public int Id { get; set; }
        public int OldDeviceId { get; set; }
        public string OldDeviceCode { get; set; } = null!;
        public string OldDeviceName { get; set; } = null!;
        public int NewDeviceId { get; set; }
        public string NewDeviceCode { get; set; } = null!;
        public string NewDeviceName { get; set; } = null!;
        public DateTime TransferDate { get; set; }
        public string? Note { get; set; }
    }
}
