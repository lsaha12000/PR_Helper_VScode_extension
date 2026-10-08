# PR Helper — one-time setup script
# Run from the PR_Helper root directory in PowerShell: .\setup.ps1

Write-Host "`n=== PR Helper Setup ===" -ForegroundColor Cyan

# ── Preflight checks ──────────────────────────────────────────────────────────

Write-Host "`n[Preflight] Checking prerequisites..." -ForegroundColor Yellow

# Python 3.9+
$pythonExe = $null
foreach ($candidate in @("python", "python3")) {
    try {
        $ver = & $candidate --version 2>&1
        if ($ver -match "Python (\d+)\.(\d+)") {
            $major = [int]$Matches[1]; $minor = [int]$Matches[2]
            if ($major -gt 3 -or ($major -eq 3 -and $minor -ge 9)) {
                $pythonExe = $candidate
                Write-Host "  Python  : $ver (using '$candidate')" -ForegroundColor DarkGreen
                break
            } else {
                Write-Error "  Python  : $ver found but 3.9+ is required. Download: https://www.python.org/downloads/"
                exit 1
            }
        }
    } catch { }
}
if (-not $pythonExe) {
    Write-Error "  Python  : not found on PATH. Install Python 3.9+ from https://www.python.org/downloads/ and re-run this script."
    exit 1
}

# Node.js 18+
try {
    $nodeVer = node --version 2>&1
    if ($nodeVer -match "v(\d+)") {
        $nodeMajor = [int]$Matches[1]
        if ($nodeMajor -lt 18) {
            Write-Error "  Node.js : $nodeVer found but 18+ is required. Download: https://nodejs.org"
            exit 1
        }
        Write-Host "  Node.js : $nodeVer" -ForegroundColor DarkGreen
    }
} catch {
    Write-Error "  Node.js : not found on PATH. Install Node.js 18 LTS from https://nodejs.org and re-run this script."
    exit 1
}

# npm (sanity check — ships with Node but verify it's accessible)
try {
    $npmVer = npm --version 2>&1
    Write-Host "  npm     : v$npmVer" -ForegroundColor DarkGreen
} catch {
    Write-Error "  npm     : not found. Reinstall Node.js from https://nodejs.org"
    exit 1
}

# ── Step 0: Python virtual environment ───────────────────────────────────────

Write-Host "`n[0/3] Setting up Python virtual environment (.venv)..." -ForegroundColor Yellow

if (-not (Test-Path ".venv")) {
    & $pythonExe -m venv .venv
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to create .venv. Try running: $pythonExe -m venv .venv"
        exit 1
    }
    Write-Host "       .venv created." -ForegroundColor DarkGreen
} else {
    Write-Host "       .venv already exists, skipping creation." -ForegroundColor DarkGray
}

# Upgrade pip inside the venv to avoid build warnings
Write-Host "       Upgrading pip inside .venv..." -ForegroundColor DarkGray
.venv\Scripts\python.exe -m pip install --quiet --upgrade pip
if ($LASTEXITCODE -ne 0) { Write-Warning "pip upgrade failed (non-fatal, continuing)" }

# ── Step 1: Python backend dependencies ──────────────────────────────────────

Write-Host "`n[1/3] Installing Python backend dependencies into .venv..." -ForegroundColor Yellow
if (-not (Test-Path "backend\requirements.txt")) {
    Write-Error "backend\requirements.txt not found. Are you running this from the PR_Helper root?"
    exit 1
}
.venv\Scripts\pip install -r backend\requirements.txt
if ($LASTEXITCODE -ne 0) {
    Write-Error "pip install failed. Check your internet connection or proxy settings."
    exit 1
}

# ── Step 2: Extension npm dependencies ───────────────────────────────────────

Write-Host "`n[2/3] Installing extension npm packages..." -ForegroundColor Yellow
if (-not (Test-Path "extension\package.json")) {
    Write-Error "extension\package.json not found. Are you running this from the PR_Helper root?"
    exit 1
}
Set-Location extension
npm install
if ($LASTEXITCODE -ne 0) { Set-Location ..; Write-Error "npm install (extension) failed"; exit 1 }
Set-Location ..

# ── Step 3: Webview UI npm dependencies ──────────────────────────────────────

Write-Host "`n[3/3] Installing webview-ui npm packages..." -ForegroundColor Yellow
if (-not (Test-Path "webview-ui\package.json")) {
    Write-Error "webview-ui\package.json not found. Are you running this from the PR_Helper root?"
    exit 1
}
Set-Location webview-ui
npm install
if ($LASTEXITCODE -ne 0) { Set-Location ..; Write-Error "npm install (webview-ui) failed"; exit 1 }
Set-Location ..

# ── Done ─────────────────────────────────────────────────────────────────────

Write-Host "`n=== Setup complete! ===" -ForegroundColor Green
Write-Host ""
Write-Host "To run the extension in development:" -ForegroundColor Cyan
Write-Host "  1. Open the PR_Helper root folder in VS Code"
Write-Host "  2. Press F5  -> VS Code builds and launches the Extension Development Host"
Write-Host "  3. In the new window: Ctrl+Shift+P  ->  PR Helper: Open"
Write-Host ""
Write-Host "Note: Python dependencies are isolated in .venv and will not affect your global Python." -ForegroundColor DarkGray
