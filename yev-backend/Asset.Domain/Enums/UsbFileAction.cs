namespace Asset.Domain.Enums;

public enum UsbFileAction
{
    Created = 1,
    Modified = 2,
    Deleted = 3,
    Renamed = 4,
    // USB -> PC copy guessed from size + last-write time; FilePath is the PC copy, OldFilePath the USB source.
    CopiedIn = 5
}
