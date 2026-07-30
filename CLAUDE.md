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
│  └─ docs-fe/        ← khuôn mẫu code FE + design system + i18n
├─ yev-backend/       ← .NET 10 modular monolith (`YevManagement.slnx`)
└─ yev-frontend/      ← Next.js 16 App Router (static export)
```

**Hệ thống:** ứng dụng quản lý nội bộ công ty YEV, gồm 3 mảng nghiệp vụ:
Identity (user/role/permission, đăng nhập Windows AD), Asset (quản lý PC/thiết bị),
Attendance (giấy đề nghị làm ngoài giờ — OT Form).

### Bảng định tuyến task → doc phải đọc TRƯỚC khi code

| Task | Đọc trước |
|---|---|
| Bất kỳ việc gì đụng BE | [docs/docs-be/architecture-core.md](docs/docs-be/architecture-core.md) |
| Module Asset (BE) | [docs/docs-be/asset-module.md](docs/docs-be/asset-module.md) |
| Module Identity (BE) | [docs/docs-be/identity-module.md](docs/docs-be/identity-module.md) |
| Module Attendance (BE) | [docs/docs-be/attendance-module.md](docs/docs-be/attendance-module.md) |
| **Gọi API từ FE** (bất kỳ module nào) | hợp đồng API tương ứng: [asset-api-fe.md](docs/docs-be/asset-api-fe.md) · [identity-api-fe.md](docs/docs-be/identity-api-fe.md) · [attendance-api-fe.md](docs/docs-be/attendance-api-fe.md) |
| Viết file `*.api.ts` / `*.dto.ts` mới | [docs/docs-fe/huong-dan-viet-api-fe.md](docs/docs-fe/huong-dan-viet-api-fe.md) |
| Dựng / sửa UI | [docs/docs-fe/DESIGN_SYSTEM.md](docs/docs-fe/DESIGN_SYSTEM.md) |
| Đa ngôn ngữ (vi/ja) | [docs/docs-fe/thiet-ke-tinh-nang-dich-ngon-ngu.md](docs/docs-fe/thiet-ke-tinh-nang-dich-ngon-ngu.md) |
| In PDF phiếu tăng ca | [docs/docs-be/attendance-otform-pdf-mapping.md](docs/docs-be/attendance-otform-pdf-mapping.md) |
| AI Chat tra cứu Asset (tool-calling, read-only) | [docs/docs-be/ai-chat-be-huong-dan.md](docs/docs-be/ai-chat-be-huong-dan.md) (thiết kế gốc) — hợp đồng thật ở `asset-api-fe.md §7c` |
| AI Chat lập đơn tăng ca Attendance (tool-calling, có tool ghi) | [docs/docs-be/attendance-aichat-be-huong-dan.md](docs/docs-be/attendance-aichat-be-huong-dan.md) — hợp đồng thật ở `attendance-api-fe.md §10` |

> 3 file `*-api-fe.md` là **hợp đồng dùng chung FE↔BE**, chỉ tồn tại 1 bản duy nhất trong
> `docs/docs-be/`. Đây là nguồn chân lý về tên field & shape — đừng đoán, đừng chép ra bản thứ hai.

---

## 2. Giao thức làm việc (BẮT BUỘC)

1. **Tự đọc doc trước, không hỏi xin mã nguồn.** Người dùng nhắc tên module → việc đầu tiên là
   đọc doc module đó ở bảng trên.
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

---

## 3. Backend — `yev-backend/`

### 3.1 Stack & lệnh

- .NET 10 (`net10.0`, SDK đã kiểm chứng **10.0.301**), `Nullable` + `ImplicitUsings` bật ở mọi project.
- EF Core 10 + SQL Server (scaffold từ hệ cũ, có Migrations). Scrutor 7 để auto-DI.
- Host: `CompanySystem.HostApi` (ASP.NET Core Web API). API docs: OpenAPI + **Scalar UI** `/scalar/v1`
  (chỉ Development). Auth: Windows Negotiate (AD) → JWT Bearer.
- **Base URL hiện tại: `http://10.45.1.155:8080`** (`CompanySystem.HostApi/Properties/launchSettings.json`).
  Một số doc còn ghi `http://localhost:5000` (giá trị cũ) — lấy `launchSettings.json` làm chuẩn.

```powershell
# từ yev-backend/
dotnet build YevManagement.slnx
dotnet run --project CompanySystem.HostApi --launch-profile http

# smoke test nhanh (start → 7 check read-only → stop). Có sẵn skill `run-yevmanagement`.
& .claude\skills\run-yevmanagement\smoke.ps1            # thêm -KeepRunning để giữ API chạy

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

Next.js 16 (App Router, **`output: "export"`** — static export, `trailingSlash: true`) ·
React 19 (**React Compiler bật**) · TypeScript `strict` · Tailwind CSS v4 · next-intl ·
react-toastify · lucide-react · jspdf/html2canvas/qrcode (in PDF & QR) ·
react-markdown + remark-gfm (chỉ dùng để render câu trả lời AI Chat).
**Không** dùng thư viện data-fetching/state (React Query, Redux…) — chỉ `fetch` wrapper thủ công
+ `useState`/`useEffect`. Package manager: **pnpm** (`pnpm-lock.yaml`).

```bash
# từ yev-frontend/
pnpm dev            # dev server :3000 (turbopack)
pnpm build          # static export ra out/
pnpm lint
npx tsc --noEmit    # CHẠY SAU MỖI THAY ĐỔI .ts/.tsx, trước khi báo xong
```

- Path alias `@/*` → `src/*`.
- `NEXT_PUBLIC_API_URL` đặt trong `.env.local` (gitignored, **phải tự tạo**), giá trị = base URL của
  BE **kèm `/api`**, vd `http://10.45.1.155:8080/api`.
- Vì là static export: **không có** middleware/SSR/route handler ở production (IIS chỉ serve file tĩnh).
  `src/proxy.ts` (middleware next-intl) chỉ chạy khi dev.

### 4.2 Cấu trúc thư mục

```
src/
├─ app/[locale]/            # mọi route nằm dưới [locale] (vi | ja). Route groups: (admin), (ot-manager), (pc-manager)
│  ├─ layout.tsx            # root: Header + ToastContainer + AuthProvider (đã mount toàn cục)
│  └─ .../page.tsx          # mỗi page CHỈ là wrapper mỏng render 1 component List/Page
├─ navigation.ts            # Link / useRouter / usePathname của next-intl — DÙNG CÁI NÀY, không dùng next/link
├─ proxy.ts                 # middleware next-intl (chỉ có tác dụng khi dev)
├─ i18n/{routing,request}.ts
├─ components/              # UI dùng chung: ui/(Button, Card, Input, Table), common/ConfirmDialog, LanguageSwitcher
├─ lib/
│  ├─ client.ts             # fetch wrapper api.get/post/put/delete + Bearer token + auto re-login khi 401
│  │                        # + postStream() trả Response còn nguyên body cho endpoint NDJSON (AI Chat)
│  └─ apiError.ts           # getApiErrorMessage(err, fallback) — bóc message tiếng Việt từ BE
├─ types/api.ts             # ApiResponse<T> & ApiResponseWithPageNation<T>
└─ modules/<module>/        # auth · common · pc-management · attendance · schedule · ai-chat
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

**Fetch dữ liệu — luôn dùng `useFetchEffect`** (`modules/common/hooks/useFetchEffect.ts`).
React Compiler lint rule `react-hooks/set-state-in-effect` **cấm setState đồng bộ trong `useEffect`**
(kể cả gọi 1 hàm `async` khác có setState bên trong, dù setState nằm sau `await`); chỉ được setState
trong `.then()/.catch()/.finally()`. Vì vậy **không** viết lại pattern cũ
`fetchXxx` async + `useEffect(() => { fetchXxx() }, deps)`:

```ts
const { isLoading, error, refetch: fetchBranches } = useFetchEffect(
    () => BranchApi.getBranchPageNation({ pageIndex, pageSize: PAGE_SIZE, keyword: appliedKeyword || undefined }),
    [pageIndex, appliedKeyword],          // deps — đổi thì tự fetch lại + tự bật lại isLoading
    (result) => {                         // onSuccess — nơi DUY NHẤT được set state khác
        setBranches(result.data);
        setTotalCount(result.totalCount);
    },
    "Không thể tải danh sách chi nhánh.", // errorFallback
    (message) => toast.error(message)     // onError (optional)
);
```
`refetch` dùng y hệt hàm `fetchXxx` cũ: nút "Làm mới" (`onClick={() => fetchBranches()}`) và
`await fetchBranches();` sau create/update/delete. `fetcher` được phép `async/await` (miễn không tự setState).

**Reset form dialog — dùng `useDialogReset`** (`modules/common/hooks/useDialogReset.ts`) thay cho
`useEffect(() => { if (isOpen) setValues(...) }, [isOpen, initial])`:
```ts
useDialogReset(isOpen, initial, (current) => {
    setValues(current ? { branchCode: current.branchCode, branchName: current.branchName } : emptyValues);
});
```
Nếu Form không có prop `isOpen` (bị cha mount/gỡ có điều kiện, vd `RoleForm`) phải kết hợp thêm
**lazy initializer** `useState(() => ...)` vì `useDialogReset` không chạy ở lần mount đầu.

**Reset state khi 1 giá trị đổi** (vd `setPageIndex(1)` khi filter đổi, xoá `selectedIds` khi
`devices` đổi) — **không** dùng effect, so sánh snapshot ngay trong thân render
([you-might-not-need-an-effect](https://react.dev/learn/you-might-not-need-an-effect)):
```ts
const [prevFilters, setPrevFilters] = useState(filtersKey);
if (prevFilters !== filtersKey) {
    setPrevFilters(filtersKey);
    setPageIndex(1);
}
```

### 4.6 Đa ngôn ngữ (next-intl) — đang triển khai dở

Locale `vi` (mặc định) + `ja`, `localePrefix: "always"` (bắt buộc vì static export không có middleware
ở production). Message ở `messages/vi.json` & `messages/ja.json`.
**Hiện mới dịch Header/Navigation/Home** — phần lớn màn hình vẫn hardcode tiếng Việt.
Khi làm màn hình mới hoặc được yêu cầu dịch: dùng `useTranslations`, thêm key vào **cả hai** file
message, theo [thiet-ke-tinh-nang-dich-ngon-ngu.md](docs/docs-fe/thiet-ke-tinh-nang-dich-ngon-ngu.md).
Chỉ dịch **text tĩnh** — dữ liệu động từ DB giữ nguyên tiếng Việt (đã chốt).

### 4.7 Style & icon

Tailwind CSS v4, font Inter. Đọc [DESIGN_SYSTEM.md](docs/docs-fe/DESIGN_SYSTEM.md) trước khi dựng UI.
Bảng màu thương hiệu (giữ nguyên khi thêm màn mới): đỏ nhấn `#e3000f` / hover `#b40009`;
chữ đậm `#191c1e`; chữ phụ `#5e3f3a`; muted `#8a8f94`; viền `#e0e3e5`; nền phụ `#f8fafc`; lỗi `#930006`.

**Icon:** luôn dùng component từ `lucide-react` (`import { X } from "lucide-react"`), **không** gõ thẳng
emoji/ký tự unicode làm icon (`✕`, `🗑`, `🖨`, `↻`, `⬇`, `←`, `⚙`, `✓`, `⚠`…) — kể cả nút đóng modal,
"Làm mới", in/xuất PDF, hay icon sắp xếp. Kích cỡ quy ước: nút đóng modal `h-5 w-5`; icon trong nút
hành động nhỏ `h-3.5 w-3.5` kèm `flex items-center gap-1.5` trên chính button/link; icon inline cạnh
text ngắn dùng `size={12}`–`size={16}`.
*Ngoại lệ:* nội dung mô phỏng ô tick trên biểu mẫu giấy in ra PDF (vd `OtFormPrintView.tsx`) vẫn giữ
ký tự `✓` thuần — đó là nội dung tài liệu, không phải icon UI.

---

## 5. Hợp đồng FE ↔ BE (tóm tắt — chi tiết ở `*-api-fe.md`)

- **Envelope**: mọi response (kể cả lỗi) là
  `{ isSuccess, message, data, errors, timestamp }` (camelCase). `errors`: `string[] | null`.
- **Phân trang**: `data` chứa `data[]` + `pageIndex/pageSize/totalCount/totalPages/hasNextPage/hasPreviousPage`.
- **Auth**: `POST /api/Auth/windows-login` (Windows Negotiate, `-UseDefaultCredentials`) → JWT.
  Mọi endpoint khác cần `Authorization: Bearer <token>` **và** permission tương ứng
  (thiếu token → 401, thiếu permission → 403).
  `client.ts` đã có sẵn cơ chế Bearer token (localStorage) + tự re-login qua `/windows-login` khi gặp
  401 rồi retry, và dồn nhiều 401 đồng thời về đúng 1 lần handshake NTLM — **không phá cơ chế này**.
- Chỉ **JWT** được lưu `localStorage`; thông tin user (fullName/roles/permissions) giữ trong
  React Context (`modules/auth/context/AuthContext.tsx`), không ghi ra đĩa.
- **CORS**: BE chỉ whitelist `http://localhost:3000` + `http://10.45.1.181:3000` (`AllowCredentials`).
  Origin khác phải bổ sung ở BE.

---

## 6. Checklist trước khi báo "xong"

1. Đã đọc doc liên quan ở §1 trước khi code? Nghiệp vụ mới chưa rõ → đã hỏi thay vì tự bịa?
2. BE: code khớp đủ 11 luật §3.4? Có migration + seed permission nếu thêm endpoint mới?
   `dotnet build YevManagement.slnx` sạch lỗi?
3. FE: `npx tsc --noEmit` sạch? Tên field đã đối chiếu với `*-api-fe.md` (hoặc Scalar UI)?
4. UI mới theo `DESIGN_SYSTEM.md` + bảng màu + icon `lucide-react`?
5. **Đã cập nhật `docs/` cho phần vừa làm** (§2.4)?
