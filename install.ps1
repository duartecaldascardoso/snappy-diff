# Installs the latest snappy-diff release for Windows.
#   irm https://raw.githubusercontent.com/duartecaldascardoso/snappy-diff/main/install.ps1 | iex
$ErrorActionPreference = 'Stop'

$repo = 'duartecaldascardoso/snappy-diff'
$dir = Join-Path $env:LOCALAPPDATA 'Programs\snappy-diff'
$zip = Join-Path $env:TEMP 'snappy-diff.zip'

New-Item -ItemType Directory -Force $dir | Out-Null
Invoke-WebRequest "https://github.com/$repo/releases/latest/download/snappy-diff-x86_64-pc-windows-msvc.zip" -OutFile $zip
Expand-Archive $zip $dir -Force
Remove-Item $zip
Write-Host "Installed snappy-diff to $dir"

$path = [Environment]::GetEnvironmentVariable('Path', 'User')
if (($path -split ';') -notcontains $dir) {
  [Environment]::SetEnvironmentVariable('Path', "$path;$dir", 'User')
  Write-Host 'Added it to your PATH. Restart your terminal to use it.'
}
