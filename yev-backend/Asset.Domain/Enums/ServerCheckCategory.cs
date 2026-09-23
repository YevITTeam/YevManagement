namespace Asset.Domain.Enums;

// Groups a DeviceType into one of the 4 daily-check categories printed as separate columns on the
// paper form ("YEV–22–CV–IT-QD-810-FR-Check Sheet KT"). Only DeviceTypes the user marks with a
// non-null category are pulled into a ServerCheckSession when it starts (see DeviceType.ServerCheckCategory).
public enum ServerCheckCategory
{
    Server = 0,
    Network = 1,
    Ups = 2,
    AirConditioner = 3
}
