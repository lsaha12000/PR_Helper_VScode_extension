# PR Helper — one-time setup script
# Run from the PR_Helper root directory in PowerShell

Write-Host "`n=== PR Helper Setup ===" -ForegroundColor Cyan

# 1. Python dependencies
Write-Host "`n[1/3] Installing Python backend dependencies..." -ForegroundColor Yellow
pip install -r backend/requirements.txt
if ($LASTEXITCODE -ne 0) { Write-Error "pip install failed"; exit 1 }

# 2. Extension npm dependencies
Write-Host "`n[2/3] Installing extension npm packages..." -ForegroundColor Yellow
Set-Location extension
npm install
if ($LASTEXITCODE -ne 0) { Write-Error "npm install (extension) failed"; exit 1 }
Set-Location ..

# 3. Webview UI npm dependencies
Write-Host "`n[3/3] Installing webview-ui npm packages..." -ForegroundColor Yellow
Set-Location webview-ui
npm install
if ($LASTEXITCODE -ne 0) { Write-Error "npm install (webview-ui) failed"; exit 1 }
Set-Location ..

Write-Host "`nSetup complete! To develop:" -ForegroundColor Green
Write-Host "  1. Open the 'extension' folder in VS Code"
Write-Host "  2. Press F5 to launch Extension Development Host"
Write-Host "  3. Run 'PR Helper: Open' from the Command Palette"
