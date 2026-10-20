<#
.SYNOPSIS
    Cyberpunk Neon Survivors - PowerShell Deployment Script
.DESCRIPTION
    Runs automated checks, tests, build, and deploys to Vercel.
.PARAMETER Prod
    Deploy directly to production (vercel --prod)
.PARAMETER DryRun
    Run pre-flight checks and build only without uploading
#>
[CmdletBinding()]
param(
    [switch]$Prod,
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"

Write-Host "`n=============================================================" -ForegroundColor Cyan
Write-Host "⚡ CYBERPUNK NEON SURVIVORS - POWERSHELL DEPLOYMENT PIPELINE" -ForegroundColor Cyan
Write-Host "=============================================================`n" -ForegroundColor Cyan

# 1. Typecheck
Write-Host "▶ 1/5: Running TypeScript Typecheck..." -ForegroundColor Yellow
npm run typecheck
Write-Host "✔ Typecheck passed!`n" -ForegroundColor Green

# 2. Test
Write-Host "▶ 2/5: Running Automated Tests..." -ForegroundColor Yellow
npm run test
Write-Host "✔ All tests passed!`n" -ForegroundColor Green

# 3. Build
Write-Host "▶ 3/5: Compiling Production Build..." -ForegroundColor Yellow
npm run build
Write-Host "✔ Build compiled successfully!`n" -ForegroundColor Green

# 4. Validate Configuration
Write-Host "▶ 4/5: Validating Vercel Configuration..." -ForegroundColor Yellow
if (-not (Test-Path "vercel.json")) { throw "vercel.json not found!" }
if (-not (Test-Path ".vercelignore")) { throw ".vercelignore not found!" }
if (-not (Test-Path "api/index.ts")) { throw "api/index.ts not found!" }
Write-Host "✔ Vercel configurations verified!`n" -ForegroundColor Green

# 5. Deploy
if ($DryRun) {
    Write-Host "✔ Dry run completed successfully! Ready to deploy." -ForegroundColor Green
    exit 0
}

Write-Host "▶ 5/5: Deploying to Vercel..." -ForegroundColor Yellow
if ($Prod) {
    npx vercel --prod
} else {
    npx vercel
}

Write-Host "`n✨ DEPLOYMENT COMPLETE!`n" -ForegroundColor Cyan
