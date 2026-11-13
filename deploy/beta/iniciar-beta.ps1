# Liga a VERSÃO DE TESTE (beta) e cria o link público para os amigos testarem.
# Uso (PowerShell, na pasta do projeto):  powershell -ExecutionPolicy Bypass -File deploy\beta\iniciar-beta.ps1
# Deixe esta janela aberta: fechando, o link para de funcionar.
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

docker info *> $null
if ($LASTEXITCODE -ne 0) { Write-Host "Abra o Docker Desktop e espere ele ficar pronto." -ForegroundColor Red; exit 1 }

if (-not (Test-Path ".env")) {
  function New-Secret([int]$len) {
    $chars = [char[]]"ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789"
    $bytes = New-Object byte[] $len
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    -join ($bytes | ForEach-Object { $chars[$_ % $chars.Length] })
  }
  [System.IO.File]::WriteAllLines((Join-Path $PSScriptRoot ".env"), @("POSTGRES_PASSWORD=$(New-Secret 32)", "ADMIN_PASSWORD=$(New-Secret 14)"), (New-Object System.Text.UTF8Encoding $false))
}

Write-Host "Ligando o servidor de teste..." -ForegroundColor Cyan
docker compose up -d --build
for ($i = 0; $i -lt 60; $i++) {
  try { if ((Invoke-WebRequest "http://127.0.0.1:3100/api/saude" -UseBasicParsing -TimeoutSec 3).StatusCode -eq 200) { break } } catch {}
  Start-Sleep 3
}

$cf = (Get-Command cloudflared -ErrorAction SilentlyContinue).Source
if (-not $cf) { $cf = "C:\Program Files (x86)\cloudflared\cloudflared.exe" }
if (-not (Test-Path $cf)) { Write-Host "Instale o cloudflared:  winget install Cloudflare.cloudflared" -ForegroundColor Red; exit 1 }

Write-Host "Criando o link público (Cloudflare)..." -ForegroundColor Cyan
$log = Join-Path $PSScriptRoot "tunnel.log"
Remove-Item $log -ErrorAction SilentlyContinue
$p = Start-Process -FilePath $cf -ArgumentList "tunnel", "--no-autoupdate", "--url", "http://127.0.0.1:3100" -RedirectStandardError $log -PassThru -WindowStyle Hidden
$url = $null
for ($i = 0; $i -lt 40 -and -not $url; $i++) {
  Start-Sleep 1
  if (Test-Path $log) { $m = Select-String -Path $log -Pattern "https://[a-z0-9-]+\.trycloudflare\.com" | Select-Object -First 1; if ($m) { $url = $m.Matches[0].Value } }
}
if (-not $url) { Write-Host "Não consegui criar o link. Veja $log" -ForegroundColor Red; Stop-Process $p -ErrorAction SilentlyContinue; exit 1 }
Set-Content -Path (Join-Path $PSScriptRoot "link.txt") -Value $url -Encoding utf8

# Publica o link no gist secreto: os apps beta consultam esse endereço fixo e
# acham o link novo sozinhos (não precisa reinstalar quando o link muda).
$gistFile = Join-Path $PSScriptRoot "gist-id.txt"
if ((Test-Path $gistFile) -and (Get-Command gh -ErrorAction SilentlyContinue)) {
  $gistId = (Get-Content $gistFile -Raw).Trim()
  $tmp = Join-Path $env:TEMP "beta-link.txt"
  [System.IO.File]::WriteAllText($tmp, $url, (New-Object System.Text.UTF8Encoding $false))
  gh gist edit $gistId --filename beta-link.txt $tmp
  if ($LASTEXITCODE -eq 0) { Write-Host "Link publicado para os apps (pode levar até 5 minutos para eles verem)." -ForegroundColor Cyan }
  else { Write-Host "Não consegui atualizar o gist (gh auth login?). Os apps vão continuar com o link antigo." -ForegroundColor Yellow }
}

Write-Host ""
Write-Host "===============================================================" -ForegroundColor Green
Write-Host " Link do beta: $url" -ForegroundColor Green
Write-Host " Mande para os amigos. Contas de teste: gerente, recepcao,"
Write-Host " governanca, manutencao, restaurante  (senha: teste123)"
Write-Host " Sugestões deles: entre como admin e abra 'Sugestões dos testadores'."
Write-Host "==============================================================="
Write-Host "Deixe esta janela aberta. Para desligar o link: feche a janela ou Ctrl+C."
try { Wait-Process -Id $p.Id } finally { Stop-Process -Id $p.Id -ErrorAction SilentlyContinue }
