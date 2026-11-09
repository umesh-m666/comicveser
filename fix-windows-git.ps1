# Windows Git Case-Sensitivity Fixer
Write-Host "Applying Windows-specific fixes for Render Deployment..." -ForegroundColor Cyan

# 1. Tell Git on Windows to care about Capital vs Lowercase letters
git config core.ignorecase false
Write-Host "Set Git to be case-sensitive." -ForegroundColor Green

# 2. Add all changes to git
git add .
Write-Host "Staged all changes." -ForegroundColor Green

Write-Host "`nAll done! Please commit and push using these commands:" -ForegroundColor Yellow
Write-Host "git commit -m `"fix: windows case sensitivity and path routing`""
Write-Host "git push origin main"
