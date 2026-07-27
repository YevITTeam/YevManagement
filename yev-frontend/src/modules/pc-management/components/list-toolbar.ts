// Cho phép trang wrapper có tab (Quản lý IP, Quản lý phần mềm) đặt nút
// "Làm mới" / "Thêm mới" cùng hàng với tiêu đề, nhưng vẫn điều khiển được
// danh sách của tab đang mở.
export interface ListHandle {
    refresh: () => void;
    openCreate: () => void;
}

export interface ListToolbarProps {
    onLoadingChange?: (loading: boolean) => void;
}
