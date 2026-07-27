// Cho phép trang wrapper có tab (Quản lý danh mục Attendance) đặt nút
// "Làm mới" / "Thêm mới" cùng hàng với tiêu đề, nhưng vẫn điều khiển được
// danh sách của tab đang mở. Mirror src/modules/pc-management/components/list-toolbar.ts.
export interface ListHandle {
    refresh: () => void;
    openCreate: () => void;
}

export interface ListToolbarProps {
    onLoadingChange?: (loading: boolean) => void;
}
