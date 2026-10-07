# architecture-core.md — Quy tắc lõi Backend

> Code module mới **kế thừa** tầng `Shared.*`, không viết lại. Mẫu gọn nhất: `Asset` (`BranchService`, `BranchRepository`, `BranchController`).

**Solution** (`yev-backend/YevManagement.slnx`, .NET 10): mỗi module = 4 project `{M}.Domain` → `{M}.Application` → `{M}.Infrastructure` → `{M}.Api`;
nền tảng `Shared.Core` (exceptions, guards) → `Shared.Application` (abstractions, wrapper) → `Shared.Infrastructure` (generic repo/UoW);
`CompanySystem.HostApi` là composition root (Program.cs, DI, Auth, Middleware).
Phụ thuộc: **Domain không phụ thuộc gì · Application không biết Infrastructure · Host ráp mọi thứ.**

## 1. Repository & UnitOfWork
- `IGenericRepository<T>` / `GenericRepository<T, TDbContext>` (`Shared.Application/Abstraction`, `Shared.Infrastructure/Repositories`). Dùng method có sẵn, đừng viết query thô: `GetByIdAsync`, `FirstOrDefaultAsync(pred, includes)`, `FindAsync`, `SelectAsync` (projection, AsNoTracking), `GetQueryable(isTracking, includes)`, `ToPagedResponseAsync` (phân trang chuẩn), `ToListAsync` (báo cáo, không phân trang), `CountAsync`, `GroupCountAsync`, `AddAsync/AddRangeAsync/Update/Delete/RemoveRange` (chỉ đánh dấu, chưa Save).
- Repo con để rỗng nếu không cần method đặc thù; kế thừa `GenericRepository<TEntity, {M}DbContext>`.
- `IUnitOfWork`/`BaseUnitOfWork<TDbContext>`: `SaveChangesAsync`, `BeginTransactionAsync`, `CommitTransactionAsync`, `RollbackTransactionAsync`. Mỗi module có `I{M}UnitOfWork` phơi repo thành property — cửa ngõ **duy nhất** Service chạm DB (mẫu `AssetUnitOfWork`). DbContext + repo Scoped → 1 `SaveChangesAsync` lưu chung cả request.
- **Soft delete:** xoá = `IsDeleted = true` + `Update`; mọi query tự lọc `!x.IsDeleted` (`GetQueryable(false).Where(...)`) — **không có global query filter**.

## 2. Service
`BaseService<I{M}UnitOfWork>` (field `_unitOfWork`). Luồng: lấy qua `_unitOfWork.{Repo}` → check nghiệp vụ (ném exception) → Add/Update/Delete → `await _unitOfWork.SaveChangesAsync()` (ở Service, không ở Repository) → map DTO **thủ công** bằng `.Select(...)` (không AutoMapper) → return. Không inject `DbContext` vào Service.

## 3. Controller & Response
- Controller kế thừa `BaseController` riêng của module (`[ApiController]`, `[Route("api/[controller]")]`): `Success()` 200, `Fail<T>()` 400, `CreatedSuccess()` 201, `NoContentSuccess()` 204. Tên controller → URL.
- Luôn trả `ApiResponse<T>` (`{ isSuccess, message, data, errors, timestamp }`); phân trang `PagedResponse<T>` (`Data, PageIndex` **bắt đầu từ 1**, `PageSize, TotalCount, TotalPages, HasNextPage, HasPreviousPage`). Không trả entity/DTO trần.
- Validation bằng DataAnnotations trên DTO `Create*`/`Update*` (`[Required(ErrorMessage="…")]`, message tiếng Việt).

## 4. Lỗi & Guard (`Shared.Core`)
`BaseException` (StatusCode, Errors) → `DomainException` (400) · `NotFoundException` (404). Trong Service **cứ ném exception**, `HandleExceptionMiddleware` (`CompanySystem.HostApi/Middlewares/`) chuyển thành `ApiResponse.Failure` với message tiếng Việt (FE hiển thị thẳng); đừng `try/catch` dựng response (code Auth cũ còn làm vậy, không theo).
- `OrThrowNotFound("Chi nhánh", id)` / `OrThrow("msg")`: **phải nhận lại giá trị** (`var x = (await repo.GetByIdAsync(id)).OrThrowNotFound(…)`); gọi đứng riêng dòng vẫn chạy nhưng compiler không biết hết null → hàng loạt CS8602/CS8604.
- `ThrowIfDuplicateCode(...)`: truy vấn trùng **KHÔNG lọc `!IsDeleted`** (unique index DB là global, bản ghi xoá mềm vẫn giữ mã; lọc sẽ thành `DbUpdateException` → 500). `UpdateAsync` loại chính mình bằng `x.Id != request.Id` trong SQL, không so mã cũ/mới trong C# (`string !=` phân biệt hoa/thường, collation SQL thì không). Tham số `scopeSuffix` cho unique phạm vi hẹp (vd mã nhóm unique trong 1 Bộ phận).
- `DbUpdateException` trong middleware (→ 500) gần như luôn là service quên check trùng/FK.

## 5. Phân quyền
Host bật `FallbackPolicy` → mọi endpoint cần đăng nhập. Mỗi action gắn `[RequirePermission("Module.Entity.Action")]` (`Shared.Application/Authorization/`); permission lấy từ DB qua `IAuthSnapshotCache` (TTL 60s), JWT không mang `Permission`. Mã permission mới phải thêm vào **migration seed** và gán cho role `Admin`. Danh sách mã: `identity-module.md`.

## 6. DI & Pipeline
- Nguồn sự thật: `CompanySystem.HostApi/Configurations/DependencyInjection.cs` → `AddDIConfig` (các `AddAssetModule`/`AddIdentityModule` trong Infrastructure **không được gọi**). Scrutor quét assembly `Identity*|Attendance*|Asset*|Shared*`, class tên kết thúc `Repository|UnitOfWork|Service` → Scoped tự động. Tên khác quy ước (vd `OllamaChatClient`) phải đăng ký tay.
- Controller nạp qua `AddApplicationPart(typeof(Xxx.Api.AssemblyReference).Assembly)` — module Api mới thêm 1 dòng.
- Pipeline `Program.cs`: `HandleExceptionMiddleware` → (Dev) OpenAPI + Scalar `/scalar/v1` → HttpsRedirection → `UseCors("AllowNextJs")` (whitelist origin trong Program.cs, `AllowCredentials`) → ForwardedHeaders → Authentication → Authorization → MapControllers.

## 7. Scaffold 1 entity mới
Entity (`partial class` + `IsDeleted`) → `DbSet` + Fluent config (tên constraint tiếng Việt theo DB cũ) → `I<Entity>Repository` + impl + property vào UnitOfWork → DTO `Create/Update` → Service → Controller `[RequirePermission]` → migration (kèm seed permission) → cập nhật doc module.

## 8. Bẫy cần nhớ
- **Giờ VN:** logic nghiệp vụ dùng `TimeHelper.GetCurrentUtcTime()` (= `UtcNow + 7h`), không `DateTime.UtcNow`. Ngoại lệ duy nhất: `TokenService.GenerateJwtToken` (`Expires`) giữ UTC thật.
- DB scaffold từ hệ cũ: tên bảng/cột/constraint **tiếng Việt** (`Device` → `PK_ThietBis`); entity mới theo quy ước. Entity là `partial class`; namespace: Domain mới file-scoped, Application/Infrastructure phần lớn block-scoped — theo file lân cận.
- **Typo cố ý giữ nguyên, đừng sửa:** thư mục `Indentity.Infrastructure/` (assembly vẫn là `Identity.Infrastructure`), interface `IUserReposiory`, folder `Asset.Application/Dtos/Suplliers/`.
- DB Asset: production thật là `YevPCManagement_Production`; `PCManagementConnection` local trỏ `YevPCManagement` (dev) là **cố ý** — xác nhận trước khi migration/đọc số liệu "thật". DB là SQL Server dùng chung, dữ liệu thật: kiểm thử chỉ read-only.
