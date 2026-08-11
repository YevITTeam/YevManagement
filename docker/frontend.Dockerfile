# syntax=docker/dockerfile:1
#
# Build context PHAI la goc repo (docker compose build context: .).
# KHONG build Next.js ben trong image nay - chi dong goi output tinh da build san (yev-frontend/out/).
# Phai chay `pnpm build` (tao yev-frontend/out/) TRUOC khi `docker build`/`docker compose build`
# - xem docker/build-and-run.ps1. Ly do: khong co image Node chinh thuc cho Windows container,
# giu dung flow build-roi-publish nhu AutoDeploy.ps1 hien tai thay vi tu ghep 1 image Node khong chinh thuc.
#
# Dung base IIS-on-Windows-container chinh thuc cua Microsoft de tai su dung NGUYEN VEN
# docs/deploy-config/config-fe/web.config (rewrite/mime/cache/404) khong phai viet lai logic nay
# bang tay trong nginx/Kestrel.

FROM mcr.microsoft.com/windows/servercore/iis:windowsservercore-ltsc2022

# URL Rewrite Module - can cho rule AddTrailingSlash trong web.config (khong co san trong image goc).
RUN powershell -NoProfile -Command $ErrorActionPreference = 'Stop'; \
    Invoke-WebRequest -UseBasicParsing -Uri 'https://download.microsoft.com/download/1/2/8/128E2E22-C1B9-44A4-BE2A-5859ED1D4592/rewrite_amd64_en-US.msi' -OutFile 'C:\rewrite.msi'; \
    Start-Process msiexec.exe -ArgumentList '/i', 'C:\rewrite.msi', '/quiet', '/norestart' -NoNewWindow -Wait; \
    Remove-Item 'C:\rewrite.msi'

RUN powershell -NoProfile -Command Remove-Item -Recurse -Force 'C:\inetpub\wwwroot\*'

COPY yev-frontend/out/ C:/inetpub/wwwroot/
COPY docs/deploy-config/config-fe/web.config C:/inetpub/wwwroot/web.config

# Anh iis-docker goc da co san ENTRYPOINT (ServiceMonitor.exe theo doi W3SVC) - khong ghi de.
# IIS site mac dinh nghe port 80 trong container; map ra host qua docker-compose ("8000:80").
EXPOSE 80
