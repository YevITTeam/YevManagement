# Hướng dẫn viết API & DTO tầng Frontend

> Tài liệu này mô tả **quy ước chuẩn** để viết một module API mới ở FE gọi sang
> Backend, dựa trên cấu trúc hiện có của dự án (`src/modules/pc-management`) và
> hợp đồng API mô tả trong [asset-api-fe.md](../docs-be/asset-api-fe.md).
>
> Mục tiêu: mỗi lần thêm 1 entity/API mới, chỉ cần **copy khuôn mẫu** trong tài
> liệu này rồi đổi tên — không cần nghĩ lại kiến trúc, đảm bảo mọi file đồng nhất.

---

## 1. Kiến trúc tổng thể

Một module (ví dụ `pc-management`) được tổ chức theo tầng:

```
src/
├─ lib/
│  ├─ client.ts        # fetch wrapper dùng chung: api.get/post/put/delete + auth token
│  └─ apiError.ts      # getApiErrorMessage() — bóc message lỗi tiếng Việt từ BE
├─ types/
│  └─ api.ts           # ApiResponse<T> & ApiResponseWithPageNation<T> (envelope dùng chung)
└─ modules/
   └─ <module-name>/
      ├─ api/          # 1 file .api.ts cho mỗi entity  → khai báo endpoint + hàm gọi
      ├─ types/        # 1 file .dto.ts cho mỗi entity  → định nghĩa TypeScript interface
      └─ components/   # UI tiêu thụ API
```

**Quy tắc vàng:**
- Mỗi entity BE ↔ **1 file `*.api.ts`** + **1 file `*.dto.ts`**.
- File API **chỉ** chứa lời gọi HTTP + khai báo endpoint. Không đặt logic UI/state ở đây.
- Component **không** tự `fetch`, luôn gọi qua object `XxxApi` đã export.
- Kiểu response luôn bọc trong `ApiResponse<T>` hoặc `ApiResponseWithPageNation<T>`.

---

## 2. Nền tảng dùng chung (không sửa khi thêm entity mới)

### 2.1. `src/lib/client.ts`

Cung cấp object `api` với 5 method. Tất cả trả về **payload đã parse JSON** (chính là
envelope `ApiResponse`), tự động:
- Ghép `BASE_URL` (`process.env.NEXT_PUBLIC_API_URL`) vào trước endpoint → **endpoint truyền vào luôn bắt đầu bằng `/`** (ví dụ `/Device/grid-list`), **không** kèm `/api` hay host.
- Gắn `Authorization: Bearer <token>` nếu có token trong localStorage.
- Tự re-login qua `/windows-login` khi gặp 401 rồi retry request — **nhưng chỉ khi thật sự cần**: nếu token trong localStorage đã khác token vừa gắn cho request đó (một request khác đã đăng nhập lại xong trong lúc chờ) thì chỉ retry, không mở thêm handshake Negotiate. Mỗi handshake thừa là một lần trình duyệt có thể hỏi lại tài khoản domain — xem [identity-api-fe.md §2b](../docs-be/identity-api-fe.md).
- Ném `new Error(errorBody)` khi `!response.ok` — `errorBody` là **chuỗi JSON gốc** của BE.

```ts
api.get<T>(url, options?)
api.post<T>(url, data?, options?)
api.put<T>(url, data?, options?)
api.patch<T>(url, data?, options?)
api.delete<T>(url, options?)
```

> Lưu ý về base path: các file API hiện tại khai báo endpoint là `/Device`, `/Branch`…
> **không** có tiền tố `/api`. Tiền tố `/api` (nếu BE yêu cầu) được gộp sẵn trong
> `NEXT_PUBLIC_API_URL`. Khi thêm entity mới hãy giữ đúng quy ước sẵn có của module.

### 2.2. `src/types/api.ts` — Envelope

```ts
// Response thường (GET by id, POST, PUT, all…)
interface ApiResponse<T> {
  isSuccess: boolean;
  message: string;
  data: T;              // ← dữ liệu thật nằm ở đây
  errors: any | null;
  timestamp: string;
}

// Response phân trang (endpoint grid-list) — data lồng THÊM 1 tầng
interface ApiResponseWithPageNation<T> {
  isSuccess: boolean;
  message: string;
  data: {
    data: T[];          // ← mảng item thật nằm ở response.data.data
    pageIndex: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
  errors: [String];
  timestamp: string;
}
```

Vì mỗi hàm API `return response.data`, nên:
- Với `ApiResponse<T>` → nhận được `data` kiểu `T`.
- Với `ApiResponseWithPageNation<T>` → nhận được object phân trang, mảng item ở `.data`.

### 2.3. `src/lib/apiError.ts`

Ở component, bắt lỗi bằng:

```ts
import { getApiErrorMessage } from "@/lib/apiError";
// ...
catch (error) {
  toast.error(getApiErrorMessage(error, "Không tải được danh sách thiết bị."));
}
```

---

## 3. Khuôn mẫu file DTO (`types/<entity>.dto.ts`)

Ánh xạ 1-1 các schema JSON trong `asset-api-fe.md`. Quy ước:

- **Tên interface** = `PascalCase` + hậu tố `Dto`.
- Field **camelCase**, khớp đúng tên field JSON trả về từ BE.
- Trường có thể null → `T | null` (ví dụ `note: string | null`).
- Tách kiểu theo mục đích, giống các entity phức tạp (Device):
  | Interface | Dùng cho |
  |---|---|
  | `<Entity>Dto` | Item của `grid-list` (bảng danh sách) |
  | `<Entity>GetDto` | Chi tiết `GET /{id}` (thường nhiều field hơn, kèm các `xxxId`) |
  | `CreateUpdate<Entity>Dto` | Body của POST & PUT (gộp chung nếu 2 body giống nhau) |
- Master-data đơn giản (Branch/Supplier/DeviceType/SoftwareGroup) chỉ cần **1 interface** dùng cho tất cả, và tạo body POST bằng `Omit<Dto, "id">`.

**Ví dụ đơn giản** (master data — theo `branch.dto.ts`):

```ts
export interface SupplierDto {
  id: number;
  supplierCode: string;
  supplierName: string;
}
```

**Ví dụ đầy đủ** (entity có Create/Update riêng — theo `device.dto.ts`):

```ts
// Item bảng danh sách
export interface DeviceDto {
  id: number;
  deviceCode: string;
  deviceName: string;
  // ...các field server đã "join" sẵn để hiển thị: branchName, supplierName...
  status: number;
  statusText: string;     // BE đã dịch sẵn enum → chỉ việc hiển thị
}

// Body POST/PUT — chỉ chứa field client được phép gửi.
// KHÔNG đưa field server tự tính (vd expirationDate) vào đây.
export interface CreateUpdateDeviceDto {
  id: number;             // dùng cho PUT; POST có thể để 0 / bỏ qua
  deviceCode: string;
  deviceTypeId: number;   // gửi Id, không gửi tên
  // ...
  status: number;         // enum dạng số
  note: string | null;
  ipAddressId: number | null;
}
```

> **Nguyên tắc quan trọng từ asset-api-fe.md:**
> - Field kiểu enum (`status`) gửi lên bằng **số**; hiển thị dùng `statusText` BE trả sẵn.
> - **Không** gửi field server tự tính (ví dụ `expirationDate`) — bỏ khỏi Create/Update DTO.
> - Với PUT, `id` trong body **phải khớp** `{id}` trên URL.

---

## 4. Khuôn mẫu file API (`api/<entity>.api.ts`)

Mỗi file gồm 3 phần theo đúng thứ tự: **(1) khai báo `ENDPOINTS`**, **(2) interface tham số query**, **(3) object `XxxApi`**.

### 4.1. Bộ khung chuẩn (copy & đổi tên)

```ts
import { api } from "@/lib/client";
import type {
  SupplierDto,
  CreateUpdateSupplierDto,
} from "@/modules/pc-management/types/supplier.dto";
import { ApiResponse, ApiResponseWithPageNation } from "@/types/api";

// 1) Tập trung mọi đường dẫn ở một chỗ. Path tĩnh = chuỗi; path có tham số = hàm.
const ENDPOINTS = {
  SUPPLIER: {
    getSupplierPageNation: "/Supplier/grid-list",
    getAllSuppliers: "/Supplier/all",
    getSupplierById: (id: number) => `/Supplier/${id}`,
    createSupplier: "/Supplier",
    updateSupplier: (id: number) => `/Supplier/${id}`,
    deleteSupplier: (id: number) => `/Supplier/${id}`,
  },
} as const;

// 2) Kiểu tham số cho grid-list (mỗi field optional).
export interface GetSupplierPageNationParams {
  pageIndex?: number;
  pageSize?: number;
  keyword?: string;
}

// 3) Object gom mọi lời gọi. Mỗi hàm async, return response.data.
export const SupplierApi = {
  getSupplierPageNation: async (params?: GetSupplierPageNationParams) => {
    const query = new URLSearchParams();
    if (params?.pageIndex) query.set("PageIndex", String(params.pageIndex));
    if (params?.pageSize) query.set("PageSize", String(params.pageSize));
    if (params?.keyword) query.set("Keyword", params.keyword);

    const queryString = query.toString();
    const url = queryString
      ? `${ENDPOINTS.SUPPLIER.getSupplierPageNation}?${queryString}`
      : ENDPOINTS.SUPPLIER.getSupplierPageNation;

    const response = await api.get<ApiResponseWithPageNation<SupplierDto>>(url);
    return response.data; // { data: SupplierDto[], pageIndex, totalCount, ... }
  },

  getAllSuppliers: async () => {
    const response = await api.get<ApiResponse<SupplierDto[]>>(
      ENDPOINTS.SUPPLIER.getAllSuppliers
    );
    return response.data; // SupplierDto[]
  },

  getSupplierById: async (id: number) => {
    const response = await api.get<ApiResponse<SupplierDto>>(
      ENDPOINTS.SUPPLIER.getSupplierById(id)
    );
    return response.data;
  },

  createSupplier: async (data: CreateUpdateSupplierDto) => {
    const response = await api.post<ApiResponse<SupplierDto>>(
      ENDPOINTS.SUPPLIER.createSupplier,
      data
    );
    return response.data;
  },

  // PUT: luôn nhét id vào body để khớp {id} trên URL.
  updateSupplier: async (id: number, data: Partial<CreateUpdateSupplierDto>) => {
    const response = await api.put<ApiResponse<SupplierDto>>(
      ENDPOINTS.SUPPLIER.updateSupplier(id),
      { id, ...data }
    );
    return response.data;
  },

  deleteSupplier: async (id: number) => {
    const response = await api.delete<ApiResponse<void>>(
      ENDPOINTS.SUPPLIER.deleteSupplier(id)
    );
    return response.data;
  },
};

export { ENDPOINTS };
```

### 4.2. Quy ước bắt buộc

| Quy ước | Chi tiết |
|---|---|
| Đặt tên object | `<Entity>Api` (PascalCase), export `const`. |
| Đặt tên hàm | Động từ + entity: `get<Entity>PageNation`, `getAll<Entities>`, `get<Entity>ById`, `create<Entity>`, `update<Entity>`, `delete<Entity>`. |
| `ENDPOINTS` | `as const`, path tĩnh là chuỗi, path có param là arrow function nhận `id`. |
| Query string | Dùng `URLSearchParams`; **key viết PascalCase** (`PageIndex`, `Keyword`, `Status`) vì BE nhận PascalCase. |
| Điều kiện set query | Với số/chuỗi thường: `if (params?.x)`. Với field **cho phép giá trị 0** (enum `status`, `deviceId`): `if (params?.x !== undefined)` — nếu không, `status=0` sẽ bị bỏ. |
| Kiểu trả về `get<...>` | Generic là `ApiResponse<T>` (đơn) hoặc `ApiResponseWithPageNation<T>` (grid-list). |
| Body POST | Truyền thẳng DTO create. |
| Body PUT | Truyền `{ id, ...data }`. |
| Luôn `return response.data` | Component không phải tự bóc envelope thêm lần nữa. |

---

## 5. Quy trình 6 bước thêm một API/entity mới

Giả sử BE bổ sung entity **`WarrantyPackage`** (`/api/WarrantyPackage`) trong `asset-api-fe.md`.

1. **Đọc hợp đồng** entity đó trong `asset-api-fe.md`: route, các field response, field body POST/PUT, enum, query params, luật nghiệp vụ (field nào server tự tính, field nào không được sửa…).

2. **Tạo DTO** `src/modules/pc-management/types/warranty-package.dto.ts`:
   - `WarrantyPackageDto` (item grid-list / by-id).
   - `CreateUpdateWarrantyPackageDto` (nếu body khác Dto).
   - Bỏ field server tự tính; enum để kiểu `number`.

3. **Tạo API** `src/modules/pc-management/api/warranty-package.api.ts`:
   - Copy bộ khung mục 4.1, đổi tên `SUPPLIER → WARRANTY_PACKAGE`, `Supplier → WarrantyPackage`.
   - Bỏ bớt hàm không có endpoint (vd Device không có `/all` → bỏ `getAll`).
   - Thêm hàm cho endpoint đặc thù nếu có (xem mục 6).

4. **Khai báo query params** đúng theo `grid-list` của entity đó (mỗi bộ filter là 1 field optional trong `Get...PageNationParams`).

5. **Tiêu thụ ở component**: import `WarrantyPackageApi`, gọi trong `useEffect`/handler, bọc `try/catch` + `getApiErrorMessage`. Đọc mảng phân trang tại `res.data`, item tại `res.data.data`.

6. **Kiểm tra**: `npm run build` / typecheck để chắc DTO khớp; đối chiếu tên field với Scalar UI (`/scalar/v1`).

---

## 6. Xử lý các endpoint đặc thù (ngoài CRUD chuẩn)

Nhiều entity có route riêng — vẫn khai báo trong cùng `ENDPOINTS` và thêm hàm tương ứng:

**Route con theo cha** (ví dụ Device → detail, DeviceConfiguration → by-device):
```ts
getDeviceDetailById: (id: number) => `/Device/${id}/detail`,
// ...
getDeviceDetailById: async (id: number) => {
  const response = await api.get<ApiResponse<DeviceDetailDto>>(
    ENDPOINTS.DEVICE.getDeviceDetailById(id)
  );
  return response.data;
},
```

**Action đặc biệt** (assign/unassign IP, sync software) — thường là POST/PUT tới sub-path:
```ts
assignIpAddress: (id: number) => `/IpAddress/${id}/assign`,
// ...
assignIpAddress: async (id: number, deviceId: number) => {
  const response = await api.post<ApiResponse<IpAddressDto>>(
    ENDPOINTS.IP_ADDRESS.assignIpAddress(id),
    { deviceId }
  );
  return response.data;
},
```

**Bảng trung gian khoá kép** (DeviceSoftware: `(deviceId, softwareId)`, không có `id` đơn) — path DELETE ghép cả 2 khoá:
```ts
deleteDeviceSoftware: (deviceId: number, softwareId: number) =>
  `/DeviceSoftware/device/${deviceId}/software/${softwareId}`,
```

> ✅ **Bài học từ các điểm lệch đã sửa** (`device-software.api.ts` / `device.dto.ts`) — tránh lặp lại:
> - `syncDeviceSoftware` là **`PUT /api/DeviceSoftware/sync`** (body `{ deviceId, items }`),
>   không phải `POST /DeviceSoftware/sync/${deviceId}` không body.
> - `deleteDeviceSoftware` route đúng là `/DeviceSoftware/device/{deviceId}/software/{softwareId}` (khoá kép).
> - Field nullable như `licenseKey`/`installDate` phải là `string | null`, **không** đặt kiểu literal `null`.
> - Mảng phải khai báo là `T[]`, **không** dùng tuple `[{ ... }]` (vd `softwares` trong `DeviceDetailDto`).
> - `configuration` trong `DeviceDetailDto` cho phép `null` (thiết bị chưa nhập cấu hình).
> - Nhớ đủ field mới của hợp đồng (vd `isOutsourced` trong `DeviceDto` + filter `grid-list`).
>
> Luôn bám sát schema trong `asset-api-fe.md` / Scalar UI làm nguồn chân lý.

---

## 7. Checklist review nhanh trước khi commit

- [ ] Có đủ 2 file: `types/<entity>.dto.ts` + `api/<entity>.api.ts`.
- [ ] Tên field DTO **camelCase** khớp response BE; nullable đúng `T | null`.
- [ ] DTO Create/Update **không** chứa field server tự tính; enum kiểu `number`.
- [ ] Endpoint bắt đầu bằng `/`, gom trong `ENDPOINTS ... as const`.
- [ ] Query key PascalCase; field cho phép giá trị 0 dùng `!== undefined`.
- [ ] `grid-list` dùng `ApiResponseWithPageNation<T>`; còn lại `ApiResponse<T>`.
- [ ] PUT gửi kèm `{ id, ...data }`.
- [ ] Mỗi hàm `return response.data`.
- [ ] Component gọi qua `XxxApi`, bọc `try/catch` + `getApiErrorMessage`.
```
