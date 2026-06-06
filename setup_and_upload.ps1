param(
    [Parameter(Mandatory=$true)][string]$RemoteUrl,
    [string]$Branch = "main",
    [string]$Message = "dev"
)

function ExitWithError($msg) {
    Write-Host $msg -ForegroundColor Red
    exit 1
}

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    ExitWithError "git is not installed or not in PATH. Install Git and try again."
}

# Ensure we're in a git repo
$branch = git rev-parse --abbrev-ref HEAD 2>$null
if ($LASTEXITCODE -ne 0) { ExitWithError "Not a git repository. Run this from the repo root." }

# Add or update origin remote
$existing = git remote get-url origin 2>$null
if ($LASTEXITCODE -ne 0) {
    git remote add origin $RemoteUrl
    if ($LASTEXITCODE -ne 0) { ExitWithError "Failed to add remote origin." }
    Write-Host "Added remote origin -> $RemoteUrl" -ForegroundColor Green
} else {
    git remote set-url origin $RemoteUrl
    if ($LASTEXITCODE -ne 0) { ExitWithError "Failed to set remote origin URL." }
    Write-Host "Set remote origin -> $RemoteUrl" -ForegroundColor Green
}

# Call the upload helper
$scriptPath = Join-Path (Get-Location) "upload_to_git.ps1"
if (-not (Test-Path $scriptPath)) { ExitWithError "Required script upload_to_git.ps1 not found in repo root." }

& PowerShell -ExecutionPolicy Bypass -File $scriptPath -Message $Message -Branch $Branch

if ($LASTEXITCODE -eq 0) { Write-Host "Repository uploaded successfully." -ForegroundColor Green } else { ExitWithError "Upload failed." }
