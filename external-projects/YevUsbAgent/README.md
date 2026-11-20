# YevUsbAgent

Windows Service chạy trên PC: ghi log thao tác với ổ USB (cắm/rút, tạo/sửa/xoá/đổi tên file), thẻ SD gắn trong máy, cắm/rút điện thoại/máy ảnh, gửi về `POST /api/UsbLog/ingest`; khi web bật chế độ **Chặn** thì chuyển USB chưa cấp phép sang **chỉ đọc**. Nghiệp vụ và API: `docs/docs-be/asset-module.md §1.24`.

## Cách hoạt động
- Sự kiện thiết bị của Windows (`Win32_DeviceChangeEvent`) kích quét ngay; ngoài ra cứ `PollSeconds` giây hỏi WMI các đĩa (`Win32_DiskDrive`) đang có ký tự ổ và nằm dưới một nút USB trong cây thiết bị PnP (`UsbTopology`). Không dựa vào `InterfaceType` vì ổ UASP báo SCSI. Ổ mới → mở phiên + `FileSystemWatcher` trên ổ; ổ biến mất → đóng phiên.
- Thẻ SD trong khe đọc gắn trong máy (không qua USB): đĩa báo `Removable Media`, gửi với VID `SD`, PID `0000`. Điện thoại/máy ảnh/máy scan (`Win32_PnPEntity` lớp `WPD`/`Image`, cha là USB): chỉ ghi cắm/rút, quét mỗi 5 lần poll hoặc khi có sự kiện thiết bị.
- **Chặn ghi:** `PolicySync` gọi `POST /api/UsbLog/agent-sync` mỗi `SyncSeconds` (60) giây, vừa báo agent còn sống (phiên bản, user) vừa lấy chế độ + danh sách USB đã cấp phép, lưu vào `policy.json` (dùng tiếp khi mất mạng; chưa sync lần nào = Tắt). Ở chế độ Chặn, USB chưa cấp phép (hoặc không có serial) bị đặt thuộc tính chỉ đọc cho cả ổ (`MSFT_Disk.SetAttributes`, lỗi thì `diskpart`), dismount để mount lại chỉ đọc, rồi hiện thông báo toast góc phải cho người đang đăng nhập (PowerShell chạy trong phiên của họ, AppUserModelId `YEV.UsbAgent`). Không xoá file nào. Ổ do agent khoá ghi vào `locked-disks.txt` và chỉ những ổ đó mới được mở lại khi cấp phép/tắt chặn. Chính sách đổi khi USB đang cắm: áp ở lần quét kế tiếp (agent tạm tắt bộ theo dõi file của chính nó để khoá được ổ); cần khoá mà ổ đang có file mở thì hiện thông báo nhắc lưu/đóng file, sau 1 phút khoá luôn. Mở khoá thì làm ngay. Ở chế độ Thử chỉ ghi "Chưa cấp phép", không khoá. Kết quả gửi kèm phiên (`policyResult`).
- Sự kiện ghi vào `%ProgramData%\YevUsbAgent\queue.jsonl`; `Uploader` gửi theo lô mỗi `UploadSeconds` giây, thành công mới xoá khỏi hàng đợi (mất mạng/restart không mất log).
- Xác thực bằng header `X-Agent-Key` = `UsbAgent:ApiKey` trong `appsettings.json` của BE (để trống = BE từ chối mọi agent).
- Tên máy gửi lên là `Environment.MachineName`; BE đổi ra mã máy (`ComputerNameParser`) rồi khớp `Device.DeviceCode`.

## Giới hạn
- Chỉ thấy **ghi vào USB** (copy máy → USB, sửa, xoá, đổi tên). Copy/mở từ USB vào máy không có log.
- Từ lúc ổ mount tới lúc khoá có một khoảng rất ngắn (thường dưới 1–2 giây); chép đúng lúc đó có thể lọt. Agent bị dừng thì không chặn (tab Agent trên web hiện máy mất liên lạc quá 24 giờ). Người có quyền admin trên máy tự gỡ được thuộc tính chỉ đọc.
- Hàng đợi quá 50 MB (mất mạng lâu) thì bỏ sự kiện file, vẫn giữ cắm/rút.
- Chép hàng loạt làm tràn bộ đệm theo dõi: agent quét lại ổ một lần, ghi các file tạo/sửa từ lúc cắm mà chưa ghi.
- Ổ đang cắm sẵn lúc agent khởi động được tính là phiên mới từ thời điểm đó.
- Bỏ qua file tạm/khoá (`~$*`, `*.tmp`, `*.part`, `._*`, `Thumbs.db`...); lưu qua file tạm được ghi là "Sửa".
- Máy tắt đột ngột thì không có sự kiện rút; lần khởi động sau agent đóng phiên cũ (`active-sessions.txt`), giờ rút ghi là giờ khởi động lại.
- Điện thoại (MTP) không phải ổ đĩa: chỉ ghi cắm/rút, không thấy file, không chặn.

## Đóng gói: một file exe
```powershell
.\scripts\build.ps1 -ApiKey "<UsbAgent:ApiKey của BE>"   # -> dist\YevUsbAgent.exe (~38 MB, không cần cài .NET)
```
`YevUsbAgent.exe` vừa là agent vừa là bộ cài (chứa sẵn `install.ps1`/`uninstall.ps1`). Có `-ApiKey` thì địa chỉ server (`-ServerUrl`, mặc định `http://10.45.1.49:8080`) và khoá được nhúng vào exe nên cài không phải nhập gì, nhưng exe đó chứa khoá, đừng đưa ra ngoài mạng nội bộ. Bỏ `-ApiKey` thì lúc cài phải nhập hoặc truyền khoá.

## Cài đặt
| Cách | Lệnh |
|---|---|
| **Bấm đúp** | Bấm đúp `YevUsbAgent.exe` → đồng ý hộp thoại quyền Administrator (UAC) → đợi "Xong." → Enter |
| **Dòng lệnh / Tanium** (SYSTEM) | `YevUsbAgent.exe --install --silent --server-url "http://10.45.1.49:8080" --api-key "<khoá>"` |
| **Gỡ** | `YevUsbAgent.exe --uninstall` (thêm `--silent` khi chạy ngầm). Xoá dịch vụ và thư mục cài; giữ hàng đợi chưa gửi trong `%ProgramData%\YevUsbAgent` |
| **Gỡ sạch** | `YevUsbAgent.exe --uninstall --purge`: thêm xoá `%ProgramData%\YevUsbAgent` (mất log chưa gửi) và nguồn Event Log. Gỡ bằng chính exe trong Program Files thì file exe được xoá ngay sau khi tiến trình thoát |

Chạy lại lệnh cài để nâng cấp tại chỗ. `--server-url` / `--api-key` bỏ trống thì lấy từ bản nhúng; không có nữa thì hỏi (chỉ khi có người ở máy, chạy ngầm sẽ báo lỗi thiếu ApiKey). Có thể thêm `--install-dir "<thư mục>"` (mặc định `C:\Program Files\YevUsbAgent`). File cấu hình và thư mục `%ProgramData%\YevUsbAgent` sau khi cài chỉ SYSTEM và Administrators đọc/sửa được (để người dùng không sửa được `policy.json`). Log cài đặt ở `%ProgramData%\YevUsbAgent\install.log`; log dịch vụ ở Windows Event Viewer (Application, nguồn `YevUsbAgent`).

**Qua Tanium** (tên menu tuỳ phiên bản Tanium):
1. Tải `dist\YevUsbAgent.exe` lên làm file của package.
2. Lệnh của package: `YevUsbAgent.exe --install --silent --server-url "http://10.45.1.49:8080" --api-key "<khoá>"` (nếu đã nhúng bằng `-ApiKey` thì chỉ cần `YevUsbAgent.exe --install --silent`). Nên đặt khoá làm tham số của package thay vì ghi cứng.
3. Deploy lên nhóm máy; chạy dưới SYSTEM nên không có UAC. Thử trước trên 1 máy.
4. Kiểm tra: `Get-Service YevUsbAgent` trên máy đích hoặc hỏi Tanium về service đó; xem `install.log` nếu lỗi.

Chạy thử không cài dịch vụ: `YevUsbAgent.exe --run` hoặc `dotnet run -- --run` (đặt `Agent__ServerUrl`, `Agent__ApiKey`, `Agent__DataDir` bằng biến môi trường).
