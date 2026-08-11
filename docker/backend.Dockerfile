# syntax=docker/dockerfile:1
#
# Build context PHAI la goc repo (docker compose build context: .) vi can COPY ca thu muc yev-backend/.
# Windows container (khong phai Linux) - bat buoc vi BE dung Negotiate/NTLM (SSPI) cho /windows-login,
# chi chay duoc tren Windows. Xem docs/deploy-config/docker-deploy-guide.md.

FROM mcr.microsoft.com/dotnet/sdk:10.0-windowsservercore-ltsc2022 AS build
WORKDIR C:\src
COPY yev-backend/ .
RUN dotnet restore YevManagement.slnx
RUN dotnet publish CompanySystem.HostApi/CompanySystem.HostApi.csproj -c Release -o C:\app/publish --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0-windowsservercore-ltsc2022 AS runtime
WORKDIR C:\app
COPY --from=build C:\app\publish .

# appsettings.json KHONG nam trong image (xem .dockerignore) - moi may/moi lan build co the khac nhau,
# giong dung nguyen tac AutoDeploy.ps1 cu ("khong bao gio ghi de appsettings that cua production").
# Phai mount de tu ngoai vao C:\app\appsettings.json luc `docker run`/compose (xem docker-compose.yml).
#
# ASPNETCORE_ENVIRONMENT=Development duoc giu nguyen (dung y het gia tri hien co trong
# docs/deploy-config/config-be/web.config) de /scalar/v1 va OpenAPI van bat duoc nhu IIS hien tai.
ENV ASPNETCORE_ENVIRONMENT=Development
ENV ASPNETCORE_URLS=http://+:8080

EXPOSE 8080
ENTRYPOINT ["dotnet", "CompanySystem.HostApi.dll"]
