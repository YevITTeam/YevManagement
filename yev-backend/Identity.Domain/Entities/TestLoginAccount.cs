using System;

namespace Identity.Domain.Entities;

// Development-only login; the "TEST\" UserName prefix can never collide with real AD names ("YEV\...").
public class TestLoginAccount
{
    public int Id { get; set; }

    public string UserName { get; set; } = null!;

    public string FullName { get; set; } = null!;

    public string PasswordHash { get; set; } = null!;

    public bool IsDeleted { get; set; }

    public DateTime CreatedAt { get; set; }
}
