# Hướng dẫn giao diện Flutter — đồng bộ ngôn ngữ thiết kế với web YEV Management

> **Dành cho:** Claude/dev phía dự án Android (Flutter) làm màn hình **quét kiểm tra Server**.
> **Mục tiêu:** app nhìn và cảm giác như cùng một sản phẩm với web `yev-frontend` — cùng màu, font, bo góc, khoảng cách, trạng thái, câu chữ.
> **Đọc kèm:** `ServerCheck-API-Flutter-Guide.md` (API + luồng nghiệp vụ). File này **chỉ nói về giao diện**; không lặp lại API.
> Nguồn chuẩn phía web: `docs/docs-fe/DESIGN_SYSTEM.md` và code `yev-frontend/src/modules/pc-management/components/server-check/`. Web dùng Tailwind — mọi giá trị dưới đây đã được quy đổi sang Flutter (1 đơn vị Tailwind = 4 logical px, ví dụ `p-4` = 16, `rounded-lg` = 8).

---

## 1. Nguyên tắc chung (đọc trước)

1. **Màu chủ đạo là đỏ YEV `#E3000F`**, nền trung tính sáng. **Không dùng indigo/xanh dương/tím** làm màu nhấn ở bất cứ đâu.
2. **Đỏ dùng cho hành động chính + điểm nhấn thương hiệu.** Trạng thái "lỗi/NG/nguy hiểm" dùng đỏ **đậm** `#930006` (khác đỏ thương hiệu). Trạng thái "OK/thành công" dùng **xanh lá** `#1A7F37`.
3. **Phẳng, sạch, nhiều khoảng trắng:** card trắng viền mảnh `#E0E3E5`, bóng rất nhẹ, bo góc vừa (12/8). Không đổ bóng nặng, không gradient.
4. **Chữ tiếng Việt**, câu ngắn. Dùng đúng chuỗi ở mục 8 để khớp web.
5. **Icon:** Lucide (cùng bộ với web). **Không dùng emoji/ký tự unicode làm icon.**
6. Ưu tiên **theme tập trung** (`ThemeData` + 1 file `AppColors`/`AppSpacing`) — không rải mã hex vào từng widget.
7. Chỉ **light theme** (web hiện không có dark mode).

---

## 2. Bảng màu → `AppColors`

```dart
import 'package:flutter/material.dart';

/// Khớp 1-1 với bảng màu web (DESIGN_SYSTEM.md §1). Không tự thêm màu mới.
class AppColors {
  // Thương hiệu
  static const brandRed        = Color(0xFFE3000F); // primary / hành động chính
  static const brandRedHover   = Color(0xFFB40009); // pressed của primary
  static const accentSoft      = Color(0xFFFFF4F2); // nền đỏ nhạt (badge, ô icon, dải lỗi)
  static const accentSoftBorder= Color(0xFFE9BCB6); // viền của accentSoft
  static const focusRing       = Color(0xFFFFE0E3); // vòng focus input

  // Nền / bề mặt
  static const background      = Color(0xFFF8FAFC); // nền màn hình
  static const surface         = Color(0xFFFFFFFF); // card
  static const surfaceAlt      = Color(0xFFF7F9FB); // sidebar / vùng phụ
  static const surfaceMuted    = Color(0xFFF1F5F9); // nút chưa chọn, hàng phân cách nhạt
  static const surfaceHover    = Color(0xFFF2F4F6); // pressed/hover nút outline
  static const surfaceContainer= Color(0xFFECEEF0); // mục đang active

  // Viền
  static const border          = Color(0xFFE0E3E5); // viền mặc định
  static const borderSoft      = Color(0xFFF1F5F9); // đường kẻ giữa các hàng

  // Chữ
  static const textStrong      = Color(0xFF191C1E); // tiêu đề, số liệu, chữ chính
  static const textBody        = Color(0xFF5E3F3A); // nhãn, mô tả (nâu ấm)
  static const textMuted       = Color(0xFF8A8F94); // placeholder, caption phụ

  // Ngữ nghĩa
  static const danger          = Color(0xFF930006); // NG, lỗi, xoá
  static const dangerPressed   = Color(0xFF7A0005);
  static const success         = Color(0xFF1A7F37); // OK, đã quét
  static const successSoft     = Color(0xFFE6F4EA); // nền dải thành công
  static const warningBg       = Color(0xFFFFF4E5);
  static const warningBorder   = Color(0xFFF5D0A9);
  static const warningText     = Color(0xFF9A5B00);
}
```

| Cần biểu diễn | Nền | Viền | Chữ / icon |
|---|---|---|---|
| Nút chính | `brandRed` | — | trắng |
| Nút phụ (outline) | trắng | `border` | `textStrong` |
| Nút tối (hành động phụ nổi bật, vd "Kết thúc phiên quét") | `textStrong` `#191C1E` | — | trắng |
| Dải lỗi / cảnh báo | `accentSoft` | `accentSoftBorder` | `danger` |
| Dải thành công | `successSoft` | — | `success` |
| Badge thương hiệu (vd "Xưởng phụ trách") | `accentSoft` | — | `brandRed` |
| Đã quét OK | — | — | icon `success` |
| Chưa quét | — | — | icon `textMuted` (Circle rỗng) |
| NG | — | — | icon `danger` |

---

## 3. Typography — font **Inter**

Web dùng Inter. Trên Flutter: thêm gói `google_fonts` (`GoogleFonts.interTextTheme()`) **hoặc** bundle file Inter vào `assets/fonts` (khuyến nghị bundle nếu app chạy mạng nội bộ không ra internet).

| Vai trò | Cỡ / độ đậm | Màu |
|---|---|---|
| Tiêu đề trang | 24 / w600 (màn nhỏ dùng 20) | `textStrong` |
| Tiêu đề modal | 18 / w600 | `textStrong` |
| Tiêu đề card / section | 16 / w600 | `textStrong` |
| Body, ô nhập, mục danh sách | 14 / w400–w600 | `textStrong` |
| Nhãn, mô tả | 14 | `textBody` |
| Caption, giờ quét | 12 | `textMuted` |
| Overline (tên nhóm "SERVER", "NETWORK"…) | 12 / w600, **IN HOA**, letterSpacing ≈ 1.8 (0.15em) | `textBody` |

Chữ chính trong danh sách (mã thiết bị) `w600 textStrong`; phần phụ (tên, giờ) nhạt hơn.

---

## 4. Khoảng cách · Bo góc · Đổ bóng

```dart
class AppSpacing {
  static const xs = 4.0, sm = 8.0, md = 12.0, lg = 16.0, xl = 24.0, xxl = 32.0;
}
class AppRadius {
  static const card   = 12.0; // card, section, dialog, sheet
  static const control= 8.0;  // nút, ô nhập, nav item
  static const small  = 6.0;  // nút nhỏ OK/NG, tag nhỏ
  static const pill   = 999.0;// badge trạng thái, chấm
}
```

- Lề màn hình: ngang **16** (mobile), dọc trên 16 / dưới 24. Khoảng cách giữa các khối: **16–24** (web `space-y-6` = 24, danh sách card `space-y-4` = 16).
- Padding trong card: **16–24**; dòng danh sách: ngang 16, dọc 12.
- Card: `Color(surface)`, viền 1px `border`, `borderRadius 12`, bóng rất nhẹ (`BoxShadow(color: Colors.black.withOpacity(0.04), blurRadius: 2, offset: Offset(0,1))`). Dialog: bóng lớn hơn một chút (`blurRadius 24, opacity 0.12`).
- Không dùng `elevation` của Material mặc định (đổ bóng + tint tím). Đặt `surfaceTintColor: Colors.transparent`.

---

## 5. `ThemeData` gợi ý

```dart
ThemeData buildAppTheme() {
  final base = ThemeData(
    useMaterial3: true,
    scaffoldBackgroundColor: AppColors.background,
    colorScheme: const ColorScheme.light(
      primary: AppColors.brandRed,
      onPrimary: Colors.white,
      error: AppColors.danger,
      surface: AppColors.surface,
      onSurface: AppColors.textStrong,
      outline: AppColors.border,
    ),
    dividerColor: AppColors.border,
  );

  return base.copyWith(
    textTheme: GoogleFonts.interTextTheme(base.textTheme).apply(
      bodyColor: AppColors.textStrong,
      displayColor: AppColors.textStrong,
    ),
    appBarTheme: const AppBarTheme(
      backgroundColor: Colors.white,
      foregroundColor: AppColors.textStrong,
      elevation: 0,
      scrolledUnderElevation: 0,
      surfaceTintColor: Colors.transparent,
      shape: Border(bottom: BorderSide(color: AppColors.border)),
    ),
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        backgroundColor: AppColors.brandRed,
        foregroundColor: Colors.white,
        disabledBackgroundColor: AppColors.brandRed.withOpacity(0.5),
        disabledForegroundColor: Colors.white,
        elevation: 0,
        minimumSize: const Size(0, 44),
        padding: const EdgeInsets.symmetric(horizontal: 20),
        textStyle: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppRadius.control)),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: AppColors.textStrong,
        backgroundColor: Colors.white,
        side: const BorderSide(color: AppColors.border),
        minimumSize: const Size(0, 44),
        textStyle: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppRadius.control)),
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: Colors.white,
      contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
      hintStyle: const TextStyle(color: AppColors.textMuted, fontSize: 14),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(AppRadius.control),
        borderSide: const BorderSide(color: AppColors.border),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(AppRadius.control),
        borderSide: const BorderSide(color: AppColors.border),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(AppRadius.control),
        borderSide: const BorderSide(color: AppColors.brandRed, width: 1.5),
      ),
    ),
    cardTheme: CardThemeData(
      color: Colors.white,
      elevation: 0,
      surfaceTintColor: Colors.transparent,
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppRadius.card),
        side: const BorderSide(color: AppColors.border),
      ),
    ),
    dialogTheme: DialogThemeData(
      backgroundColor: Colors.white,
      surfaceTintColor: Colors.transparent,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppRadius.card),
        side: const BorderSide(color: AppColors.border),
      ),
    ),
    snackBarTheme: SnackBarThemeData(
      behavior: SnackBarBehavior.floating,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppRadius.control)),
    ),
  );
}
```

> Tên class theme (`CardThemeData`/`DialogThemeData`) tuỳ phiên bản Flutter — nếu SDK cũ hơn dùng `CardTheme`/`DialogTheme`. Giữ **giá trị**, đừng đổi.
> Ô nhập khi focus web còn có vòng mờ `focusRing #FFE0E3` quanh ô. Nếu muốn giống hẳn, bọc `TextField` trong `Container` có `BoxShadow(color: focusRing, spreadRadius: 3)` khi đang focus; không bắt buộc.

---

## 6. Component tái sử dụng

### 6.1 Nút
| Biến thể | Dùng khi | Spec |
|---|---|---|
| **Primary** | Hành động chính (Bắt đầu phiên quét, Xác nhận kết thúc) | nền `brandRed`, chữ trắng, cao 44–48, bo 8, `w600 14` |
| **Outline** | Hành động phụ (Huỷ, Kiểm tra lại) | nền trắng, viền `border`, chữ `textStrong` |
| **Tối** | Hành động kết thúc nổi bật ở thanh đáy (Kết thúc phiên quét) | nền `#191C1E`, chữ trắng |
| **Danger** | Xoá/nguy hiểm | nền `danger`, chữ trắng |

Nút đang xử lý: giữ nguyên chữ hoặc đổi chữ ("Đang bắt đầu...", "Đang kết thúc...") + vô hiệu hoá, không đổi màu nền khác.
Trên mobile: nút chính **cao ≥ 48, full width** ở màn hình trạng thái trống.

### 6.2 Card
Trắng, viền 1px `border`, bo 12, padding 16. Card nhóm thiết bị = **header** (nền `background` `#F8FAFC`, chữ overline, đường kẻ dưới) + danh sách hàng phân cách bằng đường `borderSoft`, bo 12 và cắt nội dung theo bo (`clipBehavior: Clip.antiAlias`).

### 6.3 Badge / pill
- **Badge thương hiệu** ("Xưởng phụ trách: DĨ AN"): pill (`radius 999`), nền `accentSoft`, chữ `brandRed` w600 12, padding 12×4, icon Building2 14px bên trái.
- **Trạng thái**: pill, mỗi trạng thái 1 bộ nền/chữ — `success` (`#E6F4EA`/`#1E7A34`), `danger` (`#FDE8E8`/`#930006`), `warning` (`#FFF8EE`/`#8A5A00`), `info` (`#E8F0FE`/`#1A56db`), `neutral` (`#F2F4F6`/`#5E3F3A`).

### 6.4 Dải thông báo (banner)
- Kết quả quét thành công: nền `successSoft`, chữ `success` w600 14, icon `CheckCircle2` 16, bo 8, padding 12×8.
- Kết quả quét lỗi / lỗi tải: nền `accentSoft`, viền `accentSoftBorder` (khi là khối lỗi), chữ `danger`, icon `XCircle`.

### 6.5 Ô nhập
Cao 40 (ô thường) / **56 cho ô quét**; nền trắng; viền `border`; bo 8; focus viền `brandRed`. Ô quét QR là điểm nhấn của màn hình: **viền 2px `brandRed`**, chữ 18 `w600`, bo 12.

### 6.6 Dialog / bottom sheet
Nền trắng, bo 12, viền `border`, header có đường kẻ dưới (padding 16×24), tiêu đề 18 w600, nút đóng icon `X` 20 màu `textBody`. Footer: đường kẻ trên, nút Huỷ (outline) + nút xác nhận (primary) căn phải, gap 12. Trên mobile ưu tiên **bottom sheet** cao tối đa ~85% màn hình, nội dung cuộn, footer cố định. Nền mờ `Colors.black.withOpacity(0.4)`.

### 6.7 Toast → SnackBar
Web dùng toast xanh/đỏ cho mọi thao tác. Trên Flutter dùng `SnackBar` floating: thành công nền `success`, lỗi nền `danger`, chữ trắng. Mọi thao tác ghi dữ liệu (bắt đầu, quét, kết thúc) **phải có** thông báo thành công **và** lỗi (lấy `message` từ envelope của server).

### 6.8 Loading / rỗng
- Đang tải toàn màn: `CircularProgressIndicator` nhỏ (16) màu `textBody` + chữ "Đang tải..." căn giữa (web: `Loader2` xoay).
- Nút đang xử lý: spinner 14 trong nút.
- Skeleton (nếu dùng): `#F1F5F9`, bo 4, nhấp nháy.

---

## 7. Đặc tả từng màn hình quét (khớp `ServerCheckScanPage.tsx`)

Nền màn hình `background #F8FAFC`, nội dung `max-width ≈ 672` (mobile = full width trừ lề 16), căn giữa.

### 7.1 Màn "Chưa được phân công xưởng"
Căn giữa dọc. Icon `ShieldAlert` 48 màu `danger` → tiêu đề "Chưa được phân công xưởng" (20 w600) → mô tả `textBody` 14 (xem chuỗi mục 8). **Không có nút bắt đầu**, không gọi `/today`, `/start`.

### 7.2 Màn "Chưa bắt đầu phiên hôm nay"
Căn giữa. Icon `QrCode` 48 `brandRed` → **badge xưởng** → tiêu đề "Quét kiểm tra Server hằng ngày" (20 w600) → mô tả `textBody` → nút **Primary** "Bắt đầu phiên quét" (bo 8, padding 24×12).

### 7.3 Màn đang quét (màn chính)
Thứ tự từ trên xuống:
1. Badge xưởng + tiêu đề 20 w600 + mô tả "Quét mã QR dán trên từng thiết bị…" (`textBody` 14).
2. **Ô quét** luôn tự focus, viền đỏ 2px, cao 56 (xem 6.5). Bên dưới là banner kết quả lần quét gần nhất (xanh: `{DeviceCode} - {DeviceName}`; đỏ: thông báo lỗi). Sau mỗi lần quét: xoá ô, focus lại (ưu tiên máy quét gõ phím + Enter).
3. **Thanh tiến độ**: hộp bo 8, nền `background`, viền `border`, chữ trái "Tiến độ quét" w600, chữ phải `scanned/total` `brandRed` w600 — `scannedCount`/`totalCount` của server **chỉ đếm máy `requiresScan=true`** (máy IDR), đừng tự đếm từ `items.length`.
4. **Card theo nhóm thiết bị — CHỈ máy `requiresScan=true`** (thứ tự: Server → Network → UPS; ẩn nhóm rỗng; không còn nhóm Máy lạnh): header overline (12 w600 IN HOA, spacing 0.15em, `textBody`, nền `background`), mỗi hàng: trái `deviceCode - deviceName` (14 w600 `textStrong`, ellipsis) + giờ quét (12 `textMuted`, chỉ khi đã quét); phải icon 20 — **đã quét** `CheckCircle2` `success`, **chưa quét** `Circle` `textMuted`.
4b. **Khối "Tự kiểm tra"** (chỉ hiện khi có item `requiresScan=false`; đặt **dưới** các card quét): 1 card giống card nhóm, header overline có icon `Wifi` 14 + `"Tự kiểm tra ({count} thiết bị)"`; dòng mô tả 12 `textMuted` `"Không cần quét QR — hệ thống tự ping khi bạn kết thúc phiên."` (viền dưới `#F1F5F9`); mỗi hàng: trái `deviceCode - deviceName` (14 `textStrong`, ellipsis), phải `categoryText` 12 `textMuted`. **Không có** icon tròn/tick trạng thái, không tương tác được (không quét được máy này — server trả 400).
5. **Thanh đáy cố định** (`bottomNavigationBar`): nền trắng, viền trên `border`, bóng nhẹ hướng lên; trái chữ "Còn N thiết bị chưa quét" / "Đã quét đủ toàn bộ thiết bị" (`textBody` 14; N = số máy `requiresScan=true` còn `status=0`, không tính máy tự ping); phải nút **Tối** "Kết thúc phiên quét". Chừa padding dưới danh sách ≥ 96 để không bị che.

### 7.4 Màn "Đã hoàn thành hôm nay"
Căn giữa. Icon `CheckCircle2` 48 `success` → badge xưởng → "Đã hoàn thành kiểm tra hôm nay" (20 w600) → "Đã quét {scanned}/{total} thiết bị. Kết thúc bởi {by}." (`textBody` 14). Không cho quét/kết thúc thêm.

### 7.5 Dialog "Kết thúc phiên quét"
Bottom sheet/dialog theo 6.6. Thân cuộn, các khối cách nhau 24:
- **Thông báo tự ping** (chỉ khi còn item `requiresScan=false` có `status=0`): hộp nền `background`, viền `border`, bo 8, padding 12, chữ `textBody` 14 `"{count} thiết bị không cần quét sẽ được hệ thống tự ping khi bấm xác nhận (có thể mất vài chục giây)."` — đặt trên cùng thân dialog.
- **Thiết bị chưa quét** (chỉ khi còn **máy `requiresScan=true`** chưa quét; máy tự ping KHÔNG hiện ở đây): tiêu đề `"{count} thiết bị chưa quét — vui lòng ghi chú lý do"` màu `danger` w600 14. Mỗi thiết bị 1 thẻ nền `accentSoft`, viền `accentSoftBorder`, bo 8, padding 12: tên (`deviceCode - deviceName`, w600) + ô nhập ghi chú cao 36 (placeholder "Ghi chú vấn đề (không bắt buộc)...").
- **Kiểm tra network** (chỉ với mục `usesNetworkPing = true`): tiêu đề w600 + nút **Tối nhỏ** (nền `#191C1E`, chữ trắng 12 w600, icon `Wifi` 14, bo 6) "Kiểm tra network" / "Kiểm tra lại"; đang gọi: "Đang kiểm tra...". Kết quả: hộp nền `background`, viền `border`, bo 8, dòng đầu `"{reachable}/{total} IP phản hồi"` — xanh `success` nếu tất cả phản hồi, đỏ `danger` nếu không; danh sách IP lỗi mỗi dòng icon `XCircle` 14 + `"{deviceCode} ({ipAddress})"` màu `danger`.
- **Mục kiểm tra thủ công** (gồm cả **"Máy lạnh"** — mục thường như các mục khác, dựng động theo `manualResults`; máy lạnh không còn là thiết bị trong `items`): mỗi mục 1 thẻ nền trắng, viền `border`, bo 8, padding 12. Dòng trên: tên mục (w600 14) — phải là **2 nút OK / NG** (bo 6, padding 12×4, chữ 12 w600): đang chọn OK → nền `success` chữ trắng; đang chọn NG → nền `danger` chữ trắng; chưa chọn → nền `surfaceMuted #F1F5F9` chữ `textBody`. Bên dưới ô ghi chú cao 36 (hiện khi cần).
- Footer: "Huỷ" (outline) + "Xác nhận kết thúc" (primary; đang gửi: "Đang kết thúc..."). Chỉ cho xác nhận khi đã chọn OK/NG **đủ toàn bộ** mục thủ công.
- **`POST /end` chậm** (server ping các máy tự-ping trong request, ~10–60s): khi đang gửi phải **khoá cả 2 nút + không cho đóng dialog bằng chạm nền/back**, nút chính hiện spinner + "Đang kết thúc...", và `receiveTimeout` của request này ≥ 120s.

---

## 8. Chuỗi tiếng Việt (giữ nguyên để khớp web)

| Ngữ cảnh | Chuỗi |
|---|---|
| Tiêu đề màn quét | Quét kiểm tra Server hằng ngày |
| Mô tả | Quét mã QR dán trên từng thiết bị để ghi nhận đã kiểm tra. |
| Đang tải | Đang tải... |
| Chưa bắt đầu | Chưa bắt đầu phiên kiểm tra hôm nay. Bấm nút bên dưới để bắt đầu quét. |
| Nút bắt đầu / đang | Bắt đầu phiên quét / Đang bắt đầu... |
| Bắt đầu OK / lỗi | Bắt đầu phiên kiểm tra thành công. / Không thể bắt đầu phiên kiểm tra. |
| Placeholder ô quét | Quét mã QR thiết bị vào đây... |
| Lỗi quét (mặc định) | Không tìm thấy thiết bị hoặc thiết bị không thuộc phạm vi kiểm tra hôm nay. |
| Tiến độ | Tiến độ quét |
| Còn chưa quét | Còn {count} thiết bị chưa quét |
| Đã đủ | Đã quét đủ toàn bộ thiết bị |
| Khối tự kiểm tra | Tự kiểm tra ({count} thiết bị) |
| Mô tả tự kiểm tra | Không cần quét QR — hệ thống tự ping khi bạn kết thúc phiên. |
| Thông báo trong dialog | {count} thiết bị không cần quét sẽ được hệ thống tự ping khi bấm xác nhận (có thể mất vài chục giây). |
| Nút kết thúc | Kết thúc phiên quét |
| Tiêu đề dialog | Kết thúc phiên quét |
| Xác nhận / đang | Xác nhận kết thúc / Đang kết thúc... |
| Kết thúc OK / lỗi | Kết thúc phiên kiểm tra thành công. / Không thể kết thúc phiên kiểm tra. |
| Nhóm chưa quét | {count} thiết bị chưa quét — vui lòng ghi chú lý do |
| Placeholder ghi chú | Ghi chú vấn đề (không bắt buộc)... |
| Nhóm thủ công | Các mục kiểm tra thủ công |
| Nhóm network | Kiểm tra network |
| Nút ping | Kiểm tra network / Kiểm tra lại / Đang kiểm tra... |
| Tóm tắt ping | {reachable}/{total} IP phản hồi |
| Lỗi ping | Không thể kiểm tra network. |
| Hoàn thành | Đã hoàn thành kiểm tra hôm nay |
| Hoàn thành (chi tiết) | Đã quét {scanned}/{total} thiết bị. Kết thúc bởi {by}. |
| Chưa phân công | Chưa được phân công xưởng |
| Mô tả chưa phân công | Tài khoản của bạn chưa được phân công xưởng kiểm tra server. Vui lòng liên hệ Admin để được phân công. |
| Nhãn xưởng | Xưởng phụ trách |
| Tên nhóm | Server · Network · UPS |
| Mục thủ công máy lạnh | Máy lạnh (lấy nguyên `manualItemName` từ server) |

Chuỗi lỗi ưu tiên lấy `message` từ envelope server; chỉ dùng chuỗi mặc định ở trên khi không có.

---

## 9. Bảng quy đổi icon (Lucide)

Dùng gói Flutter `lucide_icons` (hoặc `lucide_icons_flutter`). Cỡ: trong nút/nhãn nhỏ 14, cạnh chữ 16, nút đóng dialog 20, icon lớn giữa màn hình 48.

| Ý nghĩa | Lucide |
|---|---|
| Màn quét / QR | `qr-code` |
| Đã quét OK | `check-circle-2` |
| Chưa quét | `circle` |
| NG / lỗi | `x-circle` |
| Xưởng | `building-2` |
| Chưa phân công / chặn | `shield-alert` |
| Ping network | `wifi` |
| Đóng dialog | `x` |
| Đang tải | vòng xoay (`CircularProgressIndicator`) |

---

## 10. Điều cần tránh

- ❌ Màu nhấn khác đỏ YEV (xanh dương/tím/indigo) hoặc gradient.
- ❌ Dùng đỏ thương hiệu `#E3000F` cho trạng thái lỗi — lỗi dùng `#930006`.
- ❌ `elevation` Material mặc định / surface tint tím (M3) — đặt `surfaceTintColor: transparent`.
- ❌ Bo góc khác thang 12 / 8 / 6 / pill; card vuông cứng.
- ❌ Emoji hoặc ký tự (`✓ ✕ ⚠`) làm icon.
- ❌ Hardcode mã hex trong widget — luôn qua `AppColors`.
- ❌ Cho người quét **chọn xưởng** — xưởng lấy từ `GET /api/ServerCheckAssignment/me` (xem API guide §6.0), chỉ hiển thị badge.

---

## 11. Checklist trước khi báo xong

- [ ] Có `AppColors`/`AppSpacing`/`AppRadius` + `buildAppTheme()`; không còn hex rải rác.
- [ ] Font Inter (bundle hoặc `google_fonts`), tiêu đề w600, caption 12 `textMuted`.
- [ ] Nút chính đỏ `#E3000F`; NG/lỗi `#930006`; OK `#1A7F37`; không có indigo.
- [ ] Card trắng viền `#E0E3E5` bo 12; danh sách nhóm có header overline.
- [ ] Ô quét viền đỏ 2px, luôn focus, tự xoá + focus lại sau mỗi lần quét.
- [ ] Màn quét CHỈ liệt kê máy `requiresScan=true`; máy `false` nằm ở khối "Tự kiểm tra" không có trạng thái; tiến độ dùng `scannedCount/totalCount` của server.
- [ ] Dialog kết thúc: có dòng báo tự ping, khoá nút khi đang gửi, timeout ≥ 120s; "Máy lạnh" render như mục thủ công thường.
- [ ] Đủ 5 trạng thái màn: chưa phân công · chưa bắt đầu · đang quét · hoàn thành · dialog kết thúc.
- [ ] Thanh đáy cố định có nút "Kết thúc phiên quét", danh sách có padding dưới đủ lớn.
- [ ] Mọi thao tác ghi có SnackBar thành công + lỗi; dùng đúng chuỗi mục 8.
- [ ] So sánh trực quan với web: mở `http://10.45.1.181:3000/vi/pc/server-check/scan` cạnh app trên cùng 1 tài khoản.
