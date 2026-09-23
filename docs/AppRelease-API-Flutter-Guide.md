# Hướng dẫn tích hợp API "Tự động cập nhật app" (AppRelease) — cho app mobile

> Tài liệu này viết riêng cho đội phát triển app mobile "YEV Scan", tự chứa đủ thông tin để tích hợp
> tính năng tự kiểm tra + tải bản cập nhật mà không cần đọc thêm tài liệu nào khác của hệ thống YEV
> Management. Nếu có sai khác giữa tài liệu này và response thật của server, **tin theo response thật**
> và báo lại cho đội Backend (`docs/docs-be/asset-module.md §1.23` là nguồn chân lý gốc phía backend).
>
> Tính năng này **độc lập** với "Kiểm tra Server" (`ServerCheck-API-Flutter-Guide.md`) và "Kiểm kê thiết
> bị" (`Inventory-API-Flutter-Guide.md`) — chỉ có 2 endpoint, **không cần đăng nhập**, có thể tích hợp
> ngay ở màn splash/mở app, trước cả khi user đăng nhập để dùng các tính năng quét mã kia.

## 1. Bối cảnh nghiệp vụ

App mobile nội bộ "YEV Scan" (dùng chung cho ServerCheck, Inventory, và các tính năng quét mã sau này)
cần tự kiểm tra bản cập nhật mỗi khi mở app — công ty không publish app lên Google Play (app nội bộ,
cài trực tiếp file `.apk`), nên không có cơ chế auto-update chuẩn của store, phải tự làm.

Admin quản lý danh sách bản phát hành qua màn quản trị trên web (`asset-module.md §1.23`), mỗi bản gồm:
số hiệu phiên bản (`versionCode`, tăng dần), tên hiển thị (`versionName`, vd "1.3.0"), phiên bản tối
thiểu bắt buộc (`minVersionCode`), link tải file `.apk`, và changelog. Admin có thể **dán link ngoài**
(Google Drive...) hoặc **upload file trực tiếp** qua UI — với app mobile, cả 2 trường hợp **hoàn toàn
giống nhau**: `apkUrl` luôn là 1 URL tải file trực tiếp, app không cần phân biệt.

**Luồng tổng quát:**
1. Mở app → gọi `GET /AppRelease/latest` → so `versionCode` hiện tại của app (đọc từ
   `PackageInfo.buildNumber` — build number của app chính là `versionCode` gửi lên khi build, do đội
   mobile tự đặt khớp với giá trị Admin nhập bên web) với response.
2. `< minVersionCode` → **bắt buộc cập nhật**, chặn dùng app tiếp (dialog không cho bấm "Bỏ qua").
3. Nằm giữa `minVersionCode` và `versionCode` → **gợi ý cập nhật**, cho bấm "Để sau".
4. `>= versionCode` → không cần làm gì, vào app bình thường.
5. User bấm "Cập nhật" → tải file qua `apkUrl` (GET thuần, không cần token) → mở trình cài đặt Android
   bằng chính file vừa tải.

Toàn bộ logic so sánh version nằm ở **app Flutter** — backend chỉ trả dữ liệu thô, không tự quyết "có
bắt buộc cập nhật không".

## 2. Base URL & môi trường

- **Hiện tại**: `http://10.45.1.155:8081` — lấy chuẩn từ
  `CompanySystem.HostApi/Properties/launchSettings.json` phía backend (đổi từ `:8080` ngày 2026-08-26,
  **có thể đổi tiếp** khi đội hạ tầng cấp IP tĩnh khác — hỏi lại đội Backend trước khi build bản release,
  đừng tin bất kỳ IP nào ghi trong tài liệu cũ hơn ngày đó).
- Tất cả endpoint dưới đây có tiền tố `/api`. Ví dụ endpoint đầy đủ:
  `http://10.45.1.155:8081/api/AppRelease/latest`.
- Không có HTTPS ở giai đoạn hiện tại (mạng LAN nội bộ công ty) — app phải cho phép gọi `http://` (Android
  cần khai báo `usesCleartextTraffic="true"` hoặc Network Security Config cho phép domain/IP này). Đây
  cũng chính là app cần cài "nguồn không xác định" để tự cài file `.apk` tải về — xem §9.

## 3. Không cần đăng nhập

Khác với ServerCheck/Inventory, **cả 2 endpoint của tính năng này đều `[AllowAnonymous]`** — không cần
header `Authorization`, không cần user đã đăng nhập. Đây là chủ đích: app phải kiểm tra được bản cập nhật
**trước khi** user đăng nhập (vd bản cũ có bug chặn đăng nhập thì vẫn phải tự cập nhật được).

Nếu app đã có sẵn JWT (từ phiên đăng nhập trước đó cho ServerCheck/Inventory) thì gắn kèm cũng không sao,
server bỏ qua — không bắt buộc.

## 4. Envelope response chung

`GET /AppRelease/latest` bọc theo envelope chuẩn của hệ thống:

```jsonc
{
  "isSuccess": true,
  "message": "Success",
  "data": { /* ... hoặc null ... */ },
  "errors": null,
  "timestamp": "2026-09-23T08:05:00Z"
}
```

**Ngoại lệ**: `GET /AppRelease/download/{fileName}` (tải file `.apk`) trả **file nhị phân trực tiếp**,
**không** bọc envelope — response là bytes của file `.apk`, header `Content-Type:
application/vnd.android.package-archive`, `Content-Disposition` gợi ý tên file. Ghi thẳng ra file cục bộ
bằng client HTTP (`dio` với `responseType: ResponseType.bytes` hoặc stream to file), không parse JSON.

**Mã lỗi HTTP:**

| Code | Ý nghĩa |
|---|---|
| 200 | Thành công |
| 404 | (chỉ ở `/download/{fileName}`) file không tồn tại trên server — không nên xảy ra nếu `apkUrl` lấy trực tiếp từ response của `/latest` |
| 500 | Lỗi hệ thống — hiện thông báo chung, báo Backend |

## 5. Luồng nghiệp vụ tổng quát

```
[Mở app / màn splash]
    → GET /api/AppRelease/latest (không cần token)
        ├─ data == null                          → chưa có bản nào đăng ký, vào app bình thường
        ├─ localVersionCode < data.minVersionCode → dialog "Bắt buộc cập nhật", KHÔNG cho bỏ qua
        │       → bấm "Cập nhật" → tải data.apkUrl → mở trình cài đặt
        ├─ localVersionCode < data.versionCode    → dialog "Có bản mới", cho bấm "Để sau"
        │       → bấm "Cập nhật" → tải data.apkUrl → mở trình cài đặt
        │       → bấm "Để sau" → vào app bình thường (nên hỏi lại lần mở app kế tiếp, không cần lưu
        │         trạng thái "đã từ chối" vĩnh viễn — dữ liệu quá nhẹ để cache)
        └─ localVersionCode >= data.versionCode   → vào app bình thường, không hiện gì

[Tải + cài đặt] (khi user bấm "Cập nhật")
    → GET data.apkUrl (không cần token, kể cả khi apkUrl trỏ ra ngoài như Google Drive)
    → ghi ra file cục bộ (vd getApplicationDocumentsDirectory()/update.apk)
    → mở trình cài đặt Android bằng file đó (xem §9 — cần quyền REQUEST_INSTALL_PACKAGES)
```

Gọi `GET /latest` **mỗi lần mở app** (không cache lâu dài) — dữ liệu rất nhẹ (1 request nhỏ), không cần
tối ưu bằng cache phức tạp.

## 6. Chi tiết từng endpoint

### 6.1 `GET /api/AppRelease/latest` — bản phát hành mới nhất

Không cần token, không tham số.

- "Mới nhất" = bản chưa bị Admin xoá, có `versionCode` lớn nhất.
- `data: null` → **chưa có bản phát hành nào được đăng ký trong hệ thống** — coi như không cần cập nhật,
  vào app bình thường (không phải lỗi).

```jsonc
// AppReleaseDto (data khi có bản phát hành)
{
  "id": 3,
  "versionCode": 4,
  "versionName": "1.3.0",
  "minVersionCode": 3,
  "apkUrl": "http://10.45.1.155:8081/api/AppRelease/download/b01fa4feed444dcf9696141b8f07de9b.apk",
  "changelog": "Sửa lỗi quét mã bị treo\nThêm màn lịch sử"
}
```

- `versionCode`/`minVersionCode`: số nguyên, **so trực tiếp** với build number app đang chạy — đội mobile
  tự thống nhất với Admin quy ước đặt số (khuyến nghị: `versionCode` app tăng dần 1 đơn vị mỗi lần build
  release, khớp đúng số Admin nhập khi tạo bản phát hành mới trên web).
- `apkUrl`: **luôn là URL GET trực tiếp được** — có thể trỏ vào chính server này (`/AppRelease/download/...`,
  khi Admin dùng nút "Tải file .apk lên") hoặc trỏ ra dịch vụ ngoài (Google Drive, v.v. khi Admin dán link
  tay). App **không cần phân biệt 2 trường hợp** — cứ GET thẳng URL này để tải file.
- `changelog`: string hoặc `null`, có thể chứa `\n` — hiển thị nguyên văn (không phải Markdown/HTML).

### 6.2 `GET /api/AppRelease/download/{fileName}` — tải file `.apk`

Không cần token. Đây chính là URL nằm trong `apkUrl` khi Admin upload file qua UI thay vì dán link ngoài
— app **không tự ráp URL này**, chỉ GET nguyên văn giá trị `apkUrl` nhận được từ §6.1.

- Trả **file nhị phân trực tiếp** (không bọc envelope), `Content-Type:
  application/vnd.android.package-archive`.
- 404 nếu file không còn tồn tại trên server (hiếm — chỉ xảy ra nếu Admin xoá file thủ công ngoài quy
  trình chuẩn của hệ thống).
- Không giới hạn kích thước phía app; phía server chấp nhận file tới 300MB (APK thực tế thường vài chục
  đến ~150MB).

## 7. Lỗi thường gặp khi tích hợp

| Hiện tượng | Nguyên nhân | Cách xử lý |
|---|---|---|
| `GET /latest` trả `data: null` hoài dù Admin nói đã tạo bản phát hành | Bản đó đã bị Admin xoá (xoá mềm) sau khi tạo | Không phải lỗi app — kiểm tra lại trên màn quản trị web |
| So `versionCode` sai, cứ báo "có bản mới" liên tục dù đã cập nhật | App đọc nhầm `versionName` (string, vd "1.3.0") thay vì `versionCode` (int) để so sánh | Luôn so bằng `versionCode`/`minVersionCode` — 2 số nguyên, không so chuỗi `versionName` |
| Tải `apkUrl` bị lỗi SSL/cleartext | `apkUrl` trỏ vào server nội bộ (`http://10.45.1.155:8081/...`), Android chặn cleartext theo mặc định | Khai báo cho phép cleartext với domain/IP này (§2), hoặc dùng Network Security Config |
| Tải xong nhưng bấm cài không có tác dụng | Thiếu quyền `REQUEST_INSTALL_PACKAGES` hoặc chưa bật "Cài đặt ứng dụng không xác định" cho app | Xin quyền + hướng dẫn user bật trong Settings (§9) |
| `apkUrl` trỏ ra Google Drive nhưng tải về là trang HTML thay vì file `.apk` | Link Drive dạng "share link" thường (`/view?usp=sharing`) không phải link tải trực tiếp | Báo Admin đổi sang link tải trực tiếp đúng chuẩn, hoặc khuyến khích Admin dùng nút "Tải file .apk lên" (server tự sinh link tải trực tiếp, luôn đúng định dạng) |

## 8. Gợi ý UX & tích hợp cài đặt Android

- Gọi `GET /latest` ở màn splash, **song song** với các bước khởi tạo khác (không chặn UI chờ network) —
  chỉ hiện dialog cập nhật SAU khi màn chính đã load xong, trừ trường hợp bắt buộc cập nhật (`< minVersionCode`)
  thì mới chặn hẳn.
- Dialog "Bắt buộc cập nhật": không có nút đóng/back, chỉ có nút "Cập nhật ngay" — dùng `PopScope`/
  `WillPopScope` chặn nút back hệ thống.
- Tải file: dùng `dio` (hoặc tương đương) tải `apkUrl` về thư mục tạm, hiện thanh tiến trình (APK có thể
  vài chục MB, mạng LAN công ty thường nhanh nhưng vẫn nên hiện %).
- Cài đặt: Android 8+ yêu cầu quyền `REQUEST_INSTALL_PACKAGES` khai báo trong `AndroidManifest.xml` +
  user phải bật thủ công "Cài đặt ứng dụng không xác định" cho app YEV Scan (Settings → Apps → Cài đặt
  ứng dụng đặc biệt) — mở file `.apk` vừa tải bằng package như `open_filex` hoặc dùng
  `android_intent_plus` bắn `Intent.ACTION_VIEW` kèm `FileProvider` (bắt buộc từ Android 7+, không dùng
  `file://` URI trần).
- Sau khi cài xong, Android tự khởi động lại app (nếu user xác nhận) — không cần app tự gọi lại `/latest`
  ngay lập tức, lần mở tiếp theo sẽ tự thấy `versionCode` đã khớp.

## 9. Checklist trước khi tích hợp xong

1. Gọi `GET /api/AppRelease/latest` ở màn splash, không cần token.
2. So `versionCode` (int) — **không so `versionName`** — với build number hiện tại của app.
3. `< minVersionCode` → dialog chặn hẳn (không nút back/đóng); nằm giữa `minVersionCode` và `versionCode`
   → dialog cho bỏ qua.
4. Bấm "Cập nhật" → GET nguyên văn `data.apkUrl` (không tự ráp URL) → ghi ra file cục bộ → mở bằng
   `FileProvider` + Intent cài đặt.
5. Khai báo `usesCleartextTraffic`/Network Security Config cho phép IP server (§2), quyền
   `REQUEST_INSTALL_PACKAGES` trong `AndroidManifest.xml`.
6. Test với `data: null` (chưa có bản phát hành nào) — app phải vào bình thường, không crash.
7. Test với cả 2 loại `apkUrl`: link do Admin **upload trực tiếp** (`/AppRelease/download/...`) và link
   Admin **dán tay** (link ngoài) — cả 2 phải tải được như nhau.
