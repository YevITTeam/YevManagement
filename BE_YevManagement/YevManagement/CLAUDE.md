# CLAUDE.md — Sổ tay dự án YevManagement Backend

> File này là **kim chỉ nam** cho mọi agent làm việc trên dự án. Đọc file này
> TRƯỚC KHI code. Mục tiêu tối thượng: **tiết kiệm token dài hạn** — thay vì dán
> lại mã nguồn, agent tự đọc bộ `docs/` để nắm pattern rồi code cho khớp 100%
> với kiến trúc lõi.

---

## 1. Tổng quan & Công nghệ

- **Tên:** YevManagement — hệ thống quản lý nội bộ (Identity, Asset/PC, Attendance).
- **Kiến trúc:** .NET 10 **Modular Monolith** (mô đun hoá theo nghiệp vụ, deploy 1 host).
- **Runtime:** .NET 10 (`net10.0`), C# `Nullable` + `ImplicitUsings` bật ở mọi project.
- **ORM:** Entity Framework Core 10.0.9 + SQL Server (Database-First / scaffolded, có Migrations).
- **Host:** `CompanySystem.HostApi` (ASP.NET Core Web API), chạy tại `http://localhost:5000`.
- **API docs:** OpenAPI + Scalar UI tại `/scalar/v1` (chỉ môi trường Development).
- **Auth:** Windows Negotiate (AD) → sinh JWT Bearer. Xem [docs/identity-module.md](docs/identity-module.md).
- **DI helper:** [Scrutor](https://github.com/khellang/Scrutor) 7.0.0 — auto-register theo quy ước tên.

Version .NET SDK đã kiểm chứng: **10.0.301**. Build: `dotnet build YevManagement.slnx`.

---

## 2. Cấu trúc Solution

Mỗi module nghiệp vụ = **4 project** theo Clean Architecture:

```
{Module}.Domain          → Entities (POCO, không phụ thuộc gì)
{Module}.Application      → DTOs, Interfaces (I*Repository/I*Service/I*UnitOfWork), Services
{Module}.Infrastructure   → DbContext, Repositories, UnitOfWork, Migrations, DI config
{Module}.Api             → Controllers, AssemblyReference
```

Nền tảng dùng chung (KHÔNG chứa nghiệp vụ):

```
Shared.Core           → Exceptions (BaseException, DomainException, NotFoundException), GuardExtensions
Shared.Application    → Abstractions (IGenericRepository, IUnitOfWork), BaseService, Wrapper (ApiResponse, PagedResponse), Helper
Shared.Infrastructure → GenericRepository<T,TDbContext>, BaseUnitOfWork<TDbContext>
CompanySystem.HostApi → Composition root: Program.cs, DI, Auth, Middleware
```

**Các module hiện có:**

| Module | Trạng thái | Doc |
|---|---|---|
| Identity | Đã có code (User/Role/Auth, Windows login) | [docs/identity-module.md](docs/identity-module.md) |
| Asset | Đã có code, đang phát triển (Device/Branch/Supplier/DeviceType/Software...) | [docs/asset-module.md](docs/asset-module.md) |
| Attendance | **CHƯA DEFINE** (chỉ có 4 project rỗng) | [docs/attendance-module.md](docs/attendance-module.md) |

> ⚠️ **Bẫy tên thư mục:** project Infrastructure của Identity nằm ở thư mục
> `Indentity.Infrastructure` (gõ sai "Inden...") nhưng **assembly name là
> `Identity.Infrastructure`**. Luôn dùng đúng tên đang có, đừng "sửa" kẻo hỏng
> reference. Tương tự có typo `IUserReposiory`, folder `Dtos/Suplliers` — giữ nguyên.

---

## 3. Tiêu chuẩn Code (BẮT BUỘC tuân thủ)

Chi tiết cơ chế xem [docs/architecture-core.md](docs/architecture-core.md). Tóm tắt luật:

1. **Response luôn bọc wrapper.** Controller trả `ApiResponse<T>`; dữ liệu phân
   trang trả `PagedResponse<T>`. KHÔNG trả entity/DTO trần.
2. **Controller kế thừa `BaseController`** của module đó, dùng helper `Success()`,
   `Fail<T>()`, `CreatedSuccess()`. Route mặc định `api/[controller]`, có `[ApiController]`.
3. **Service kế thừa `BaseService<I{Module}UnitOfWork>`**, truy cập DB qua
   `_unitOfWork.{Repo}`. KHÔNG inject `DbContext` thẳng vào Service.
4. **Mọi thao tác DB đi qua UnitOfWork + Repository.** Repository kế thừa
   `GenericRepository<TEntity, {Module}DbContext>`; UnitOfWork kế thừa
   `BaseUnitOfWork<{Module}DbContext>` và implement `I{Module}UnitOfWork`.
5. **`SaveChangesAsync()` gọi ở Service qua `_unitOfWork`**, không gọi trong Repository.
   Repository chỉ `AddAsync/Update/Delete` (đánh dấu thay đổi).
6. **Soft delete**: hầu hết entity có cờ `IsDeleted`. Xoá = set `IsDeleted = true`
   rồi `Update`. Query phải tự lọc `.Where(x => !x.IsDeleted)` (KHÔNG có global filter).
7. **Validation** bằng DataAnnotations trên DTO `Create*`/`Update*`
   (`[Required(ErrorMessage="...")]`, tiếng Việt).
8. **Ném lỗi nghiệp vụ** bằng `DomainException` (400) / `NotFoundException` (404)
   hoặc `GuardExtensions.OrThrow*()`. Middleware toàn cục sẽ chuyển thành `ApiResponse.Failure`.
   KHÔNG `try/catch` trả message thủ công trong Service (trừ chỗ code cũ đã có).
9. **Mapping DTO thủ công** (projection `.Select(...)`), dự án KHÔNG dùng AutoMapper.
10. **Đăng ký DI tự động qua Scrutor**: đặt tên class kết thúc bằng `Repository`,
    `UnitOfWork`, hoặc `Service` là đủ để được auto-register Scoped. Không cần
    thêm dòng `services.AddScoped` thủ công (xem [docs/architecture-core.md](docs/architecture-core.md) §DI).

---

## 4. Giao thức Tiết kiệm Token (BẮT BUỘC)

Đây là các quy tắc vận hành khi tôi (người dùng) giao việc:

### 4.1. Tự động đọc doc module
Khi tôi nhắc đến một module (ví dụ "thêm API cho **Asset**", "sửa **Attendance**"),
**việc đầu tiên** bạn làm là đọc `docs/{tên-module}-module.md` (và
`docs/architecture-core.md` nếu chưa nắm pattern lõi) TRƯỚC khi động vào code.
Không yêu cầu tôi dán lại mã nguồn — thông tin đã nằm trong docs.

### 4.2. Module CHƯA DEFINE → HỎI TRƯỚC, code SAU
Nếu tôi yêu cầu code một module **chưa được define** (ví dụ Attendance) hoặc một
thực thể mới hoàn toàn, **quy tắc số 1**: KHÔNG tự bịa nghiệp vụ. Bạn phải **hỏi
tôi** để chốt hai thứ trước khi viết bất kỳ dòng code nào:

1. **Danh sách Entity** (tên, thuộc tính, kiểu dữ liệu, quan hệ, có `IsDeleted`?).
2. **Business Logic** (các use-case/API cần có, luật validate, luật đặc thù).

Chỉ khi đã có đủ 2 thông tin trên (tôi cung cấp, hoặc chốt trong
`docs/{module}-module.md`) thì mới scaffold code theo template chuẩn.

### 4.3. Giữ nhất quán với lõi
Mọi code mới PHẢI kế thừa `GenericRepository` / `BaseUnitOfWork` / `BaseService`
/ `BaseController` và bọc `ApiResponse`/`PagedResponse` như mô tả ở §3. Không tự
tạo pattern truy cập dữ liệu mới.

### 4.4. Cập nhật doc sau khi code
Sau khi implement xong phần mới cho một module, **cập nhật lại
`docs/{module}-module.md`** (danh sách entity/DTO/endpoint, mục "đã xong / cần
làm tiếp") để lần sau đọc doc là đủ.

---

## 5. Lệnh hay dùng

```bash
# Build toàn solution
dotnet build YevManagement.slnx

# Chạy API (Development, http://localhost:5000, Scalar UI /scalar/v1)
dotnet run --project CompanySystem.HostApi --launch-profile http

# Smoke test nhanh (khởi động → gọi endpoint → tắt). Xem .claude/skills/run-yevmanagement/
& .claude\skills\run-yevmanagement\smoke.ps1

# EF Core migration cho một module (ví dụ Asset) — chạy từ thư mục gốc solution
dotnet ef migrations add <TenMigration> --project Asset.Infrastructure --startup-project CompanySystem.HostApi
dotnet ef database update --project Asset.Infrastructure --startup-project CompanySystem.HostApi
```

> Connection string & JWT secret nằm ở `CompanySystem.HostApi/appsettings.json`.
> DB là **SQL Server dùng chung, dữ liệu thật** — mọi thao tác kiểm thử phải
> read-only, không tạo/sửa/xoá bản ghi rác.

## 6. Một số lưu ý
Mọi comments ghi chú lại phải bằng tiếng anh.
