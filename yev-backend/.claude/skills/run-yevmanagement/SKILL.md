---
name: run-yevmanagement
description: Build, run, smoke-test, and drive the YevManagement backend API (CompanySystem.HostApi). Use when asked to start/run the backend, call its endpoints, get a JWT token, test the API, or check that it still works after a change.
---

YevManagement backend: a .NET 10 modular monolith (Identity + Asset +
Attendance modules) hosted in a single ASP.NET Core API,
`CompanySystem.HostApi`, listening on `http://10.45.1.155:8081` (the `http`
launch profile's `applicationUrl` — check
`CompanySystem.HostApi/Properties/launchSettings.json` before assuming a port;
it used to be `localhost:5000`). Drive it over HTTP: run
`.claude\skills\run-yevmanagement\smoke.ps1` for the full start→check→stop
cycle, or start it manually and call endpoints with a JWT obtained from
`POST /api/Auth/windows-login`.

All paths below are relative to the solution root (`yev-backend/`, where
`YevManagement.slnx` lives). Project-wide conventions live in the repo root
`CLAUDE.md`.

## Prerequisites

- Windows, domain-joined (login uses Windows Negotiate auth against the YEV domain).
- .NET SDK 10 (`dotnet --version` → 10.0.301 verified).
- Network access to SQL Server `DASVRFAST` (databases `YevPCManagement`,
  `YevIdentityManagement`). Connection strings are in
  `CompanySystem.HostApi/appsettings.json` — no local DB setup, the app uses
  the shared server with **live data**.

## Build

```powershell
dotnet build YevManagement.slnx
```

Succeeds with ~32 nullable-reference warnings (normal), 0 errors, ~20 s cold.

## Run (agent path)

The smoke driver starts the API if it's not already up, runs 7 read-only
checks (OpenAPI doc, Scalar UI, Negotiate login → JWT, 401 without token,
Admin endpoint with token, Branch + Device grid endpoints), then stops the
API again — unless it was already running, in which case it leaves it alone:

```powershell
& .claude\skills\run-yevmanagement\smoke.ps1               # full cycle, exits 0/1
& .claude\skills\run-yevmanagement\smoke.ps1 -KeepRunning  # leave API up for manual calls
```

`-BaseUrl` defaults to the current `http` profile URL; pass it explicitly (e.g.
`-BaseUrl http://localhost:5000`) if the launch profile changed. When the two
disagree the script starts the API, waits 120 s for a port that never opens,
then exits 1 — check `launchSettings.json` first when that happens.

Expected output: 7 `[PASS]` lines ending in `All checks passed.`
Server console log lands in `%TEMP%\yev-hostapi.out.log` (EF Core logs every
SQL query there — useful for debugging).

To call endpoints manually after `-KeepRunning`:

```powershell
$base = "http://10.45.1.155:8081"

# Get a JWT as the current Windows user (requires Admin role in DB for Auth endpoints)
$login = Invoke-RestMethod -Uri "$base/api/Auth/windows-login" -Method Post -UseDefaultCredentials
$token = $login.data.token

# Call a protected endpoint
Invoke-RestMethod -Uri "$base/api/Auth/get-all-roles" -Headers @{ Authorization = "Bearer $token" }

# Asset/Attendance endpoints need the token AND the matching permission
Invoke-RestMethod -Uri "$base/api/Device/grid-list?pageIndex=1&pageSize=2" -Headers @{ Authorization = "Bearer $token" }
```

Stop a manually started / kept-running API:

```powershell
Get-NetTCPConnection -LocalPort 8080 -State Listen | Select-Object -First 1 |
    ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
```

## Run (human path)

```powershell
dotnet run --project CompanySystem.HostApi --launch-profile http
# → listens on http://10.45.1.155:8081, Scalar UI at /scalar/v1. Ctrl+C to stop.
```

## Test

No test projects exist in the solution (as of 2026-07). The smoke driver
above is the only automated check.

## Gotchas

- **The databases are live, shared data** (5000+ real device rows). Keep any
  scripted checks read-only — don't POST/PUT/DELETE test records. Even
  `windows-login` writes `LoginUserIPs.LastLoginAt` on every call.
- **Asset and Attendance controllers now enforce auth**: every action carries
  `[RequirePermission("Module.Entity.Action")]`, so calls need a Bearer token
  *and* the permission (missing token → 401, missing permission → 403). The
  only `[AllowAnonymous]` endpoints left are the public email-confirmation
  actions in `OtFormController` / `UserSignatureController`. (Asset used to be
  fully anonymous — old notes saying so are stale.)
- **`windows-login` needs Negotiate, not Bearer**: from PowerShell use
  `-UseDefaultCredentials`; a plain POST returns 401. The Negotiate handshake
  makes ASP.NET run the action (and its DB lookup + `LastLoginAt` update)
  up to 3 times per login — the repeated SQL in the log is normal.
- **The Admin-only checks depend on the current Windows user having the
  `Admin` role** in `YevIdentityManagement` (`Users`/`UserRoles`, matched by
  `DOMAIN\username`). A user without it gets a token but 403 on Auth
  endpoints.
- **`/openapi/v1.json` and `/scalar/v1` only exist in Development.** The
  `http` launch profile sets `ASPNETCORE_ENVIRONMENT=Development`; `dotnet run`
  picks that profile by default. If both endpoints 404, the environment
  isn't Development.
- **`warn: Failed to determine the https port for redirect`** in the server
  log is benign — the `http` profile has no HTTPS binding but the pipeline
  calls `UseHttpsRedirection()`.

## Troubleshooting

- **The port is already in use / driver reuses a stale server**: find and kill
  the owner with the `Get-NetTCPConnection` one-liner above, then rerun.
- **`powershell -ExecutionPolicy Bypass -File ...` may be blocked by
  policy/tooling**: invoke the script with the call operator instead
  (`& .claude\skills\run-yevmanagement\smoke.ps1`) from an existing
  PowerShell session — verified to work.
- **API failed to start (driver prints log tails)**: read
  `%TEMP%\yev-hostapi.out.log` / `yev-hostapi.err.log`; typical causes are a
  compile error (run `dotnet build YevManagement.slnx` to see it) or the
  SQL Server being unreachable (only surfaces on the first query, not at
  startup).
