param(
    [string]$Message = "dev",
    [string]$Branch = ""
)

function ExitWithError($msg) {
    Write-Host $msg -ForegroundColor Red
    exit 1
}

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    ExitWithError "git is not installed or not in PATH. Install Git and try again."
}

# Show current branch
$branch = git rev-parse --abbrev-ref HEAD 2>$null
if ($LASTEXITCODE -ne 0) { ExitWithError "Not a git repository. Initialize one or run this script from the repo root." }
Write-Host "Current branch: $branch"

# Stage all changes
git add --all

# Commit
git commit -m "$Message"
if ($LASTEXITCODE -ne 0) {
    Write-Host "No changes to commit or commit failed. Continuing to push if possible..." -ForegroundColor Yellow
}

# Check upstream
$hasUpstream = $true
try {
    git rev-parse --abbrev-ref HEAD@{u} 2>$null | Out-Null
    if ($LASTEXITCODE -ne 0) { $hasUpstream = $false }
} catch {
    $hasUpstream = $false
}

if (-not $hasUpstream) {
    if (-not $Branch -or $Branch -eq "") {
        $Branch = Read-Host -Prompt "No upstream configured. Enter remote branch name to push to (e.g. main)"
        if (-not $Branch) { ExitWithError "No branch provided. Aborting." }
    }
    git push -u origin $Branch
} else {
    git push
}

if ($LASTEXITCODE -eq 0) {
    Write-Host "Push complete." -ForegroundColor Green
} else {
    ExitWithError "Push failed. Check the output above for details and configure remote if needed."
}
