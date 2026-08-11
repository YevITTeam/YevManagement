# Hướng dẫn chuyển deploy từ IIS sang Docker Engine (Windows Server)

> **Trạng thái:** bản nháp kỹ thuật — Dockerfile/compose đã viết theo đúng cấu hình hiện có
> (`docs/deploy-config/config-be/web.config`, `config-fe/web.config`, `appsettings.json`,
> `Program.cs`), nhưng **chưa chạy thử trên Windows Server thật** (agent không có quyền truy cập
> server production). Bước gMSA đặc biệt cần Domain Admin và phải làm trên máy có quyền AD — hãy
> chạy thử ở môi trường staging trước khi thay hẳn IIS.
>
> IIS hiện tại (`docs/deploy-config/config-be`, `config-fe`, `AutoDeploy.ps1`) **giữ nguyên, không
> xoá** — chạy Docker song song ở port khác trước, xác nhận ổn rồi mới cắt DNS/port thật sang.

## 1. Vì sao phải dùng Windows container (không phải Linux)

BE dùng **Negotiate/NTLM (SSPI)** thật cho `/windows-login` (`AddNegotiate()` trong
`yev-backend/CompanySystem.HostApi/Configurations/Authentication.cs`) — cơ chế này chỉ chạy được
trên Windows, và để xác thực domain user (NTLM pass-through / Kerberos) container cần có identity
AD hợp lệ. Vì không được domain-join thẳng 1 container (container sinh/huỷ liên tục, join domain
mỗi lần là sai khuyến nghị của Microsoft), giải pháp chuẩn là **gMSA (group Managed Service
Account)** — xem mục 4.

Endpoint `/login` (username/password, validate qua `PrincipalContext.ValidateCredentials`) không
bắt buộc domain-join vì tự bind LDAP tới domain controller, nhưng vẫn cần container gọi được tới AD
qua mạng (port 389/636) — không có yêu cầu OS đặc biệt, chạy được cả trên Linux container nếu sau
này đổi ý bỏ Negotiate.

## 2. Bản đồ file mới tạo

```
docker-compose.yml                          # orchestrate 2 container: backend (8080), frontend (8000)
docker/
├─ backend.Dockerfile                       # multi-stage: sdk:10.0-windowsservercore -> aspnet:10.0-windowsservercore
├─ frontend.Dockerfile                      # windows/servercore/iis + URL Rewrite Module, copy out/ + web.config có sẵn
└─ build-and-run.ps1                        # pnpm build -> docker compose build -> up -d (thay AutoDeploy.ps1)
.dockerignore                               # loại appsettings*.json thật, bin/obj/node_modules... khỏi build context
```

Không đổi bất kỳ file source nào của BE/FE — chỉ đóng gói lại cách chạy.

## 3. Cài Docker Engine trên Windows Server (chưa cài — làm từ đầu)

Chạy trên chính Windows Server sẽ host container (PowerShell, quyền Administrator):

```powershell
# 1. Bật Windows feature Containers (cần restart)
Install-WindowsFeature -Name Containers -Restart

# 2. Sau khi restart, cài Docker Engine bằng script chính thức của Microsoft
#    (KHÔNG dùng Docker Desktop — không hỗ trợ trên Windows Server)
Invoke-WebRequest -UseBasicParsing `
    "https://raw.githubusercontent.com/microsoft/Windows-Containers/Main/helpful_tools/Install-DockerCE/install-docker-ce.ps1" `
    -OutFile install-docker-ce.ps1
.\install-docker-ce.ps1
# Script tự cài xong sẽ nhắc restart máy lần nữa nếu cần.

# 3. Xác nhận
docker version
docker run --rm mcr.microsoft.com/windows/nanoserver:ltsc2022 cmd /c echo OK
```

Nếu server dùng bản Windows Server "Desktop Experience" (full GUI) thay vì Server Core: Microsoft
khuyến nghị dùng Server Core cho container host, nhưng container **process isolation** (mặc định,
`--isolation=process`) vẫn chạy được trên Desktop Experience nếu build number của host và image
image trùng nhau (Windows Server 2022 host ↔ image tag `ltsc2022` — cả 2 Dockerfile trong repo này
đều dùng `ltsc2022`, khớp Windows Server 2022; nếu server là bản khác, đổi hết tag `ltsc2022` trong
2 Dockerfile cho khớp version host, hoặc build/run bằng `--isolation=hyperv`).

## 4. Thiết lập gMSA cho Negotiate SSO

Chỉ cần nếu muốn giữ `/windows-login` (SSO im lặng qua popup domain của trình duyệt). Cần chạy
trên máy có module `ActiveDirectory` + quyền tạo object trong AD (thường là Domain Admin), theo tài
liệu chính thức:
[Create gMSAs for Windows containers](https://learn.microsoft.com/en-us/virtualization/windowscontainers/manage-containers/manage-serviceaccounts) ·
[Run a container with a gMSA](https://learn.microsoft.com/en-us/virtualization/windowscontainers/manage-containers/gmsa-run-container).

```powershell
# --- Trên 1 Domain Controller (hoặc máy có RSAT-AD-PowerShell) ---
Import-Module ActiveDirectory

# Tạo KDS root key nếu domain chưa có (chỉ làm 1 lần cho cả domain, có thể đã có sẵn)
# Get-KdsRootKey  # kiểm tra trước, đừng tạo trùng
# Add-KdsRootKey -EffectiveTime ((Get-Date).AddHours(-10))

# Tạo gMSA - đổi tên/host cho khớp quy ước đặt tên nội bộ
New-ADServiceAccount -Name "yevmgmt-be-gmsa" `
    -DNSHostName "yevmgmt-be-gmsa.yev.vn" `
    -PrincipalsAllowedToRetrieveManagedPassword "<TÊN MÁY WINDOWS SERVER CHẠY DOCKER>$"

# --- Trên chính Windows Server chạy Docker ---
Install-WindowsFeature RSAT-AD-PowerShell
Import-Module ActiveDirectory
Test-ADServiceAccount -Identity "yevmgmt-be-gmsa"   # phải trả về True

# Sinh file credential spec JSON (module CredentialSpec, cài qua ContainerImageHelper hoặc
# tải trực tiếp CredentialSpec.psm1 từ Microsoft/Virtualization-Documentation nếu chưa có sẵn)
Import-Module CredentialSpec
New-CredentialSpec -AccountName "yevmgmt-be-gmsa"
Get-CredentialSpec   # xem đường dẫn file vừa tạo, mặc định C:\ProgramData\Docker\CredentialSpecs\
```

Đổi tên file JSON sinh ra thành đúng `yevmgmt-be-gmsa.json` (khớp `credentialspec=file://...` trong
`docker-compose.yml`), hoặc sửa lại tên trong `docker-compose.yml` cho khớp file thật.

**Nếu bỏ qua bước này:** xoá 2 dòng `security_opt` trong `docker-compose.yml` — container BE vẫn
chạy được, `/login` (username/password) vẫn hoạt động bình thường, chỉ `/windows-login` sẽ trả lỗi
xác thực Negotiate (401) vì container không có identity AD.

## 5. Chuẩn bị `appsettings.json` thật ngoài repo

`appsettings.json` (connection string, JWT secret, SMTP...) **không** được bake vào image
(`.dockerignore` loại nó khỏi build context, giống nguyên tắc cũ của `AutoDeploy.ps1`). Copy thủ
công file `appsettings.json` hiện đang chạy trên IIS (`D:\Deploy\publish_backend\appsettings.json`
theo `AutoDeploy.ps1`) sang một đường dẫn cố định, ví dụ `D:\Deploy\appsettings.json`, rồi:

```powershell
# Trỏ compose tới đúng đường dẫn nếu khác D:\Deploy\appsettings.json mặc định
$env:APPSETTINGS_PATH = "D:\Deploy\appsettings.json"
$env:BACKEND_LOGS_PATH = "D:\Deploy\logs"
```

(hoặc tạo file `.env` cạnh `docker-compose.yml` với 2 dòng `APPSETTINGS_PATH=...` /
`BACKEND_LOGS_PATH=...` — Docker Compose tự đọc `.env` cùng thư mục).

## 6. Build & chạy

```powershell
# Từ gốc repo, đã cài pnpm + Docker Engine
.\docker\build-and-run.ps1
```

Script này: `pnpm build` (sinh `yev-frontend/out/`) → `docker compose build` → `docker compose up
-d`. Kiểm tra:

```powershell
docker compose ps
docker compose logs -f backend     # theo dõi log BE thay cho .\logs\stdout của IIS
curl.exe http://localhost:8080/api/health   # hoặc bất kỳ endpoint GET công khai nào để thử
curl.exe http://localhost:8000/vi/          # trang chủ FE
```

Test đủ các luồng đã có trong skill `run-yevmanagement` (7 check read-only) nhắm vào port 8080 thay
vì port do `dotnet run` sinh ra, để xác nhận container BE hoạt động tương đương bản IIS.

## 7. Vận hành / cập nhật phiên bản mới (thay `AutoDeploy.ps1`)

`AutoDeploy.ps1` cũ dựa vào Task Scheduler polling thư mục `_Pending_*`. Với Docker, luồng đơn giản
hơn — build lại rồi chạy lại `build-and-run.ps1`:

```powershell
git pull
.\docker\build-and-run.ps1     # build image mới, `docker compose up -d` tự thay container cũ
```

`docker compose up -d` chỉ recreate container nào có image mới, container còn lại giữ nguyên
(không downtime cho service không đổi). Muốn rollback: `docker compose down`, sửa lại code /
`git checkout <commit cũ>`, chạy lại `build-and-run.ps1`, hoặc giữ image cũ bằng tag riêng
(`docker tag yevmanagement-backend:latest yevmanagement-backend:rollback` trước khi build bản mới).

## 8. Checklist trước khi cắt hẳn sang Docker (bỏ IIS)

1. `/login` (username/password) hoạt động đúng qua container — bắt buộc test trước.
2. Nếu giữ Negotiate: `/windows-login` xác thực được từ trình duyệt trong domain, gMSA
   `Test-ADServiceAccount` trả `True`.
3. 3 connection string (`PCManagementConnection`/`IdentityManagementConnection`/
   `OTManagementConnection`) tới `DASVRFAST` — container reach được (cùng mạng LAN, không cần đổi
   gì vì Windows container process-isolation dùng chung network stack kiểu NAT/host của Windows,
   không cách ly như Linux container).
4. Gửi email (SMTP `VNMAIL04.yev.vn:587`) và AI Chat (Ollama `10.45.6.70:11434`) container gọi
   được — cùng lý do mạng như trên, nhưng vẫn nên test tay 1 lần.
5. FE gọi đúng BE qua `NEXT_PUBLIC_API_URL` đã build (`yev-frontend/.env.production.local` hiện trỏ
   `http://10.45.1.49:8080/api` — build container dùng đúng giá trị này, đổi file đó nếu domain/IP
   thay đổi khi lên Docker).
6. CORS: whitelist trong `Program.cs` (`AllowNextJs`) đã có sẵn origin FE hiện tại — nếu đổi IP/port
   publish ra ngoài (khác `8000`), phải thêm origin mới vào đó và deploy lại BE.
7. Windows Firewall trên server: mở inbound cho port `8080`/`8000` nếu trước đó IIS đã tự cấu hình
   rule cho binding cũ (Docker publish port không tự động xin quyền qua rule của IIS).
