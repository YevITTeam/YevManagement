# YevUsbAgent

Windows Service chạy trên PC, ghi log thao tác với ổ USB (cắm/rút, tạo/sửa/xoá/đổi tên file) rồi gửi về `POST /api/UsbLog/ingest` của YevManagement. Chỉ **giám sát**, không chặn. Nghiệp vụ và API: `docs/docs-be/asset-module.md §1.24`.

## Cách hoạt động
- Cứ `PollSeconds` giây hỏi WMI các đĩa (`Win32_DiskDrive`) đang có ký tự ổ và nằm dưới một nút USB trong cây thiết bị PnP (`UsbTopology`). Không dựa vào `InterfaceType` vì ổ UASP báo SCSI. Ổ mới → mở phiên + `FileSystemWatcher` trên ổ; ổ biến mất → đóng phiên.
- Sự kiện ghi vào `%ProgramData%\YevUsbAgent\queue.jsonl`; `Uploader` gửi theo lô mỗi `UploadSeconds` giây, thành công mới xoá khỏi hàng đợi (mất mạng/restart không mất log).
- Xác thực bằng header `X-Agent-Key` = `UsbAgent:ApiKey` trong `appsettings.json` của BE (để trống = BE từ chối mọi agent).
- Tên máy gửi lên là `Environment.MachineName`; BE đổi ra mã máy (`ComputerNameParser`) rồi khớp `Device.DeviceCode`.

## Giới hạn
- Chỉ thấy **ghi vào USB** (copy máy → USB, sửa, xoá, đổi tên). Copy/mở từ USB vào máy không có log.
- Ổ đang cắm sẵn lúc agent khởi động được tính là phiên mới từ thời điểm đó.
- Bỏ qua file tạm/khoá (`~$*`, `*.tmp`, `Thumbs.db`...); lưu qua file tạm được ghi là "Sửa".
- Máy tắt đột ngột thì không có sự kiện rút; lần khởi động sau agent đóng phiên cũ (`active-sessions.txt`), giờ rút ghi là giờ khởi động lại.
- Điện thoại (MTP) không phải ổ đĩa nên không được ghi.

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

Chạy lại lệnh cài để nâng cấp tại chỗ. `--server-url` / `--api-key` bỏ trống thì lấy từ bản nhúng; không có nữa thì hỏi (chỉ khi có người ở máy, chạy ngầm sẽ báo lỗi thiếu ApiKey). Có thể thêm `--install-dir "<thư mục>"` (mặc định `C:\Program Files\YevUsbAgent`). File cấu hình sau khi cài chỉ SYSTEM và Administrators đọc được. Log cài đặt ở `%ProgramData%\YevUsbAgent\install.log`; log dịch vụ ở Windows Event Viewer (Application, nguồn `YevUsbAgent`).

**Qua Tanium** (tên menu tuỳ phiên bản Tanium):
1. Tải `dist\YevUsbAgent.exe` lên làm file của package.
2. Lệnh của package: `YevUsbAgent.exe --install --silent --server-url "http://10.45.1.49:8080" --api-key "<khoá>"` (nếu đã nhúng bằng `-ApiKey` thì chỉ cần `YevUsbAgent.exe --install --silent`). Nên đặt khoá làm tham số của package thay vì ghi cứng.
3. Deploy lên nhóm máy; chạy dưới SYSTEM nên không có UAC. Thử trước trên 1 máy.
4. Kiểm tra: `Get-Service YevUsbAgent` trên máy đích hoặc hỏi Tanium về service đó; xem `install.log` nếu lỗi.

Chạy thử không cài dịch vụ: `YevUsbAgent.exe --run` hoặc `dotnet run -- --run` (đặt `Agent__ServerUrl`, `Agent__ApiKey`, `Agent__DataDir` bằng biến môi trường).
