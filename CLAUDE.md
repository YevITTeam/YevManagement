# CLAUDE.md — Sổ tay dự án YEV Management (monorepo FE + BE)

> **Kim chỉ nam duy nhất** cho mọi agent làm việc trên repo này. Đọc file này TRƯỚC khi code.
> Mục tiêu: agent tự đọc `docs/` để nắm pattern rồi code khớp 100% với kiến trúc lõi —
> người dùng không phải dán lại mã nguồn.
>
> **Ngôn ngữ:** trả lời người dùng bằng **tiếng Việt**. Text hiển thị trên UI: **tiếng Việt**.
> **Comment trong code: tiếng Anh.**

---

## 1. Bản đồ repo

```
YevManagement_FE_BE/
├─ CLAUDE.md          ← file này (áp dụng cho CẢ FE lẫn BE)
├─ docs/
│  ├─ docs-be/        ← thiết kế BE + HỢP ĐỒNG API (nguồn chân lý chung cho cả 2 phía)
│  ├─ docs-fe/        ← khuôn mẫu code FE + design system + i18n
│  ├─ deploy-config/  ← web.config cho IIS + AutoDeploy.ps1 + docker-deploy-guide.md
│  └─ Data/           ← Excel/PDF nghiệp vụ thật (input để đối chiếu, KHÔNG phải doc)
├─ yev-backend/       ← .NET 10 modular monolith (`YevManagement.slnx`)
└─ yev-frontend/      ← Next.js 16 App Router (static export)
```

**Hệ thống:** ứng dụng quản lý nội bộ công ty YEV, gồm 4 mảng nghiệp vụ:
Identity (user/role/permission, đăng nhập Windows AD + user/mật khẩu), Asset (quản lý PC/thiết bị),
Attendance (giấy đề nghị làm ngoài giờ — OT Form), Workflow (form builder động + duyệt nhiều cấp).

> `docs/Guideline_PC.md` và `docs/huong-dan-su-dung-attendance.md` là **hướng dẫn cho người dùng cuối**,
> không phải spec kỹ thuật — đừng suy schema/endpoint từ 2 file đó.

### Bảng định tuyến task → doc phải đọc TRƯỚC khi code

| Task | Đọc trước |
|---|---|
| Bất kỳ việc gì đụng BE | [docs/docs-be/architecture-core.md](docs/docs-be/architecture-core.md) |
| Module Asset (BE) | [docs/docs-be/asset-module.md](docs/docs-be/asset-module.md) |
| Module Identity (BE) | [docs/docs-be/identity-module.md](docs/docs-be/identity-module.md) |
| Module Attendance (BE) | [docs/docs-be/attendance-module.md](docs/docs-be/attendance-module.md) |
| **Module Workflow (BE + FE)** — form builder động + duyệt nhiều cấp | [docs/docs-be/workflow-module.md](docs/docs-be/workflow-module.md) + sơ đồ [docs/workflow-erd.drawio](docs/workflow-erd.drawio) |
| **Gọi API từ FE** (Asset / Identity / Attendance) | hợp đồng API tương ứng: [asset-api-fe.md](docs/docs-be/asset-api-fe.md) · [identity-api-fe.md](docs/docs-be/identity-api-fe.md) · [attendance-api-fe.md](docs/docs-be/attendance-api-fe.md) |
| **Gọi API Workflow từ FE** | **không có** `workflow-api-fe.md` — hợp đồng nằm ngay trong [workflow-module.md](docs/docs-be/workflow-module.md) (§6 endpoint, §10 phần bổ sung cho FE) |
| Viết file `*.api.ts` / `*.dto.ts` mới | [docs/docs-fe/huong-dan-viet-api-fe.md](docs/docs-fe/huong-dan-viet-api-fe.md) |
| Dựng / sửa UI | [docs/docs-fe/DESIGN_SYSTEM.md](docs/docs-fe/DESIGN_SYSTEM.md) |
| Đa ngôn ngữ (vi/ja) | §4.6 dưới đây (không còn doc riêng) |
| In PDF phiếu tăng ca | [docs/docs-be/attendance-otform-pdf-mapping.md](docs/docs-be/attendance-otform-pdf-mapping.md) |
| AI Chat tra cứu Asset (tool-calling, read-only) | kiến trúc/code + blocker hạ tầng: `asset-module.md §1.18` — hợp đồng FE: `asset-api-fe.md §7c` |
| AI Chat lập đơn tăng ca Attendance (tool-calling, có tool ghi) | [docs/docs-be/attendance-aichat-be-huong-dan.md](docs/docs-be/attendance-aichat-be-huong-dan.md) — hợp đồng thật ở `attendance-api-fe.md §10` |

> 3 file `*-api-fe.md` (Asset / Identity / Attendance) là **hợp đồng dùng chung FE↔BE**, chỉ tồn tại
> 1 bản duy nhất trong `docs/docs-be/`. Đây là nguồn chân lý về tên field & shape — đừng đoán, đừng chép
> ra bản thứ hai. Workflow cố tình không tách file riêng: hợp đồng nằm trong chính `workflow-module.md`.

---

## 2. Giao thức làm việc (BẮT BUỘC)

1. **Tự đọc doc trước, không hỏi xin mã nguồn.** Người dùng nhắc tên module → việc đầu tiên là
   đọc doc module đó ở bảng trên — nhưng **đọc theo lát cắt, xem luật 7**.
2. **Nghiệp vụ chưa được define → HỎI TRƯỚC, code SAU.** Nếu được yêu cầu làm một thực thể/luồng
   hoàn toàn mới chưa có trong doc: **KHÔNG tự bịa nghiệp vụ**. Phải chốt đủ 2 thứ trước khi viết
   dòng code đầu tiên: (a) **danh sách Entity** (tên, thuộc tính, kiểu, quan hệ, có `IsDeleted`?);
   (b) **business logic** (use-case/API cần có, luật validate, luật đặc thù).
   *(Các doc trong `docs/` tham chiếu quy tắc này là "CLAUDE.md §2 luật 2".)*
3. **Không tự tạo pattern mới.** Mọi code mới kế thừa đúng lớp lõi (§3.4) / khuôn mẫu FE (§4.3).
4. **Cập nhật doc sau khi code.** Implement xong phần mới → sửa ngay `docs/docs-be/{module}-module.md`
   (entity/DTO/endpoint, mục "đã xong / cần làm tiếp") và hợp đồng `*-api-fe.md` nếu API đổi.
   Lần sau đọc doc là đủ.
5. **DB là SQL Server dùng chung, DỮ LIỆU THẬT.** Mọi thao tác kiểm thử phải read-only —
   không tạo/sửa/xoá bản ghi rác.
6. **Không "sửa" typo có sẵn** trong tên thư mục/class/route (xem §3.5) — sẽ vỡ reference.
7. **ĐỌC DOC LỚN THEO LÁT CẮT — đừng `Read` cả file.** Vài doc rất nặng, đọc trọn 1 file đủ đốt sạch
   context còn lại của phiên:

   | Doc | Nặng | Đọc kiểu gì |
   |---|---|---|
   | `attendance-module.md` | ~378 KB | **Bắt buộc** cắt lát |
   | `attendance-api-fe.md` | ~162 KB | **Bắt buộc** cắt lát |
   | `workflow-module.md` | ~135 KB | **Bắt buộc** cắt lát |
   | `asset-module.md` | ~82 KB | Nên cắt lát |
   | còn lại (`architecture-core.md`, `*-api-fe.md` nhỏ, `docs-fe/*`) | < 45 KB | Đọc cả file được |

   **Quy trình 3 bước:** (a) đọc bảng **"MỤC LỤC ĐỌC NHANH"** ở đầu mỗi doc lớn (chủ đề → mục/dải dòng);
   (b) `Grep` pattern `^#{2,3} ` trên file đó để lấy số dòng hiện tại của mục cần; (c) `Read` với
   `offset`/`limit` bao đúng dải đó (dư ±20 dòng là đủ). Cần tra 1 tên field/endpoint cụ thể thì `Grep`
   thẳng chuỗi đó, đừng đọc tuần tự.
8. **Cập nhật doc thì viết theo trạng thái HIỆN TẠI, không viết nhật ký.** Sửa thẳng vào mục đang mô tả
   phần đó; chỉ thêm mục mới khi là nghiệp vụ mới. Khi một quyết định cũ bị thay thế → **xoá/gộp** mục
   cũ, giữ lại đúng 1 dòng "trước làm X, bỏ vì Y" nếu lý do còn giá trị. Đừng nối thêm mục
   `§... (ngày)` cho mỗi lần sửa — đó là thứ đã làm `attendance-module.md` phình lên 410 KB.

---

## 3. Backend — `yev-backend/`

### 3.1 Stack & lệnh

- .NET 10 (`net10.0`, SDK đã kiểm chứng **10.0.301**), `Nullable` + `ImplicitUsings` bật ở mọi project.
- EF Core 10 + SQL Server (scaffold từ hệ cũ, có Migrations). Scrutor 7 để auto-DI.
- Host: `CompanySystem.HostApi` (ASP.NET Core Web API). API docs: OpenAPI + **Scalar UI** `/scalar/v1`
  (chỉ Development). Auth: Windows Negotiate (AD) → JWT Bearer.
- **Base URL hiện tại: `http://10.45.1.155:8081`** (profile `http` trong
  `CompanySystem.HostApi/Properties/launchSettings.json` — **luôn lấy file này làm chuẩn**; đổi từ `:8080`
  ngày 2026-08-26 vì máy dev có 1 rule `netsh interface portproxy` cũ chiếm cứng port 8080, đừng đụng rule đó).
  Doc nào còn ghi `http://localhost:5000` hay `http://10.45.1.181:8080` là giá trị cũ.

```powershell
# từ yev-backend/
dotnet build YevManagement.slnx
dotnet run --project CompanySystem.HostApi --launch-profile http

# migration cho 1 module (chạy tại thư mục gốc solution = yev-backend/)
dotnet ef migrations add <TenMigration> --project Asset.Infrastructure --startup-project CompanySystem.HostApi
dotnet ef database update --project Asset.Infrastructure --startup-project CompanySystem.HostApi
```

> Connection string & JWT secret: `CompanySystem.HostApi/appsettings.json`.

### 3.2 Cấu trúc solution

Mỗi module nghiệp vụ = **4 project** theo Clean Architecture:

```
{Module}.Domain          → Entities (POCO, không phụ thuộc gì)
{Module}.Application     → DTOs, Interfaces (I*Repository / I*Service / I*UnitOfWork), Services
{Module}.Infrastructure  → DbContext, Repositories, UnitOfWork, Migrations, DI config
{Module}.Api             → Controllers, AssemblyReference
```

Nền tảng dùng chung (KHÔNG chứa nghiệp vụ):

```
Shared.Core           → Exceptions (BaseException, DomainException, NotFoundException), GuardExtensions
Shared.Application    → Abstractions (IGenericRepository, IUnitOfWork), BaseService, Wrapper (ApiResponse, PagedResponse)
Shared.Infrastructure → GenericRepository<T,TDbContext>, BaseUnitOfWork<TDbContext>
CompanySystem.HostApi → composition root: Program.cs, DI, Auth, Middleware
```

Luật vàng phụ thuộc: **Domain không phụ thuộc gì. Application không biết Infrastructure. Host ráp mọi thứ.**

### 3.3 Trạng thái module

| Module | DB | Trạng thái |
|---|---|---|
| Identity | `YevIdentityManagement` | Production. User/Role/Permission, Windows login → JWT. |
| Asset | `YevPCManagement` | Đang phát triển. Device/Branch/Supplier/DeviceType/Software/IpAddress/TransferHistory/AuditTrail, import Excel, report, AI Chat. |
| Attendance | (xem `attendance-module.md`) | Đã có code. OT Form: duyệt nhiều cấp + phạm vi tổ chức + chữ ký + gửi email. |
| Workflow | `YevWorkflowManagement` | Đang phát triển, **đã có đủ 4 project + 27 entity + Migrations + FE**. Form builder động + duyệt nhiều cấp theo mô hình POWER EGG; Pha 1→4 (tổ chức/nhân sự → form designer kéo-thả → engine nộp/duyệt → chữ ký + đính kèm + duyệt qua email) đã xong BE lẫn FE. Phần còn nợ ghi ở đầu `workflow-module.md`. **Cố ý ĐỘC LẬP với Attendance** dù trùng 7 nhóm bảng — xem `workflow-module.md §1`. |

> **Trước khi chạm DB Asset:** `PCManagementConnection` trong `appsettings.json` đang trỏ
> `YevPCManagement`, nhưng dữ liệu production thật của PC Management nằm ở **`YevPCManagement_New`**
> (2 DB chưa đồng bộ schema/dữ liệu — việc tách/migrate còn dở). Trước khi chạy migration hoặc đọc số
> liệu "thật", **xác nhận lại đang nối DB nào**; đừng mặc định appsettings là production.

### 3.4 Chuẩn code BE (BẮT BUỘC — chi tiết ở `architecture-core.md`)

1. **Response luôn bọc wrapper.** Controller trả `ApiResponse<T>`; dữ liệu phân trang trả
   `PagedResponse<T>`. KHÔNG trả entity/DTO trần.
2. **Controller kế thừa `BaseController`** của module đó, dùng `Success()`, `Fail<T>()`,
   `CreatedSuccess()`. Route `api/[controller]`, có `[ApiController]`.
3. **Service kế thừa `BaseService<I{Module}UnitOfWork>`**, truy cập DB qua `_unitOfWork.{Repo}`.
   KHÔNG inject `DbContext` thẳng vào Service.
4. **Mọi thao tác DB đi qua UnitOfWork + Repository.** Repository kế thừa
   `GenericRepository<TEntity, {Module}DbContext>`; UnitOfWork kế thừa `BaseUnitOfWork<{Module}DbContext>`
   và implement `I{Module}UnitOfWork`.
5. **`SaveChangesAsync()` gọi ở Service qua `_unitOfWork`**, không gọi trong Repository.
   Repository chỉ `AddAsync/Update/Delete` (đánh dấu thay đổi).
6. **Soft delete**: hầu hết entity có cờ `IsDeleted`. Xoá = set `IsDeleted = true` rồi `Update`.
   Query phải tự lọc `.Where(x => !x.IsDeleted)` — **KHÔNG có global query filter**.
7. **Validation** bằng DataAnnotations trên DTO `Create*`/`Update*`
   (`[Required(ErrorMessage="…")]`, message tiếng Việt).
   **Check trùng mã** dùng `GuardExtensions.ThrowIfDuplicateCode(...)`: truy vấn tìm bản ghi trùng
   **KHÔNG** lọc `!IsDeleted` (unique index của DB là global — bản ghi xoá mềm vẫn giữ chỗ mã đó),
   và `UpdateAsync` loại chính mình bằng `x.Id != request.Id` **chứ không** so mã cũ/mới trong C#
   (`string !=` phân biệt hoa/thường, SQL collation thì không).
8. **Ném lỗi nghiệp vụ** bằng `DomainException` (400) / `NotFoundException` (404) hoặc
   `GuardExtensions.OrThrow*()`. Middleware toàn cục tự chuyển thành `ApiResponse.Failure`.
   KHÔNG `try/catch` trả message thủ công trong Service (trừ code cũ đã có).
   Luôn **nhận lại giá trị** của guard: `var x = (await repo.GetByIdAsync(id)).OrThrowNotFound(…)`.
   Viết `x.OrThrowNotFound(…)` thành 1 dòng riêng vẫn chạy đúng nhưng compiler không biết `x` đã
   hết null → sinh hàng loạt cảnh báo CS8602/CS8604 ở mọi chỗ dùng sau đó.
9. **Mapping DTO thủ công** bằng projection `.Select(...)` — dự án KHÔNG dùng AutoMapper.
10. **DI tự động qua Scrutor**: class có tên kết thúc bằng `Repository`, `UnitOfWork`, hoặc `Service`
    được auto-register Scoped, không cần `services.AddScoped` thủ công. Tên khác quy ước
    (vd `OllamaChatClient`) **phải** đăng ký tay trong `CompanySystem.HostApi/Configurations/DependencyInjection.cs`.
11. **Phân quyền** bằng `[RequirePermission("Module.Entity.Action")]` trên action; mã permission mới
    phải thêm vào migration seed và gán cho role `Admin`.

**Thứ tự scaffold 1 entity mới:** entity (`partial class` + `IsDeleted`) → `DbSet` + Fluent config
(tên constraint tiếng Việt theo DB cũ) → `I<Entity>Repository` + impl + property vào UnitOfWork →
DTOs (`Create`/`Update` + DataAnnotations) → Service `: BaseService<I{Module}UnitOfWork>` →
Controller `: BaseController` + `[RequirePermission]` → migration (kèm seed permission) → cập nhật doc module.

### 3.5 Bẫy đã biết — GIỮ NGUYÊN, đừng sửa

- Thư mục project Infrastructure của Identity là **`Indentity.Infrastructure/`** (gõ sai "Inden")
  nhưng **assembly name là `Identity.Infrastructure`**.
- Typo trong code cũ giữ nguyên: interface `IUserReposiory`, folder `Asset.Application/Dtos/Suplliers/`.
- DB scaffold từ hệ cũ → tên bảng/cột/constraint **tiếng Việt** (vd `Device` → `PK_ThietBis`,
  `IX_ThietBis_MaMay`). Entity mới map vào DB cũ phải theo đúng quy ước này.

---

## 4. Frontend — `yev-frontend/`

### 4.1 Stack & lệnh

Next.js 16 (App Router, static export · `trailingSlash: true`) · React 19 (**React Compiler bật**) ·
TypeScript `strict` · Tailwind CSS v4 · next-intl · react-toastify · lucide-react.
Thư viện chuyên dụng: `jspdf` + `jspdf-autotable` + `qrcode` (in PDF & QR) · `@dnd-kit/*` (kéo-thả field
trong form designer của Workflow) · `jszip` + `docx-preview` + `html-react-parser` (đọc/hiển thị file
`.docx`) · `vietnamese-conversion` (bỏ dấu để tìm kiếm) · `react-markdown` + `remark-gfm` (chỉ để render
câu trả lời AI Chat).
**Không** dùng thư viện data-fetching/state (React Query, Redux…) — chỉ `fetch` wrapper thủ công
+ `useState`/`useEffect`. Package manager: **pnpm** (`pnpm-lock.yaml`; `package-lock.json` là rác còn sót
từ npm — đừng dùng, đừng cập nhật).

```bash
# từ yev-frontend/
pnpm dev            # dev server :3000 (turbopack)
pnpm build          # static export ra out/
pnpm lint
npx tsc --noEmit    # CHẠY SAU MỖI THAY ĐỔI .ts/.tsx, trước khi báo xong
```

- Path alias `@/*` → `src/*`.
- `NEXT_PUBLIC_API_URL` đặt trong `.env.local` (gitignored, **phải tự tạo**), giá trị = base URL của
  BE **kèm `/api`**, vd `http://10.45.1.155:8081/api`.
- Vì là static export: **không có** middleware/SSR/route handler ở production (IIS chỉ serve file tĩnh).
  `src/proxy.ts` (middleware next-intl) chỉ chạy khi dev. `next.config.ts` chỉ bật `output: "export"` ở
  phase `next build` — bật cả ở dev sẽ lỗi "Middleware cannot be used with output: export", đừng "dọn"
  đoạn rẽ theo phase đó.

### 4.2 Cấu trúc thư mục

```
src/
├─ app/[locale]/            # mọi route nằm dưới [locale] (vi | ja)
│  #                          route groups: (admin) (ot-manager) (pc-manager) (workflow-manager)
│  #                          route công khai mở từ link email: login, xac-nhan-* (5 route)
│  ├─ layout.tsx            # root: Header + ToastContainer + AuthProvider + AuthGuard (mount toàn cục)
│  └─ .../page.tsx          # mỗi page CHỈ là wrapper mỏng render 1 component List/Page
├─ navigation.ts            # Link / useRouter / usePathname của next-intl — DÙNG CÁI NÀY, không dùng next/link
├─ proxy.ts                 # middleware next-intl (chỉ có tác dụng khi dev)
├─ i18n/{routing,request}.ts
├─ components/              # UI dùng chung: ui/(Button, Card, Input, Table), common/ConfirmDialog, LanguageSwitcher
├─ lib/
│  ├─ client.ts             # fetch wrapper api.get/post/put/delete + Bearer token + auto re-login khi 401
│  │                        # + postStream() (NDJSON cho AI Chat) + getForBlob()/postFormForBlob()
│  │                        # (tải file: Excel/PDF) + windowsLogin()/passwordLogin()/setOnUnauthorized()
│  ├─ apiError.ts           # getApiErrorMessage(err, fallback) — bóc message tiếng Việt từ BE
│  └─ uuid.ts               # sinh id tạm cho item chưa lưu (form designer, dòng động)
├─ types/api.ts             # ApiResponse<T> & ApiResponseWithPageNation<T>
└─ modules/<module>/        # auth · common · pc-management · attendance · workflow · schedule
   #                          · ai-chat (chat tra cứu Asset) · attendance-ai-chat (chat lập đơn OT)
   ├─ api/<entity>.api.ts   # 1 file / entity — CHỈ endpoint + hàm gọi HTTP
   ├─ types/<entity>.dto.ts # 1 file / entity — interface khớp schema BE
   ├─ lib/                  # helper thuần (vd auth/lib/permissions.ts)
   └─ components/           # UI tiêu thụ API (List + Form + dialog…)
```

### 4.3 Nguyên tắc phân tầng (bắt buộc giữ)

- Component **không bao giờ** tự `fetch` — luôn gọi qua object `XxxApi`.
- File `*.api.ts` **không** chứa logic UI/state. Mỗi entity BE ↔ đúng 1 `*.api.ts` + 1 `*.dto.ts`.
- Page trong `app/` chỉ import & render component tương ứng, không đặt logic.
- Điều hướng: `import { Link, useRouter } from "@/navigation"` — **không** `next/link`,
  **không** `next/navigation` (sẽ mất tiền tố locale).

### 4.4 Bẫy khi viết API/DTO (nhớ kỹ)

- **Envelope**: dữ liệu thật ở `response.data`. Grid-list lồng thêm 1 tầng → mảng ở
  `response.data.data` (**không** phải `.items`); dùng `ApiResponseWithPageNation<T>`.
- Endpoint trong `*.api.ts` bắt đầu bằng `/` và **không** kèm `/api` (tiền tố `/api` đã nằm trong
  `NEXT_PUBLIC_API_URL`).
- Query key gửi BE viết **PascalCase** (`PageIndex`, `Keyword`, `Status`), build bằng `URLSearchParams`.
- Field cho phép giá trị `0`/`false` (enum `status`, `deviceId`, `isOutsourced`): điều kiện set query
  phải là `!== undefined`, **không** dùng truthy `if (params?.x)` (sẽ rớt mất giá trị 0/false).
- DTO `Create`/`Update` **không** chứa field server tự tính (vd `expirationDate`); enum để kiểu
  `number`; nullable là `T | null` (đừng dùng literal `null`); mảng là `T[]` (đừng dùng tuple).
- `PUT`: gửi kèm `{ id, ...data }` để khớp `{id}` trên URL. Mỗi hàm API `return response.data`.
- `byte[]` bên BE (vd ảnh chữ ký) ⇄ **chuỗi base64** trong JSON.

### 4.5 Pattern component

Mọi màn hình CRUD theo cùng khuôn (mẫu gọn nhất: `modules/pc-management/components/branches/`):
**Page** (wrapper mỏng) → **`XxxList.tsx`** (`"use client"`, giữ state phân trang/search/form/delete)
→ **`XxxForm.tsx`** (modal controlled, export `interface XxxFormValues`, prop
`mode: "create" | "edit"` + `initial` + `loading` + `onClose` + `onSubmit`).
Xác nhận xoá: `components/common/ConfirmDialog`. Thông báo: `react-toastify` (đã mount ở root).
Ẩn/hiện nút theo quyền: `modules/auth/lib/permissions.ts` (`hasPermission` / `hasAnyPermission` /
`hasModuleAccess`) — BE vẫn luôn enforce lại, FE chỉ làm UX.

**React Compiler cấm setState đồng bộ trong `useEffect`** (lint `react-hooks/set-state-in-effect`; kể cả
gọi hàm `async` khác có setState bên trong, dù setState nằm sau `await`) — chỉ được setState trong
`.then()/.catch()/.finally()`. Hệ quả: **3 pattern bắt buộc**, mẫu đầy đủ xem
`modules/pc-management/components/branches/` (khuôn gọn nhất) và chính 2 file hook:

1. **Fetch:** `useFetchEffect(fetcher, deps, onSuccess, errorFallback, onError?)` →
   `{ isLoading, error, refetch }` (`modules/common/hooks/useFetchEffect.ts`). `onSuccess` là nơi DUY
   NHẤT được set state; `refetch` thay hàm `fetchXxx` cũ (nút "Làm mới", gọi lại sau create/update/delete).
   **Không** viết lại `fetchXxx` async + `useEffect(() => { fetchXxx() }, deps)`.
2. **Reset form dialog:** `useDialogReset(isOpen, initial, apply)`
   (`modules/common/hooks/useDialogReset.ts`) thay cho `useEffect(… if (isOpen) setValues …)`. Form không
   có prop `isOpen` (bị cha mount/gỡ có điều kiện, vd `RoleForm`) phải kèm **lazy initializer**
   `useState(() => …)` vì hook không chạy ở lần mount đầu.
3. **Reset state khi 1 giá trị đổi** (`setPageIndex(1)` khi filter đổi…): **không** dùng effect, so sánh
   snapshot ngay trong thân render ([you-might-not-need-an-effect](https://react.dev/learn/you-might-not-need-an-effect)):
   ```ts
   const [prevFilters, setPrevFilters] = useState(filtersKey);
   if (prevFilters !== filtersKey) { setPrevFilters(filtersKey); setPageIndex(1); }
   ```

### 4.6 Đa ngôn ngữ (next-intl) — đang triển khai dở

Locale `vi` (mặc định) + `ja`, `localePrefix: "always"` (bắt buộc vì static export không có middleware
ở production — đổi sang `"as-needed"` sẽ 404 trên IIS). Message ở `messages/vi.json` & `messages/ja.json`
(~2.050 dòng mỗi file), namespace gốc: `Common`, `Navigation`, `Header`, `Home`, `Attendance`,
`Workflow`, `Asset`. Vẫn còn màn hình lẻ hardcode tiếng Việt — đụng tới màn nào thì bổ sung key màn đó.
Khi thêm text mới: dùng `useTranslations("<Namespace>")`, thêm key vào **cả hai** file message với cấu
trúc lồng nhau giống hệt nhau (thiếu 1 bên → màn đó vỡ khi đổi ngôn ngữ).
Chỉ dịch **text tĩnh** — dữ liệu động từ DB (tên phòng ban/thiết bị/form) và nội dung biểu mẫu in PDF
theo mẫu giấy công ty giữ nguyên tiếng Việt (đã chốt). Màn cũ còn hardcode thì để nguyên, chỉ chuyển
khi đang sửa chính màn đó.
Cấu hình: `src/i18n/routing.ts` (`defineRouting`) · `src/i18n/request.ts` (`getRequestConfig`) ·
`src/navigation.ts` (`createNavigation`) · `src/proxy.ts` · `next.config.ts` (`withNextIntl`) ·
`app/[locale]/layout.tsx` (`generateStaticParams` + `setRequestLocale` + `NextIntlClientProvider`) ·
`components/LanguageSwitcher.tsx` (`router.replace(pathname, { locale })` + `useTransition`).
Điều hướng lấy từ `@/navigation`; **ngoại lệ duy nhất**: `useSearchParams` vẫn import từ `next/navigation`.

### 4.7 Style & icon

Tailwind CSS v4, font Inter. Đọc [DESIGN_SYSTEM.md](docs/docs-fe/DESIGN_SYSTEM.md) trước khi dựng UI.
Bảng màu thương hiệu (giữ nguyên khi thêm màn mới): đỏ nhấn `#e3000f` / hover `#b40009`;
chữ đậm `#191c1e`; chữ phụ `#5e3f3a`; muted `#8a8f94`; viền `#e0e3e5`; nền phụ `#f8fafc`; lỗi `#930006`.

**Icon:** luôn dùng `lucide-react`, **không** gõ emoji/ký tự unicode làm icon (`✕ 🗑 🖨 ↻ ⬇ ← ⚙ ✓ ⚠`…)
— kể cả nút đóng modal, "Làm mới", in/xuất PDF, icon sắp xếp. Cỡ: nút đóng modal `h-5 w-5`; icon trong
nút hành động nhỏ `h-3.5 w-3.5` + `flex items-center gap-1.5` trên chính button/link; icon inline cạnh
text ngắn `size={12}`–`size={16}`. *Ngoại lệ:* ô tick mô phỏng trên biểu mẫu giấy in PDF (vd
`OtFormPrintView.tsx`) giữ ký tự `✓` thuần — đó là nội dung tài liệu, không phải icon UI.

### 4.8 Xuất PDF — vẽ thẳng bằng jsPDF

`html2canvas` (chụp DOM rồi dán ảnh vào PDF) **không đáng tin**: font/khoảng cách/ngắt dòng trôi so với
layout đã verify trên màn hình, chữ bị nhoè khi scale, và mỗi lần sửa CSS là một lần PDF lệch lại.
Code cũ còn dùng nó (`attendance/components/ot-form/OtFormPrintView.tsx`,
`attendance/lib/productionTicketBatchPdf.tsx`, `workflow/components/requests/WorkflowRequestPrintView.tsx`)
thì **giữ nguyên**, nhưng **mọi luồng xuất PDF mới phải dựng trực tiếp bằng `jspdf`**
(+ `jspdf-autotable` cho bảng) **ngay từ đầu** — đừng đi đường chụp DOM rồi sửa dần.

---

## 5. Hợp đồng FE ↔ BE (tóm tắt — chi tiết ở `*-api-fe.md`)

- **Envelope**: mọi response (kể cả lỗi) là
  `{ isSuccess, message, data, errors, timestamp }` (camelCase). `errors`: `string[] | null`.
- **Phân trang**: `data` chứa `data[]` + `pageIndex/pageSize/totalCount/totalPages/hasNextPage/hasPreviousPage`.
- **Auth**: `POST /api/Auth/windows-login` (Windows Negotiate, `-UseDefaultCredentials`) → JWT, hoặc
  `POST /api/Auth/login` (user + mật khẩu, dùng ở trang `/login`). Còn token thì xác thực lại bằng
  `GET /api/Auth/me` — **đừng gọi lại `windows-login`**, mỗi lần gọi là một handshake NTLM và trình duyệt
  sẽ hỏi tài khoản domain. Mọi endpoint khác cần `Authorization: Bearer <token>` **và** permission tương
  ứng (thiếu token → 401, thiếu permission → 403).
  `client.ts` đã có sẵn cơ chế Bearer token (localStorage) + tự re-login qua `/windows-login` khi gặp
  401 rồi retry, và dồn nhiều 401 đồng thời về đúng 1 lần handshake NTLM — **không phá cơ chế này**.
- JWT mang thêm claim **`UserId`** (số, thêm ngày 2026-08-25) — module Workflow dùng nó để tra
  `Employees.UserId` ra "nhân sự nào đang đăng nhập". Token phát trước mốc đó không có claim này.
- Chỉ **JWT** được lưu `localStorage`; thông tin user (fullName/roles/permissions) giữ trong
  React Context (`modules/auth/context/AuthContext.tsx`), không ghi ra đĩa.
- **CORS**: whitelist nằm ở policy `AllowNextJs` trong `CompanySystem.HostApi/Program.cs`
  (`AllowCredentials`): `localhost:3000`, `localhost:8000`, `10.45.1.155:3000`, `10.45.1.181:3000`,
  `10.45.1.49` (`:8000`/`:80`/không port), `http://intra.yev.vn`. Origin khác phải bổ sung ở BE.

---

## 6. Checklist trước khi báo "xong"

1. Đã đọc doc liên quan ở §1 trước khi code? Nghiệp vụ mới chưa rõ → đã hỏi thay vì tự bịa?
2. BE: code khớp đủ 11 luật §3.4? Có migration + seed permission nếu thêm endpoint mới?
   `dotnet build YevManagement.slnx` sạch lỗi?
3. FE: `npx tsc --noEmit` sạch? Tên field đã đối chiếu với `*-api-fe.md` (hoặc Scalar UI)?
4. UI mới theo `DESIGN_SYSTEM.md` + bảng màu + icon `lucide-react`?
5. **Đã cập nhật `docs/` cho phần vừa làm** (§2.4)?
