# architecture-core.md — Lõi hệ thống (Shared layer)

> Tài liệu hoá **những gì ĐÃ CÓ** ở tầng dùng chung. Đây là hợp đồng (contract)
> mà mọi module phải tuân theo. Khi code module mới, đây là các lớp bạn kế thừa
> và tái sử dụng — **không viết lại**.

Cây phụ thuộc (dependency direction), mũi tên = "phụ thuộc vào":

```
{Module}.Api ──► {Module}.Application ──► {Module}.Domain
      │                    │
      │                    ├──► Shared.Application ──► Shared.Core
      ▼                    ▼
CompanySystem.HostApi   Shared.Application
      ▲
      └── {Module}.Infrastructure ──► {Module}.Application, {Module}.Domain, Shared.Infrastructure
                                                                                    │
                                                              Shared.Infrastructure ─┴─► Shared.Application, Shared.Core
```

Quy tắc vàng: **Domain không phụ thuộc gì. Application không biết Infrastructure.
Host là nơi duy nhất ráp mọi thứ lại.**

---

## 1. Repository Pattern — `IGenericRepository<T>` / `GenericRepository<T, TDbContext>`

- **Interface:** `Shared.Application/Abstraction/IGenericRepository.cs`
  (namespace `Shared.Application.Abstractions`).
- **Cài đặt:** `Shared.Infrastructure/Repositories/GenericRepository.cs`.

Generic theo cả entity `T` và `TDbContext` (vì mỗi module có DbContext riêng):

```csharp
public class GenericRepository<T, TDbContext> : IGenericRepository<T>
    where T : class
    where TDbContext : DbContext
```

**Các API sẵn có** (dùng lại, đừng viết query thô nếu đã có helper):

| Method | Công dụng |
|---|---|
| `GetByIdAsync(object id)` | Tìm theo khoá chính (dùng `FindAsync`). |
| `GetAllAsync()` | Lấy tất cả (không filter). |
| `AddAsync` / `AddRangeAsync` | Thêm 1 / nhiều entity (chưa Save). |
| `Update` / `Delete` / `RemoveRange` | Đánh dấu sửa/xoá (chưa Save). |
| `FirstOrDefaultAsync(predicate, ...includes)` | Lấy 1 bản ghi kèm `Include` navigation. |
| `FindAsync(predicate)` | List theo điều kiện (tracking). |
| `FindWithIncludesAsync(predicate, ...includes)` | List + Include; `predicate = null` → lấy tất cả. |
| `SelectAsync(predicate, selector)` | Projection sang DTO, **AsNoTracking** (đọc nhanh). |
| `GetQueryable(isTracking, ...includes)` | Trả `IQueryable<T>` để Service tự build filter động. |
| `GetPagedAsync(query, pageIndex, pageSize)` | Cắt trang thô. |
| `ToPagedResponseAsync(query, pageIndex, pageSize, selector)` | **Cách phân trang chuẩn** → trả thẳng `PagedResponse<TResult>`. |

**Quy ước quan trọng:**
- Repository con **chỉ thêm** method đặc thù không generic hoá được (ví dụ
  `UserRepository.GetUserWithRolesAsync`). Nếu không cần gì thêm, class con để rỗng:
  ```csharp
  public class BranchRepository : GenericRepository<Branch, AssetDbContext>, IBranchRepository
  {
      public BranchRepository(AssetDbContext dbContext) : base(dbContext) { }
  }
  ```
- **Phân trang luôn dùng `ToPagedResponseAsync`** với `IQueryable` đã filter +
  `OrderBy`, kèm `selector` projection sang DTO. Nó tự đếm `TotalCount` và tính `TotalPages`.
- **Lọc soft-delete là thủ công**: `GetQueryable(false).Where(x => !x.IsDeleted)`.
  Không có global query filter — quên `.Where` là lộ bản ghi đã xoá.

---

## 2. Unit of Work — `IUnitOfWork` / `BaseUnitOfWork<TDbContext>`

- **Interface:** `Shared.Application/Abstraction/IUnitOfWork.cs`.
- **Cài đặt:** `Shared.Infrastructure/Repositories/BaseUnitOfWork.cs`
  (namespace `Shared.Infrastructure.Data`).

```csharp
public interface IUnitOfWork : IDisposable
{
    Task<int> SaveChangesAsync(CancellationToken ct = default);
    Task BeginTransactionAsync(CancellationToken ct = default);
    Task CommitTransactionAsync(CancellationToken ct = default);   // tự SaveChanges + Commit + Dispose transaction
    Task RollbackTransactionAsync(CancellationToken ct = default);
}
```

`BaseUnitOfWork<TDbContext>` quản lý 1 `IDbContextTransaction` nội bộ:
`Begin` (idempotent — gọi 2 lần không tạo transaction mới), `Commit` (Save rồi
Commit, luôn Dispose transaction trong `finally`), `Rollback` tương tự.

**Mỗi module mở rộng UoW này** để gom toàn bộ repository của module thành các
property, đó là "cửa ngõ" duy nhất Service chạm vào dữ liệu:

```csharp
// Application: hợp đồng
public interface IAssetUnitOfWork : IUnitOfWork
{
    IDeviceRepository Devices { get; }
    IBranchRepository Branches { get; }
    // ... mọi repo khác
}

// Infrastructure: cài đặt — repos được DI bơm vào qua constructor
public class AssetUnitOfWork : BaseUnitOfWork<AssetDbContext>, IAssetUnitOfWork
{
    public AssetUnitOfWork(AssetDbContext db, IDeviceRepository devices, IBranchRepository branches, ...)
        : base(db)
    { Devices = devices; Branches = branches; ... }

    public IDeviceRepository Devices { get; }
    public IBranchRepository Branches { get; }
}
```

> Vì `AssetDbContext` và tất cả repository đều Scoped, chúng **chia sẻ cùng một
> DbContext instance** trong 1 request → thay đổi từ nhiều repo được lưu chung
> bởi 1 `SaveChangesAsync`.

---

## 3. Service base — `BaseService<TUnitOfWork>`

- **File:** `Shared.Application/Abstraction/BaseService.cs` (namespace `Shared.Application.Services`).

```csharp
public abstract class BaseService<TUnitOfWork> where TUnitOfWork : IUnitOfWork
{
    protected readonly TUnitOfWork _unitOfWork;
    protected BaseService(TUnitOfWork unitOfWork) => _unitOfWork = unitOfWork;
}
```

Mọi Service kế thừa và truyền `I{Module}UnitOfWork` vào:

```csharp
public class BranchService : BaseService<IAssetUnitOfWork>, IBranchService
{
    public BranchService(IAssetUnitOfWork unitOfWork) : base(unitOfWork) { }
    // Truy cập: _unitOfWork.Branches.<repo methods>, _unitOfWork.SaveChangesAsync()
}
```

**Luồng chuẩn của một Service method** (tham chiếu `BranchService`):
1. Lấy `IQueryable` / entity qua `_unitOfWork.{Repo}`.
2. Kiểm tra nghiệp vụ, ném `DomainException`/`NotFoundException` nếu vi phạm.
3. `AddAsync`/`Update`/`Delete` qua repo.
4. `await _unitOfWork.SaveChangesAsync();`
5. Map sang DTO (thủ công) và return.

---

## 4. Response Wrappers

- **`ApiResponse<T>`** — `Shared.Application/Wrapper/ApiResponse.cs`:
  ```jsonc
  {
    "isSuccess": true,
    "message": "Action Success",
    "data": { ... },
    "errors": null,
    "timestamp": "2026-07-07T06:25:42Z"
  }
  ```
  Factory: `ApiResponse<T>.Success(data, msg)`, `ApiResponse<T>.Failure(msg, errors)`.
- **`PagedResponse<T>`** — `Shared.Application/Wrapper/PagedResponse.cs`:
  chứa `Data`, `PageIndex`, `PageSize`, `TotalCount`, `TotalPages`, và cờ tính
  sẵn `HasNextPage`/`HasPreviousPage`. Được tạo bởi `ToPagedResponseAsync`.

`PageIndex` bắt đầu từ **1** (không phải 0).

---

## 5. BaseController (per-module)

Mỗi module Api có `BaseController` riêng (ví dụ `Asset.Api/Controllers/BaseController.cs`,
`Identity.Api/Controllers/BaseController.cs`) — **cùng khuôn**:

```csharp
[ApiController]
[Route("api/[controller]")]
public class BaseController : ControllerBase
{
    protected ActionResult<ApiResponse<T>> Success<T>(T data, string message = "Success");   // 200
    protected ActionResult<ApiResponse<T>> Fail<T>(string message);                          // 400
    protected IActionResult CreatedSuccess<T>(string actionName, object routeValues, T data, string message); // 201
    protected IActionResult NoContentSuccess();                                              // 204
}
```

Controller nghiệp vụ kế thừa `BaseController`, inject Service (interface), gọi
Service rồi bọc `Success(...)`. Route action đặt qua `[HttpGet("grid-list")]`,
`[HttpPost]`, `[HttpPut("{id}")]`, `[HttpDelete("{id}")]`... Tên controller quyết
định URL (`BranchController` → `/api/Branch`).

> **Auth hiện trạng:** Host bật `FallbackPolicy = DefaultPolicy` → mặc định MỌI
> endpoint yêu cầu đăng nhập. Các controller Asset hiện gắn `[AllowAnonymous]` ở
> cấp class để mở tạm. Controller Identity `Auth` thì siết bằng `[Authorize(Roles="Admin")]`.

---

## 6. Exception Handling

Phân cấp exception ở `Shared.Core/Exceptions/`:

```
BaseException (abstract): có StatusCode + List<string>? Errors
├── DomainException(message)          → StatusCode 400 (lỗi nghiệp vụ)
└── NotFoundException(entityName, key) → StatusCode 404, message "{entity} with ID ({key}) not exist."
```

`GuardExtensions` (dùng cho pattern "lấy rồi kiểm null"):

```csharp
branch.OrThrowNotFound("Chi nhánh", id);   // ném NotFoundException nếu null
value.OrThrow("Thông báo lỗi");            // ném DomainException nếu null
```

**Middleware toàn cục** `CompanySystem.HostApi/Middlewares/HandleExceptionMiddleware.cs`
bắt mọi exception → map sang `ApiResponse.Failure` + HTTP status đúng:
- `BaseException` → dùng `StatusCode` + `Errors` của nó.
- `ValidationException` → 400. `UnauthorizedAccessException` → 401.
  `KeyNotFoundException` → 404. `ArgumentException`/`InvalidOperationException` → 400.
  `DbUpdateException` → 500 "database error". Còn lại → 500.

→ **Trong Service, cứ ném exception** (`DomainException`/`NotFoundException`),
đừng tự dựng `ApiResponse.Failure`. Middleware lo phần còn lại.
(Lưu ý: một số code cũ trong `AuthController`/`UserService` vẫn `try/catch` +
`Fail<>()` thủ công — đó là legacy, code mới nên theo hướng ném exception.)

---

## 7. Đăng ký Dependency Injection — cơ chế THẬT (Scrutor)

> ⚠️ Điểm dễ hiểu nhầm: mỗi Infrastructure có sẵn hàm `AddAssetModule` /
> `AddIdentityModule`, **nhưng host KHÔNG gọi chúng**. Nguồn sự thật là
> `CompanySystem.HostApi/Configurations/DependencyInjection.cs` → `AddDIConfig`.

`AddDIConfig` làm 3 việc:

1. **Đăng ký DbContext** của từng module (đọc connection string):
   ```csharp
   services.AddDbContext<IdentityDbContext>(o => o.UseSqlServer(identityConn));
   services.AddDbContext<AssetDbContext>(o => o.UseSqlServer(pcManagementConn));
   ```
2. **Auto-register bằng Scrutor** theo quy ước tên — quét mọi assembly
   `Identity*`, `Attendance*`, `Asset*`, `Shared*`, lấy class có tên kết thúc
   bằng `Repository` | `UnitOfWork` | `Service`, đăng ký `AsImplementedInterfaces`
   + `WithScopedLifetime`:
   ```csharp
   services.Scan(scan => scan
     .FromApplicationDependencies(a =>
         a.FullName.StartsWith("Identity") || a.FullName.StartsWith("Attendance") ||
         a.FullName.StartsWith("Asset")    || a.FullName.StartsWith("Shared"))
     .AddClasses(c => c.Where(t =>
         t.Name.EndsWith("Repository") || t.Name.EndsWith("UnitOfWork") || t.Name.EndsWith("Service")))
     .AsImplementedInterfaces()
     .WithScopedLifetime());
   ```
3. `AddHttpContextAccessor()` + đăng ký `IClaimsTransformation` (Identity).

**Hệ quả cho code mới:** chỉ cần đặt đúng tên (`FooService : IFooService`,
`FooRepository : IFooRepository`) là tự động được DI — **không phải sửa
`AddDIConfig`**. Trừ khi: cần lifetime khác Scoped, hoặc tên không theo quy ước,
hoặc cần đăng ký một service không có interface tương ứng.

**Controllers**: `Program.cs` nạp controller của các module Api qua
`AddApplicationPart(typeof(Xxx.Api.AssemblyReference).Assembly)`. Khi thêm module
Api mới có controller, phải thêm 1 dòng `AddApplicationPart` cho assembly đó
(đó là công dụng của class rỗng `AssemblyReference`).

---

## 8. Pipeline Host (Program.cs) — thứ tự middleware

```
HandleExceptionMiddleware          // bọc ngoài cùng để bắt mọi lỗi
→ (Development) MapOpenApi + MapScalarApiReference (AllowAnonymous)
→ UseHttpsRedirection
→ UseCors("AllowNextJs")           // origin localhost:3000, 10.45.1.181:3000, AllowCredentials
→ UseForwardedHeaders              // lấy đúng client IP/scheme sau proxy
→ UseAuthentication → UseAuthorization
→ MapControllers
```

Chi tiết cấu hình Auth (JWT + Negotiate) xem [identity-module.md](identity-module.md).

---

## 9. Quy ước & "bẫy" cần nhớ

- **Namespace:** Domain mới dùng file-scoped (`namespace X;`); Application/
  Infrastructure phần lớn block-scoped (`namespace X { }`). Giữ theo file lân cận.
- **Entity là `partial class`** (do scaffold từ DB) — có thể mở rộng bằng file partial khác.
- **`TimeHelper.GetCurrentUtcTime()`** = `DateTime.UtcNow.AddHours(7)` (giờ VN).
  Lưu ý nhiều chỗ code lại dùng `DateTime.UtcNow` trực tiếp — không nhất quán, cân nhắc khi thêm mốc thời gian.
- **Mapping thủ công** khắp nơi; giữ nguyên phong cách, đừng thêm AutoMapper.
- **EF Fluent config ánh xạ tên Anh → tên bảng/cột tiếng Việt** (DB legacy), ví dụ
  `Branch` → bảng có PK `PK_ChiNhanhs`, cột `MaChiNhanh`. Khi thêm entity mới vào
  DbContext đã có, tuân theo cách đặt tên constraint/index đang dùng.
