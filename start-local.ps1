# ==============================================================================
# Book Manager - Unified Local Runner (Sites / Vinext + Cloudflare D1)
# Dynamically detects and avoids any ports currently in use
# ==============================================================================

$RepoRoot = $PSScriptRoot
Set-Location $RepoRoot

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "             BOOK MANAGER - LOCAL RUNNER                " -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan

# ------------------------------------------------------------------------------
# 0. Check for existing servers & lock files
# ------------------------------------------------------------------------------
$lockPath = Join-Path $RepoRoot ".vinext\dev\lock.json"

if (Test-Path $lockPath) {
    try {
        $lockContent = Get-Content $lockPath -Raw -ErrorAction Stop | ConvertFrom-Json
        $lockPid = [int]$lockContent.pid
        $lockPort = [int]$lockContent.port

        $existingProc = Get-Process -Id $lockPid -ErrorAction SilentlyContinue
        if ($existingProc) {
            # Test if the existing server is actively responding
            $isResponding = $false
            try {
                $tcp = [System.Net.Sockets.TcpClient]::new()
                $asyncRes = $tcp.BeginConnect("localhost", $lockPort, $null, $null)
                $wait = $asyncRes.AsyncWaitHandle.WaitOne(1200, $false)
                if ($wait -and $tcp.Connected) {
                    $tcp.EndConnect($asyncRes)
                    $isResponding = $true
                }
                $tcp.Close()
            } catch {}

            if ($isResponding) {
                Write-Host ""
                Write-Host "  [OK] Book Manager is ALREADY RUNNING at http://localhost:$lockPort (PID: $lockPid)" -ForegroundColor Green
                Write-Host "  -> Launching default browser to: http://localhost:$lockPort" -ForegroundColor Cyan
                Start-Process "http://localhost:$lockPort"
                Write-Host ""
                Write-Host "  Press [R] within 5s to restart, or window will auto-close..." -ForegroundColor Yellow

                $restart = $false
                for ($sec = 5; $sec -gt 0; $sec--) {
                    Write-Host "`r  Auto-closing in $sec seconds... (Press 'R' to restart) " -NoNewline
                    for ($ms = 0; $ms -lt 10; $ms++) {
                        Start-Sleep -Milliseconds 100
                        try {
                            if ([System.Console]::KeyAvailable) {
                                $k = [System.Console]::ReadKey($true)
                                if ($k.KeyChar -eq 'r' -or $k.KeyChar -eq 'R') {
                                    $restart = $true
                                    break
                                }
                            }
                        } catch {}
                    }
                    if ($restart) { break }
                }
                Write-Host ""

                if ($restart) {
                    Write-Host "  -> Terminating previous server (PID: $lockPid)..." -ForegroundColor Yellow
                    Stop-Process -Id $lockPid -Force -ErrorAction SilentlyContinue
                    Start-Sleep -Seconds 1
                    Remove-Item $lockPath -Force -ErrorAction SilentlyContinue
                } else {
                    Write-Host "  -> Existing server is kept running. Exiting runner." -ForegroundColor Green
                    exit 0
                }
            } else {
                # Stale / dead / unresponsive process
                Write-Host "  [!] Found inactive/stale server process (PID: $lockPid). Terminating..." -ForegroundColor Yellow
                Stop-Process -Id $lockPid -Force -ErrorAction SilentlyContinue
                Start-Sleep -Milliseconds 500
                Remove-Item $lockPath -Force -ErrorAction SilentlyContinue
            }
        } else {
            Remove-Item $lockPath -Force -ErrorAction SilentlyContinue
        }
    } catch {
        Remove-Item $lockPath -Force -ErrorAction SilentlyContinue
    }
}

# ------------------------------------------------------------------------------
# 1. Verify Node.js
# ------------------------------------------------------------------------------
Write-Host "[1/3] Verifying Node.js and dependencies..." -ForegroundColor Yellow
$nodeVersion = & node -v 2>$null
if (-not $nodeVersion) {
    Write-Host "[ERROR] Node.js is not found in PATH. Please install Node.js >= 22." -ForegroundColor Red
    Write-Host "Press any key to exit..."
    try { if ([System.Console]::IsInputRedirected -eq $false) { [void][System.Console]::ReadKey($true) } } catch {}
    exit 1
}
Write-Host "  -> Node.js version: $nodeVersion" -ForegroundColor Green

# Verify node_modules
if (-not (Test-Path (Join-Path $RepoRoot "node_modules"))) {
    Write-Host "  -> Installing dependencies (npm install)..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] npm install failed." -ForegroundColor Red
        try { if ([System.Console]::IsInputRedirected -eq $false) { [void][System.Console]::ReadKey($true) } } catch {}
        exit 1
    }
}

# ------------------------------------------------------------------------------
# 2. Database schema & migrations
# ------------------------------------------------------------------------------
Write-Host "[2/3] Checking database schema & migrations..." -ForegroundColor Yellow
if (-not (Test-Path (Join-Path $RepoRoot "drizzle"))) {
    Write-Host "  -> Generating SQL migrations from Drizzle schema..." -ForegroundColor Yellow
    npm run db:generate
}
Write-Host "  -> D1 SQLite schema ready" -ForegroundColor Green

# ------------------------------------------------------------------------------
# 3. Find available port (Never use ports currently in use)
# ------------------------------------------------------------------------------
function Get-AvailablePort([int]$preferredPort = 3100) {
    $usedPorts = [System.Collections.Generic.HashSet[int]]::new()
    try {
        Get-NetTCPConnection -ErrorAction SilentlyContinue | ForEach-Object {
            [void]$usedPorts.Add($_.LocalPort)
        }
    } catch {}

    $port = $preferredPort
    while ($true) {
        if (-not $usedPorts.Contains($port)) {
            $isFree = $true
            # Test binding IPv4
            try {
                $listener4 = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Any, $port)
                $listener4.Start()
                $listener4.Stop()
            } catch {
                $isFree = $false
            }

            # Test binding IPv6
            if ($isFree) {
                try {
                    $listener6 = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::IPv6Any, $port)
                    $listener6.Start()
                    $listener6.Stop()
                } catch {
                    $isFree = $false
                }
            }

            if ($isFree) {
                return $port
            }
        }
        $port++
    }
}

$DefaultStartPort = 3100
$AppPort = if ($env:PORT) { [int]$env:PORT } else { Get-AvailablePort $DefaultStartPort }

if ($AppPort -ne $DefaultStartPort) {
    Write-Host "  [!] Port $DefaultStartPort is currently in use. Automatically routed to free port: $AppPort" -ForegroundColor Magenta
}

Write-Host "[3/3] Launching Book Manager server on port $AppPort..." -ForegroundColor Yellow
Write-Host "  -> Local D1 database: .wrangler/state/v3/d1" -ForegroundColor Cyan
Write-Host "  -> Application URL: http://localhost:$AppPort" -ForegroundColor Green

# ------------------------------------------------------------------------------
# 4. Background browser launcher
# ------------------------------------------------------------------------------
$browserWatcher = @"
for (`$i = 0; `$i -lt 60; `$i++) {
    Start-Sleep -Milliseconds 400
    `$connected = `$false
    try {
        `$tcp = [System.Net.Sockets.TcpClient]::new()
        `$ar = `$tcp.BeginConnect('localhost', $AppPort, `$null, `$null)
        if (`$ar.AsyncWaitHandle.WaitOne(600, `$false) -and `$tcp.Connected) {
            `$tcp.EndConnect(`$ar)
            `$connected = `$true
        }
        `$tcp.Close()
    } catch {}

    if (`$connected) {
        Start-Process "http://localhost:$AppPort"
        break
    }
}
"@
$bwBytes = [System.Text.Encoding]::Unicode.GetBytes($browserWatcher)
$bwEncoded = [System.Convert]::ToBase64String($bwBytes)
Start-Process powershell.exe -ArgumentList "-NoProfile -EncodedCommand $bwEncoded" -WindowStyle Hidden

# ------------------------------------------------------------------------------
# 5. Start Vinext dev server directly via Node
# ------------------------------------------------------------------------------
$env:PORT = $AppPort
$cliPath = Join-Path $RepoRoot "node_modules\vinext\dist\cli.js"

try {
    & node $cliPath dev --port $AppPort
} finally {
    # Cleanup lock on exit if left behind
    if (Test-Path $lockPath) {
        Remove-Item $lockPath -Force -ErrorAction SilentlyContinue
    }
    Write-Host ""
    Write-Host "Book Manager server has stopped." -ForegroundColor Yellow
}
