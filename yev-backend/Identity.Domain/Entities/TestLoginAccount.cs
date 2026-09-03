using System;

namespace Identity.Domain.Entities;

// Tài khoản đăng nhập TEST (2026-08-28, theo yêu cầu người dùng) — dùng để test nhanh các luồng cần
// nhiều vai trò (VD Cây duyệt Chuyền) khi nhân viên thật chưa có tài khoản AD. UserName BẮT BUỘC bắt
// đầu bằng "TEST\" để không bao giờ trùng với UserName AD thật (luôn dạng "YEV\..."), và để
// AuthController.Login() nhận diện được cần xác thực bằng PasswordHash ở đây thay vì gọi AD. CHỈ hoạt
// động khi ASPNETCORE_ENVIRONMENT=Development — xem AuthController.Login().
public class TestLoginAccount
{
    public int Id { get; set; }

    public string UserName { get; set; } = null!;

    public string FullName { get; set; } = null!;

    public string PasswordHash { get; set; } = null!;

    public bool IsDeleted { get; set; }

    public DateTime CreatedAt { get; set; }
}
