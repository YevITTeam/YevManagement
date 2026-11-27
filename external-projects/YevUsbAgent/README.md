# YevUsbAgent

Windows Service chạy trên PC: ghi log thao tác với ổ USB (cắm/rút, tạo/sửa/xoá/đổi tên file), thẻ SD gắn trong máy, cắm/rút điện thoại/máy ảnh, gửi về `POST /api/UsbLog/ingest`; khi web bật chế độ **Chặn** thì **chặn hẳn** USB chưa cấp phép và để USB cấp phép chỉ đọc ở **chỉ đọc**. Nghiệp vụ và API: `docs/docs-be/asset-module.md §1.24`.

## Cách hoạt động
- Sự kiện thiết bị của Windows (`Win32_DeviceChangeEvent`) kích quét ngay; ngoài ra cứ `PollSeconds` giây hỏi WMI các đĩa (`Win32_DiskDrive`) đang có ký tự ổ và nằm dưới một nút USB trong cây thiết bị PnP (`UsbTopology`). Không dựa vào `InterfaceType` vì ổ UASP báo SCSI. Ổ mới → mở phiên + `FileSystemWatcher` trên ổ; ổ biến mất → đóng phiên.
- Thẻ SD trong khe đọc gắn trong máy (không qua USB): đĩa báo `Removable Media`, gửi với VID `SD`, PID `0000`. Điện thoại/máy ảnh/máy scan (`Win32_PnPEntity` lớp `WPD`/`Image`/`AndroidUsbDeviceClass` hoặc dịch vụ MTP/PTP, cha là USB): ghi cắm/rút; ở chế độ Chặn, điện thoại/máy ảnh chưa cấp phép bị tắt các nút truyền file (MTP/PTP/ADB, vẫn sạc pin), máy scan không bị chặn; quét mỗi 5 lần poll hoặc khi có sự kiện thiết bị.
- **Chặn:** `PolicySync` gọi `POST /api/UsbLog/agent-sync` theo chu kỳ web đặt (`syncSeconds`, 15–600; chưa sync lần nào thì `SyncSeconds` = 60), vừa báo agent còn sống (phiên bản, user) vừa lấy chế độ, danh sách USB cấp phép đọc-ghi và chỉ đọc, công tắc log chép vào máy, mật khẩu gỡ (dạng băm) và bản cập nhật nếu có; lưu vào `policy.json` (dùng tiếp khi mất mạng; chưa sync lần nào = Chặn tất cả, chờ IT cấp phép). Ở chế độ Chặn, USB **chưa cấp phép** (hoặc không có serial) bị **chặn hẳn**: ngắt volume (dismount + offline) rồi `pnputil /disable-device` ổ đĩa; Windows nhớ trạng thái tắt nên cắm lại vẫn bị chặn; ổ đã tắt ghi vào `blocked-disks.json` để bật lại khi cấp phép, chuyển Thử/Tắt hoặc gỡ agent. Không tắt được thì chặn ghi rồi thử tắt lại mỗi 30 giây khi ổ còn cắm; thẻ SD trong khe gắn sẵn thì chặn ghi rồi ngắt volume. USB **cấp phép chỉ đọc** bị đặt thuộc tính chỉ đọc cho cả ổ (`MSFT_Disk.SetAttributes`, lỗi thì `diskpart`) rồi dismount để mount lại chỉ đọc. Sau đó hiện thông báo toast góc phải cho người đang đăng nhập (PowerShell chạy trong phiên của họ, AppUserModelId `YEV.UsbAgent`). Không xoá file nào. Ổ do agent khoá ghi vào `locked-disks.txt` và chỉ những ổ đó mới được mở lại.
- **Serial chung:** box ổ cứng báo serial của mạch chuyển đổi (giống nhau trên mọi box cùng loại) thì agent hỏi serial của ổ bên trong (`BridgedSerial`: ATA IDENTIFY qua SAT, lệnh riêng Realtek cho NVMe) và dùng serial đó; không đọc được thì gửi `sharedSerial=true`.
- **Vòng đời:** `Lifecycle` gửi Khởi động/Dừng/Dừng đột ngột (`running.flag` còn sót)/Cài đặt (`installed.json` do `install.ps1` ghi); bộ cài gửi Đã gỡ/Gỡ sai mật khẩu thẳng lên server.
- **Chép từ USB vào máy** (bật trên web): khi có USB đang cắm, `CopyInMonitor` theo dõi ổ cứng cố định và ghi file mới trùng kích thước + ngày sửa với một file trên USB. Chính sách đổi khi USB đang cắm: áp ở lần quét kế tiếp (agent tạm tắt bộ theo dõi file của chính nó để khoá được ổ); cần khoá mà ổ đang có file mở thì hiện thông báo nhắc lưu/đóng file, sau 1 phút khoá luôn. Mở khoá thì làm ngay. Ở chế độ Thử chỉ ghi "Chưa cấp phép", không khoá. Kết quả gửi kèm phiên (`policyResult`).
- Sự kiện ghi vào `%ProgramData%\YevUsbAgent\queue.jsonl`; `Uploader` gửi theo lô mỗi `UploadSeconds` giây, thành công mới xoá khỏi hàng đợi (mất mạng/restart không mất log).
- Xác thực bằng header `X-Agent-Key` = `UsbAgent:ApiKey` trong `appsettings.json` của BE (để trống = BE từ chối mọi agent).
- Tên máy gửi lên là `Environment.MachineName`; BE đổi ra mã máy (`ComputerNameParser`) rồi khớp `Device.DeviceCode`.

## Giới hạn
- Thấy **ghi vào USB** (copy máy → USB, sửa, xoá, đổi tên). Chép từ USB vào máy chỉ là đoán (khi bật): không thấy file mở thẳng trên USB, giải nén hay lưu lại bằng ứng dụng.
- Mật khẩu gỡ chỉ chặn đường gỡ chính thức; người có quyền admin trên máy vẫn tự xoá dịch vụ hoặc bật lại thiết bị trong Device Manager được.
- Từ lúc ổ mount tới lúc khoá có một khoảng rất ngắn (thường dưới 1–2 giây); chép đúng lúc đó có thể lọt. Agent bị dừng thì không chặn (tab Agent trên web hiện máy mất liên lạc quá 24 giờ). Người có quyền admin trên máy tự gỡ được thuộc tính chỉ đọc.
- Hàng đợi quá 50 MB (mất mạng lâu) thì bỏ sự kiện file, vẫn giữ cắm/rút.
- Chép hàng loạt làm tràn bộ đệm theo dõi: agent quét lại ổ một lần, ghi các file tạo/sửa từ lúc cắm mà chưa ghi.
- Ổ đang cắm sẵn lúc agent khởi động được tính là phiên mới từ thời điểm đó.
- Bỏ qua file tạm/khoá (`~$*`, `*.tmp`, `*.part`, `._*`, `Thumbs.db`...); lưu qua file tạm được ghi là "Sửa".
- Máy tắt đột ngột thì không có sự kiện rút; lần khởi động sau agent đóng phiên cũ (`active-sessions.txt`), giờ rút ghi là giờ khởi động lại.
- Điện thoại/máy ảnh (MTP/PTP) không phải ổ đĩa: chỉ ghi cắm/rút, không thấy file; chặn thì chặn cả thiết bị, không có chỉ đọc.
- **Bluetooth:** `BluetoothMonitor` quét `fsquirt.exe` mỗi giây; mỗi lần mở là 1 phiên `BT|0000|SEND`/`RECEIVE`. Ở chế độ Chặn, chiều gửi/nhận nào chưa được cấp phép cho máy ("Gửi file qua Bluetooth", "Nhận file qua Bluetooth") thì đóng trình + toast. Không ghi tên file; ứng dụng khác gửi qua Bluetooth (Phone Link…) không bị kiểm soát.
- **Thẻ SD trong khe gắn sẵn** bị chặn thì chặn ghi rồi ngắt volume (không đọc được); rút ra cắm lại thì chặn lại.

## Đóng gói: một file exe
```powershell
.\scripts\build.ps1 -ApiKey "<UsbAgent:ApiKey của BE>"   # -> dist\YevUsbAgent.exe (~38 MB, không cần cài .NET)
```
`YevUsbAgent.exe` vừa là agent vừa là bộ cài (chứa sẵn `install.ps1`/`uninstall.ps1`). Có `-ApiKey` thì địa chỉ server (`-ServerUrl`, mặc định `http://10.45.1.49:8080`) và khoá được nhúng vào exe nên cài không phải nhập gì, nhưng exe đó chứa khoá, đừng đưa ra ngoài mạng nội bộ. Bỏ `-ApiKey` thì lúc cài phải nhập hoặc truyền khoá.

Bản tự cập nhật do **BE ký** khi upload, bằng khoá riêng ở `App_Data\usb-agent-update-key.xml` của BE; agent chỉ cài bản có chữ ký khớp khoá công khai trong `Update/UpdateKey.cs`. Khoá tạo **một lần** bằng `scripts\new-update-key.ps1` (in khoá công khai để dán vào `Update/UpdateKey.cs` và `Asset.Application/Services/UsbAgentReleaseKey.cs`), chép file khoá riêng vào `App_Data` của BE và giữ bản sao ở nơi an toàn: mất khoá thì mọi agent phải cài lại qua Tanium với khoá mới.

## Tự cập nhật
1. Tăng `<Version>` trong `YevUsbAgent.csproj`, chạy `build.ps1` (không cần `-ApiKey`: bản tự cập nhật giữ `ServerUrl`/`ApiKey` của bản đang cài).
2. Web → Quản lý USB → tab Agent → "Bản agent" → tải `dist\YevUsbAgent.exe` lên (BE tự ký, phiên bản lấy từ exe).
3. Chọn "Tự cập nhật lên" = bản mới, "Máy nhận trước" = vài máy thử → Lưu. Xem cột Sự kiện/nhật ký các máy đó ("Cài đặt … (tự cập nhật)" rồi "Khởi động"), ổn thì xoá "Máy nhận trước" cho mọi máy cập nhật. Chọn lại bản cũ = rollback.
4. Agent tải bản đó, kiểm SHA-256 + chữ ký, chạy `exe --install --silent --self-update`; lỗi thì có sự kiện "Cập nhật lỗi" và 6 giờ sau mới thử lại.

## Cài đặt
| Cách | Lệnh |
|---|---|
| **Bấm đúp** | Bấm đúp `YevUsbAgent.exe` → đồng ý hộp thoại quyền Administrator (UAC) → đợi "Xong." → Enter |
| **Dòng lệnh / Tanium** (SYSTEM) | `YevUsbAgent.exe --install --silent --server-url "http://10.45.1.49:8080" --api-key "<khoá>"` |
| **Gỡ** | `YevUsbAgent.exe --uninstall` (thêm `--silent` khi chạy ngầm). Web có đặt mật khẩu gỡ thì hỏi mật khẩu, chạy ngầm phải thêm `--password "<mật khẩu>"` (sai → mã thoát 2). Bật lại các USB agent đã tắt, xoá dịch vụ và thư mục cài; giữ hàng đợi chưa gửi trong `%ProgramData%\YevUsbAgent` |
| **Gỡ sạch** | `YevUsbAgent.exe --uninstall --purge`: thêm xoá `%ProgramData%\YevUsbAgent` (mất log chưa gửi) và nguồn Event Log. Gỡ bằng chính exe trong Program Files thì file exe được xoá ngay sau khi tiến trình thoát |

Chạy lại lệnh cài để nâng cấp tại chỗ. `--server-url` / `--api-key` bỏ trống thì lấy từ bản nhúng; không có nữa thì hỏi (chỉ khi có người ở máy, chạy ngầm sẽ báo lỗi thiếu ApiKey). Có thể thêm `--install-dir "<thư mục>"` (mặc định `C:\Program Files\YevUsbAgent`). `ApiKey` trong `appsettings.json` và cả `policy.json` được mã hoá DPAPI phạm vi máy (`AgentSecret`, chép sang máy khác không đọc được); file cấu hình và thư mục `%ProgramData%\YevUsbAgent` sau khi cài chỉ SYSTEM và Administrators đọc/sửa được. Exe 1.3 không đọc được `policy.json` của 1.4, nên gỡ qua Tanium phải dùng exe ≥1.4 thì mới kiểm mật khẩu. Log cài đặt ở `%ProgramData%\YevUsbAgent\install.log`; log dịch vụ ở Windows Event Viewer (Application, nguồn `YevUsbAgent`).

**Qua Tanium** (tên menu tuỳ phiên bản Tanium):
1. Tải `dist\YevUsbAgent.exe` lên làm file của package.
2. Lệnh của package: `YevUsbAgent.exe --install --silent --server-url "http://10.45.1.49:8080" --api-key "<khoá>"` (nếu đã nhúng bằng `-ApiKey` thì chỉ cần `YevUsbAgent.exe --install --silent`). Nên đặt khoá làm tham số của package thay vì ghi cứng.
3. Deploy lên nhóm máy; chạy dưới SYSTEM nên không có UAC. Thử trước trên 1 máy.
4. Kiểm tra: `Get-Service YevUsbAgent` trên máy đích hoặc hỏi Tanium về service đó; xem `install.log` nếu lỗi.

Chạy thử không cài dịch vụ: `YevUsbAgent.exe --run` hoặc `dotnet run -- --run` (đặt `Agent__ServerUrl`, `Agent__ApiKey`, `Agent__DataDir` bằng biến môi trường).
