// All optional strings on BE, so any may be null.
export interface DeviceComponentFields {
    mainboard: string | null;
    cpu: string | null;
    ram: string | null;
    hardDrive: string | null;
    monitor: string | null;
    mouse: string | null;
    keyboard: string | null;
    headphone: string | null;
    speaker: string | null;
    ups: string | null;
    psu: string | null;
    os: string | null;
    vga: string | null;
    maker: string | null;
    model: string | null;
    powerAdapter: string | null;
    wirelessCard: string | null;
    nic: string | null;
}

// The response itself may be null when the device has no configuration yet.
export interface DeviceConfigurationDto extends DeviceComponentFields {
    id: number;
    deviceId: number;
    deviceCode: string;
    other: string | null;
    note: string | null;
}

// deviceId is required and immutable on update (a different value returns 400).
export interface CreateUpdateDeviceConfigurationDto extends Partial<DeviceComponentFields> {
    id?: number;              // PUT only; must match {id} in the URL
    deviceId: number;
    other?: string | null;
    note?: string | null;
}

// Immutable snapshot taken at creation.
export interface DeviceConfigurationInitialDto extends DeviceComponentFields {
    id: number;
    deviceConfigurationId: number;
    other: string | null;
    note: string | null;
}

// Component values at the time of each repair plus who/when.
export interface DeviceConfigurationHistoryDto extends DeviceComponentFields {
    id: number;
    editedAt: string;
    editedBy: string | null;
    other: string | null;
    note: string | null;
}
