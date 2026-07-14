namespace Asset.Domain.Enums;

// Trạng thái gán của 1 IpAddress (2026-07-11, đổi lại — bỏ Reserved/Disabled cũ, gộp về
// 3 trạng thái theo quyết định người dùng). Bất biến giữ được: Status == Assigned(2) ⟺
// DeviceId != null; Status == Available(0)/AssignedExternal(1) ⟺ DeviceId == null.
public enum IpAddressStatus
{
    // Chưa gán — IP còn trống, được phép chọn để gán cho thiết bị.
    Available = 0,

    // Đã gán nhưng KHÔNG có DeviceId trong hệ thống — IP đang được 1 thiết bị "ngoài"
    // (không quản lý trong app) sử dụng; khi hiển thị, DeviceCode trả về "Khác".
    AssignedExternal = 1,

    // Đã gán và CÓ DeviceId — IP đang gắn cho 1 thiết bị được quản lý trong hệ thống.
    Assigned = 2
}
