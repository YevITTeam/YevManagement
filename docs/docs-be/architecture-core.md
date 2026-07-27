# architecture-core.md — Lõi hệ thống (Shared layer)

> Hợp đồng tầng dùng chung. Code module mới **kế thừa** các lớp này, không viết lại.

**Dependency direction** (`A → B` = A phụ thuộc B):
```
{Module}.Api → {Module}.Application → {Module}.Domain
{Module}.Infrastructure → {Module}.Application + {Module}.Domain + Shared.Infrastructure
Shared.Infrastructure → Shared.Application → Shared.Core
CompanySystem.HostApi → tất cả (composition root)
```
Luật vàng: **Domain không phụ thuộc gì. Application không biết Infrastructure. Host ráp mọi thứ.**

---

## 1. Repository — `IGenericRepository<T>` / `GenericRepository<T, TDbContext>`
- Interface: `Shared.Application/Abstraction/` (ns `Shared.Application.Abstractions`). Impl: `Shared.Infrastructure/Repositories/`.
- Generic theo cả `T` và `TDbContext` (mỗi module 1 DbContext).

Method sẵn có (dùng lại, đừng viết query thô):
| Method | Công dụng |
|---|---|
| `GetByIdAsync(id)` | Tìm theo PK (`FindAsync`). |
| `GetAllAsync()` | Tất cả (không filter). |
| `AddAsync`/`AddRangeAsync`/`Update`/`Delete`/`RemoveRange` | Đánh dấu thay đổi (chưa Save). |
| `FirstOrDefaultAsync(pred, ...includes)` | 1 bản ghi + Include. |
| `FindAsync(pred)` / `FindWithIncludesAsync(pred, ...includes)` | List (pred=null → tất cả). |
| `SelectAsync(pred, selector)` | Projection DTO, **AsNoTracking**. |
| `GetQueryable(isTracking, ...includes)` | `IQueryable<T>` để build filter động. |
| `ToPagedResponseAsync(query, pageIndex, pageSize, selector)` | **Phân trang chuẩn** → `PagedResponse<TResult>` (tự đếm TotalCount/Pages). |
| `ToListAsync(query, selector)` | Materialize `IQueryable` đã compose (nhiều `.Where`/`OrderBy`) → `List<TResult>`, **không phân trang** (báo cáo). |

Quy ước:
- Repo con để **rỗng** nếu không cần method đặc thù: `class BranchRepository : GenericRepository<Branch, AssetDbContext>, IBranchRepository { public BranchRepository(AssetDbContext db) : base(db) {} }`.
- **Soft-delete lọc thủ công**: `GetQueryable(false).Where(x => !x.IsDeleted)` — KHÔNG có global filter.

## 2. Unit of Work — `IUnitOfWork` / `BaseUnitOfWork<TDbContext>`
- Interface: `Shared.Application/Abstraction/`. Impl: `Shared.Infrastructure/Repositories/` (ns `Shared.Infrastructure.Data`).
- `IUnitOfWork`: `SaveChangesAsync(ct)`, `BeginTransactionAsync`, `CommitTransactionAsync` (tự Save+Commit+Dispose), `RollbackTransactionAsync`. `Begin` idempotent.
- Mỗi module mở rộng UoW, phơi bày repo thành property (cửa ngõ duy nhất Service chạm DB):
```csharp
public interface IAssetUnitOfWork : IUnitOfWork { IDeviceRepository Devices { get; } /*...*/ }
public class AssetUnitOfWork : BaseUnitOfWork<AssetDbContext>, IAssetUnitOfWork {
    public AssetUnitOfWork(AssetDbContext db, IDeviceRepository devices, ...) : base(db) { Devices = devices; }
    public IDeviceRepository Devices { get; }
}
```
- DbContext + repo đều Scoped → chia sẻ 1 DbContext/request → 1 `SaveChangesAsync` lưu chung.

## 3. Service base — `BaseService<TUnitOfWork>`
`Shared.Application/Abstraction/BaseService.cs` (ns `Shared.Application.Services`): field `protected readonly TUnitOfWork _unitOfWork;`.
```csharp
public class BranchService : BaseService<IAssetUnitOfWork>, IBranchService {
    public BranchService(IAssetUnitOfWork uow) : base(uow) { }
}
```
Luồng chuẩn: lấy query/entity qua `_unitOfWork.{Repo}` → check nghiệp vụ (ném exception) → Add/Update/Delete → `await _unitOfWork.SaveChangesAsync()` → map DTO thủ công → return. **KHÔNG inject DbContext thẳng. SaveChanges gọi ở Service.**

## 4. Response Wrappers (`Shared.Application/Wrapper/`)
- `ApiResponse<T>`: `{ isSuccess, message, data, errors: string[]?, timestamp }`. Factory `.Success(data, msg)` / `.Failure(msg, errors)`.
- `PagedResponse<T>`: `Data, PageIndex, PageSize, TotalCount, TotalPages, HasNextPage, HasPreviousPage`. Tạo bởi `ToPagedResponseAsync`. **PageIndex bắt đầu từ 1.**

## 5. BaseController (per-module)
Mỗi module Api có `BaseController` riêng, cùng khuôn:
```csharp
[ApiController] [Route("api/[controller]")]
public class BaseController : ControllerBase {
    protected ActionResult<ApiResponse<T>> Success<T>(T data, string msg="Success");   // 200
    protected ActionResult<ApiResponse<T>> Fail<T>(string msg);                        // 400
    protected IActionResult CreatedSuccess<T>(string action, object route, T data, string msg); // 201
    protected IActionResult NoContentSuccess();                                        // 204
}
```
Controller nghiệp vụ kế thừa, inject Service (interface), bọc `Success(...)`. Tên controller → URL (`BranchController` → `/api/Branch`).

**Auth**: Host bật `FallbackPolicy = DefaultPolicy` → mọi endpoint yêu cầu đăng nhập. Toàn bộ controller Asset + Identity gắn `[RequirePermission("Module.Entity.Action")]` (`Shared.Application/Authorization/`, policy-based, check claim `Permission` trong JWT) từng action. Không còn `[AllowAnonymous]`/`[Authorize(Roles=...)]`. Chi tiết + danh sách mã: [identity-module.md](identity-module.md) §9.

## 6. Exception Handling (`Shared.Core/Exceptions/`)
```
BaseException (abstract): StatusCode + List<string>? Errors
├── DomainException(msg)          → 400 (lỗi nghiệp vụ)
└── NotFoundException(entity, key) → 404 "{entity} with ID ({key}) not exist."
```
`GuardExtensions`:
- `OrThrowNotFound("Chi nhánh", id)` (404 nếu null) / `OrThrow("msg")` (400 nếu null). **Phải nhận lại giá trị trả về**: `var branch = (await repo.GetByIdAsync(id)).OrThrowNotFound(...)`. Gọi kiểu bỏ kết quả (`branch.OrThrowNotFound(...)` đứng riêng 1 dòng) tuy vẫn chạy đúng nhưng compiler không biết biến đã hết null → sinh hàng loạt CS8602/CS8604 ở mọi chỗ dùng sau đó (đã dọn sạch cho Asset 2026-07-27).
- `ThrowIfDuplicateCode("Mã chi nhánh", request.BranchCode, x => x.IsDeleted)` (400) — dùng khi check trùng mã. **Truy vấn tìm bản ghi trùng phải KHÔNG lọc `!IsDeleted`** vì unique index của DB này là global (không filter `IsDeleted`), bản ghi đã xoá mềm vẫn giữ chỗ mã đó vĩnh viễn; lọc `IsDeleted` sẽ để lọt xuống SQL và biến 400 sạch sẽ thành `DbUpdateException` → 500. Ở `UpdateAsync` phải loại chính bản ghi đang sửa bằng `x.Id != request.Id` **chứ không** so mã cũ/mới trong C# trước (`string !=` phân biệt hoa/thường còn collation SQL thì không → đổi mã chỉ khác hoa/thường sẽ tự báo trùng chính nó). Tham số cuối `scopeSuffix` cho unique phạm vi hẹp (vd `DeviceGroup`: mã unique trong 1 Bộ phận).

Middleware `CompanySystem.HostApi/Middlewares/HandleExceptionMiddleware.cs` map exception → `ApiResponse.Failure` + status: `BaseException` dùng StatusCode/Errors của nó; `ValidationException`/`ArgumentException`/`InvalidOperationException` → 400; `UnauthorizedAccessException` → 401; `KeyNotFoundException` → 404; `DbUpdateException` → 500; còn lại → 500. Message mặc định của middleware viết **tiếng Việt** (2026-07-27) vì FE hiển thị thẳng field `message` cho người dùng. Rơi vào nhánh `DbUpdateException` gần như luôn là dấu hiệu service quên check trùng/FK trước — xem `ThrowIfDuplicateCode` ở trên.

→ **Trong Service cứ ném exception**, đừng tự dựng `ApiResponse.Failure`. (Legacy `AuthController`/`UserService` vẫn try/catch thủ công — code mới không theo.)

## 7. DI (Scrutor) — nguồn sự thật: `CompanySystem.HostApi/Configurations/DependencyInjection.cs` → `AddDIConfig`
> Các hàm `AddAssetModule`/`AddIdentityModule` trong Infrastructure **KHÔNG được host gọi**.

`AddDIConfig` làm 3 việc:
1. `AddDbContext<IdentityDbContext/AssetDbContext>(o => o.UseSqlServer(conn))`.
2. **Scrutor auto-register**: quét assembly `Identity*`/`Attendance*`/`Asset*`/`Shared*`, lấy class tên kết thúc `Repository`|`UnitOfWork`|`Service` → `AsImplementedInterfaces().WithScopedLifetime()`.
3. `AddHttpContextAccessor()` + `IClaimsTransformation` (Identity).

→ Code mới chỉ cần đặt đúng tên (`FooService : IFooService`) là tự DI. Không sửa `AddDIConfig` trừ khi cần lifetime khác/tên lệ quy ước/service không interface.

**Controllers**: `Program.cs` nạp qua `AddApplicationPart(typeof(Xxx.Api.AssemblyReference).Assembly)`. Thêm module Api mới → thêm 1 dòng `AddApplicationPart`.

## 8. Pipeline Host (Program.cs) — thứ tự
```
HandleExceptionMiddleware → (Dev) MapOpenApi + MapScalarApiReference
→ UseHttpsRedirection → UseCors("AllowNextJs" = localhost:3000, 10.45.1.181:3000, AllowCredentials)
→ UseForwardedHeaders → UseAuthentication → UseAuthorization → MapControllers
```

## 9. Bẫy cần nhớ
- **Namespace**: Domain mới file-scoped; Application/Infrastructure phần lớn block-scoped. Theo file lân cận.
- **Entity là `partial class`** (scaffold từ DB).
- **`TimeHelper.GetCurrentUtcTime()`** = `DateTime.UtcNow.AddHours(7)` (giờ VN). Toàn bộ logic nghiệp vụ (timestamp entity, hạn dùng token nội bộ, `ApiResponse.Timestamp`...) PHẢI dùng hàm này, KHÔNG dùng `DateTime.UtcNow` trực tiếp. Ngoại lệ duy nhất: `TokenService.GenerateJwtToken` (`Expires`) phải giữ UTC thật vì middleware xác thực JWT so sánh với `DateTime.UtcNow` chuẩn của hệ thống.
- **Mapping thủ công** khắp nơi (KHÔNG AutoMapper).
- **EF Fluent map tên Anh → bảng/cột tiếng Việt** (DB legacy): `Branch` → PK `PK_ChiNhanhs`, cột `MaChiNhanh`. Giữ quy ước đặt tên constraint/index đang dùng.
