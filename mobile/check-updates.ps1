#!/usr/bin/env pwsh
# check-updates.ps1 — Compare mobile directory against a base commit/tag
# Usage:
#   .\check-updates.ps1                  # shows recent mobile commits + summary
#   .\check-updates.ps1 -Base <sha>      # full diff vs a specific commit
#   .\check-updates.ps1 -Base <sha> -Stat  # file-level stats only (no full diff)

param(
    [string]$Base = "",
    [switch]$Stat
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot

Push-Location $Root

try {
    Write-Host "`n=== Once Metros Mobile — Update Check ===" -ForegroundColor Cyan

    # ── Current version from app.json ──────────────────────────────────────
    $appJson  = Get-Content "$Root\mobile\app.json" | ConvertFrom-Json
    $version  = $appJson.expo.version
    Write-Host "`napp.json version : $version" -ForegroundColor Yellow
    Write-Host "Current HEAD     : $(git rev-parse --short HEAD) ($(git log -1 --format='%s'))"

    # ── Recent commits that touched mobile/ ────────────────────────────────
    Write-Host "`n--- Recent commits touching mobile/ ---" -ForegroundColor Cyan
    git log --oneline -15 -- mobile/

    if ($Base -eq "") {
        Write-Host "`nTip: re-run with -Base [commit-sha] to see the full diff." -ForegroundColor DarkGray
        Write-Host "     Find the sha in the EAS dashboard: https://expo.dev/accounts/mateomarenco/projects/once-metros-mobile/builds`n"
        Pop-Location
        exit 0
    }

    # ── Validate base commit ──────────────────────────────────────────────
    $baseShort = git rev-parse --short $Base 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Invalid base commit: $Base"
    }
    Write-Host "`nDiffing $baseShort -> HEAD" -ForegroundColor Yellow

    # ── Changed files in mobile/ ─────────────────────────────────────────
    Write-Host "`n--- Changed files in mobile/ ---" -ForegroundColor Cyan
    git diff --name-status $Base HEAD -- mobile/

    if (-not $Stat) {
        Write-Host "`n--- Full diff (mobile/ only) ---" -ForegroundColor Cyan
        git diff $Base HEAD -- mobile/
    }

    # ── Reminder checklist ────────────────────────────────────────────────
    Write-Host "`n--- Build checklist ---" -ForegroundColor Cyan
    Write-Host "[ ] Bump version in mobile/app.json (current: $version) if submitting to stores"
    Write-Host "[ ] Run: eas build --platform all --profile production"
    Write-Host "[ ] Run: eas submit --platform all (after build completes)"
    Write-Host ""

} finally {
    Pop-Location
}
