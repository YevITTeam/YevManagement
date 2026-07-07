# attendance-module.md — Module Attendance (Chấm công)

> ⚠️ **MODULE NÀY HIỆN TRỐNG.** Chỉ mới có cấu trúc 4 project rỗng
> (`Attendance.Api`, `Attendance.Application`, `Attendance.Domain`,
> `Attendance.Infrastructure`) — **chưa có dòng code nghiệp vụ nào** (không
> Entity, không DbContext, không Service/Controller, không Migration).
>
> Khi implement, **BẮT BUỘC** kế thừa `GenericRepository` / `BaseUnitOfWork` /
> `BaseService` / `BaseController` và bọc `ApiResponse`/`PagedResponse` từ tầng
> Shared — tuân thủ [architecture-core.md](architecture-core.md) 100%.

---

## 0. QUY TẮC SỐ 1 — Chốt yêu cầu trước khi code (xem CLAUDE.md §4.2)

Vì module chưa define, **không được tự bịa nghiệp vụ**. Trước khi viết bất kỳ
dòng code nào, phải hỏi người dùng và điền đủ 2 mục Placeholder bên dưới:

### 3.1 (Placeholder) Danh sách Entity
> _Chờ người dùng cung cấp._ Với mỗi entity cần biết: tên, thuộc tính + kiểu,
> quan hệ với entity khác, có `IsDeleted` (soft delete) không, ràng buộc unique/index.

Ví dụ khung có thể có (CHƯA XÁC NHẬN — chỉ minh hoạ, xoá khi có yêu cầu thật):
- `Employee` (mã NV, họ tên, phòng ban, ...)
- `AttendanceRecord` (nhân viên, ngày, giờ vào/ra, trạng thái, ...)
- `Shift` / `LeaveRequest` / `Holiday` ...

### 3.2 (Placeholder) Business Logic
> _Chờ người dùng cung cấp._ Cần biết: các use-case/API, luật validate, luật tính
> công/đi trễ/tăng ca, phân trang/lọc, phân quyền (role nào được gọi).

### 3.3 (Placeholder) Database
- Tên DB & connection string: _(chờ cung cấp — ví dụ `AttendanceManagement` →
  key `AttendanceManagementConnection` trong `appsettings.json`)._
- DbContext dự kiến: `AttendanceDbContext`.

---

## 1. Cấu trúc & Dependencies hiện có (đã dựng sẵn, đúng chuẩn)

4 project đã tồn tại với reference đúng như các module khác:

```
Attendance.Domain          → (rỗng) không phụ thuộc
Attendance.Application      → ref Attendance.Domain, Shared.Application, Shared.Core
Attendance.Infrastructure   → ref Attendance.Application, Attendance.Domain, Shared.Infrastructure
Attendance.Api             → ref Attendance.Infrastructure, FrameworkReference Microsoft.AspNetCore.App
```

> Lưu ý khác biệt nhỏ: `Attendance.Api.csproj` hiện chỉ ref `Attendance.Infrastructure`
> (các Api module khác ref thẳng `Application`). Khi thêm controller cần dùng DTO/
> interface ở Application, thêm `ProjectReference` tới `Attendance.Application` cho gọn.
>
> `Attendance.Infrastructure` **chưa có** package EF Core. Khi tạo DbContext, thêm:
> `Microsoft.EntityFrameworkCore(.SqlServer/.Design/.Tools)` 10.0.9 (copy từ
> `Shared.Infrastructure.csproj` hoặc `Asset.Infrastructure.csproj`).

---

## 2. Template scaffolding (điền tên thật sau khi chốt §0)

Ký hiệu: `{Entity}` = tên thực thể (vd `AttendanceRecord`), `{Feature}` = nhóm nghiệp vụ.

### 2.1 Domain — `Attendance.Domain/Entities/{Entity}.cs`
```csharp
namespace Attendance.Domain.Entities;

public class {Entity}
{
    public int Id { get; set; }
    // ... thuộc tính theo §3.1
    public bool IsDeleted { get; set; }   // nếu cần soft-delete
    // navigation props nếu có quan hệ
}
```

### 2.2 DbContext — `Attendance.Infrastructure/Context/AttendanceDbContext.cs`
```csharp
using Attendance.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Attendance.Infrastructure.Context;

public partial class AttendanceDbContext : DbContext
{
    public AttendanceDbContext() { }
    public AttendanceDbContext(DbContextOptions<AttendanceDbContext> options) : base(options) { }

    public virtual DbSet<{Entity}> {Entity}s { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<{Entity}>(entity =>
        {
            entity.HasKey(e => e.Id);
            // entity.Property(e => e.Xxx).HasMaxLength(...);
            // entity.HasIndex(e => e.Code).IsUnique();
        });
        OnModelCreatingPartial(modelBuilder);
    }
    partial void OnModelCreatingPartial(ModelBuilder modelBuilder);
}
```

### 2.3 Repository (Application interface + Infrastructure impl)
```csharp
// Attendance.Application/Interfaces/Repository/I{Entity}Repository.cs
using Attendance.Domain.Entities;
using Shared.Application.Abstractions;
namespace Attendance.Application.Interfaces.Repository;
public interface I{Entity}Repository : IGenericRepository<{Entity}> { }

// Attendance.Infrastructure/Repositories/{Entity}Repository.cs
using Attendance.Application.Interfaces.Repository;
using Attendance.Domain.Entities;
using Attendance.Infrastructure.Context;
using Shared.Infrastructure.Repositories;
namespace Attendance.Infrastructure.Repositories;
public class {Entity}Repository : GenericRepository<{Entity}, AttendanceDbContext>, I{Entity}Repository
{
    public {Entity}Repository(AttendanceDbContext dbContext) : base(dbContext) { }
}
```

### 2.4 Unit of Work
```csharp
// Attendance.Application/Interfaces/Service/IAttendanceUnitOfWork.cs
using Attendance.Application.Interfaces.Repository;
using Shared.Application.Abstractions;
namespace Attendance.Application.Interfaces.Service;
public interface IAttendanceUnitOfWork : IUnitOfWork
{
    I{Entity}Repository {Entity}s { get; }
    // ... thêm mỗi repo 1 property
}

// Attendance.Infrastructure/Repositories/AttendanceUnitOfWork.cs
using Attendance.Application.Interfaces.Repository;
using Attendance.Application.Interfaces.Service;
using Attendance.Infrastructure.Context;
using Shared.Infrastructure.Data;
namespace Attendance.Infrastructure.Repositories;
public class AttendanceUnitOfWork : BaseUnitOfWork<AttendanceDbContext>, IAttendanceUnitOfWork
{
    public AttendanceUnitOfWork(AttendanceDbContext db, I{Entity}Repository {entity}s) : base(db)
    {
        {Entity}s = {entity}s;
    }
    public I{Entity}Repository {Entity}s { get; }
}
```

### 2.5 DTOs — `Attendance.Application/Dtos/{Entity}s/`
`{Entity}Dto`, `Create{Entity}Dto` (+ `[Required(ErrorMessage="... tiếng Việt")]`), `Update{Entity}Dto`.

### 2.6 Service (mẫu CRUD chuẩn — nhân theo `Asset.Application/Services/BranchService.cs`)
```csharp
using Attendance.Application.Interfaces.Service;
using Shared.Application.Services;
using Shared.Application.Wrapper;
using Shared.Core.Exceptions;
namespace Attendance.Application.Services;

public class {Feature}Service : BaseService<IAttendanceUnitOfWork>, I{Feature}Service
{
    public {Feature}Service(IAttendanceUnitOfWork unitOfWork) : base(unitOfWork) { }

    public async Task<PagedResponse<{Entity}Dto>> GetPagedAsync(int pageIndex, int pageSize, string? keyword)
    {
        var query = _unitOfWork.{Entity}s.GetQueryable(false).Where(x => !x.IsDeleted);
        // if (!string.IsNullOrWhiteSpace(keyword)) query = query.Where(...);
        return await _unitOfWork.{Entity}s.ToPagedResponseAsync(
            query.OrderBy(x => x.Id), pageIndex, pageSize,
            x => new {Entity}Dto { /* map */ });
    }

    public async Task<{Entity}Dto> CreateAsync(Create{Entity}Dto request)
    {
        // check trùng → throw new DomainException("...");
        var entity = new Domain.Entities.{Entity} { /* map */ };
        await _unitOfWork.{Entity}s.AddAsync(entity);
        await _unitOfWork.SaveChangesAsync();
        return new {Entity}Dto { /* map */ };
    }

    public async Task UpdateAsync(Update{Entity}Dto request)
    {
        var entity = await _unitOfWork.{Entity}s.GetByIdAsync(request.Id);
        entity.OrThrowNotFound("{Entity}", request.Id);
        // map, Update, Save
        _unitOfWork.{Entity}s.Update(entity);
        await _unitOfWork.SaveChangesAsync();
    }

    public async Task DeleteAsync(int id)   // soft delete
    {
        var entity = await _unitOfWork.{Entity}s.GetByIdAsync(id);
        entity.OrThrowNotFound("{Entity}", id);
        entity.IsDeleted = true;
        _unitOfWork.{Entity}s.Update(entity);
        await _unitOfWork.SaveChangesAsync();
    }
}
```

### 2.7 BaseController + Controller (Api)
```csharp
// Attendance.Api/Controllers/BaseController.cs — COPY từ Asset.Api/Controllers/BaseController.cs,
// đổi namespace thành Attendance.Api.Controllers (giữ nguyên helper Success/Fail/CreatedSuccess/NoContentSuccess).

// Attendance.Api/Controllers/{Feature}Controller.cs
using Attendance.Application.Interfaces.Service;
using Microsoft.AspNetCore.Mvc;
using Shared.Application.Wrapper;
namespace Attendance.Api.Controllers;

public class {Feature}Controller : BaseController
{
    private readonly I{Feature}Service _service;
    public {Feature}Controller(I{Feature}Service service) => _service = service;

    [HttpGet("grid-list")]
    public async Task<ActionResult<ApiResponse<PagedResponse<{Entity}Dto>>>> GetPaged(
        [FromQuery] int pageIndex = 1, [FromQuery] int pageSize = 50, [FromQuery] string? keyword = null)
        => Success(await _service.GetPagedAsync(pageIndex, pageSize, keyword));

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] Create{Entity}Dto request)
    {
        var result = await _service.CreateAsync(request);
        return CreatedSuccess(nameof(GetById), new { id = result.Id }, result, "Thêm thành công.");
    }
    // GetById, Update (PUT {id}), Delete (DELETE {id}) — theo BranchController
}
```

### 2.8 `AttendanceAssemblyReference.cs` (để host nạp controller)
```csharp
namespace Attendance.Api;
public static class AssemblyReference { }
```

---

## 4. Wiring vào Host (BẮT BUỘC — nếu quên, API không xuất hiện)

Sau khi có code, phải sửa **`CompanySystem.HostApi`** — đây là 2 điểm móc nối
duy nhất (Scrutor đã tự lo phần Service/Repository/UnitOfWork vì tên đúng quy ước):

1. **Nạp controller** — `Program.cs`, thêm vào chuỗi `AddControllers()`:
   ```csharp
   .AddApplicationPart(typeof(Attendance.Api.AssemblyReference).Assembly)
   ```
   (Host đã ref sẵn `Attendance.Api`/`Attendance.Infrastructure`, không cần thêm ProjectReference.)

2. **Đăng ký DbContext** — `CompanySystem.HostApi/Configurations/DependencyInjection.cs`,
   trong `AddDIConfig`:
   ```csharp
   var attendanceConn = configuration.GetConnectionString("AttendanceManagementConnection");
   services.AddDbContext<AttendanceDbContext>(o => o.UseSqlServer(attendanceConn));
   ```
   Scrutor `services.Scan(...)` đã bao gồm assembly `Attendance*` → repo/UoW/service
   tự được đăng ký Scoped, **không cần thêm gì khác**.

3. **Connection string** — thêm vào `appsettings.json` mục `ConnectionStrings`.

4. **Migration đầu tiên**:
   ```bash
   dotnet ef migrations add InitAttendance --project Attendance.Infrastructure --startup-project CompanySystem.HostApi
   dotnet ef database update --project Attendance.Infrastructure --startup-project CompanySystem.HostApi
   ```

---

## 5. Definition of Done cho module này
- [ ] Đã chốt §3.1 Entity + §3.2 Business Logic với người dùng.
- [ ] Domain + DbContext + Fluent config.
- [ ] Repository + UnitOfWork (interface ở Application, impl ở Infrastructure).
- [ ] DTOs + DataAnnotations.
- [ ] Service kế thừa `BaseService<IAttendanceUnitOfWork>`.
- [ ] Controller kế thừa `BaseController`, bọc `ApiResponse`.
- [ ] Wiring host (§4): AddApplicationPart + AddDbContext + connection string.
- [ ] Migration + build `dotnet build YevManagement.slnx` sạch lỗi.
- [ ] **Cập nhật lại file doc này** (điền §3.1/§3.2, danh sách endpoint, đổi trạng
      thái đầu file từ "TRỐNG" sang "ĐÃ CÓ CODE").
