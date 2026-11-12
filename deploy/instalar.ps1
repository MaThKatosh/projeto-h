# Instala (ou atualiza) o Projeto H num computador Windows do hotel.
# Uso (PowerShell, na pasta do projeto):  powershell -ExecutionPolicy Bypass -File deploy\instalar.ps1
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  Write-Host "Instale o Docker Desktop antes: https://www.docker.com/products/docker-desktop/" -ForegroundColor Red
  exit 1
}
docker info *> $null
if ($LASTEXITCODE -ne 0) { Write-Host "Abra o Docker Desktop e espere ele ficar pronto." -ForegroundColor Red; exit 1 }

function New-Secret([int]$len) {
  $chars = [char[]]"ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789"
  $bytes = New-Object byte[] $len
  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  -join ($bytes | ForEach-Object { $chars[$_ % $chars.Length] })
}

$envFile = Join-Path $PSScriptRoot ".env"
if (-not (Test-Path $envFile)) {
  Write-Host "=== Instalação do sistema do hotel ===" -ForegroundColor Cyan
  Write-Host "Onde ele vai rodar?"
  Write-Host "  1) Neste computador do hotel (rede interna)"
  Write-Host "  2) Na nuvem, com um domínio (ex.: sistema.meuhotel.com.br)"
  $choice = Read-Host "Escolha 1 ou 2"
  $adminPass = New-Secret 14
  $lines = @(
    "# Gerado por instalar.ps1 em $(Get-Date). NAO compartilhe este arquivo.",
    "POSTGRES_PASSWORD=$(New-Secret 32)",
    "ADMIN_USERNAME=admin",
    "ADMIN_PASSWORD=$adminPass"
  )
  if ($choice -eq "2") {
    $domain = Read-Host "Domínio (já apontando para este servidor)"
    $email = Read-Host "E-mail para avisos do certificado"
    $lines += @("MODE=cloud", "DOMAIN=$domain", "ACME_EMAIL=$email")
    $url = "https://$domain"
  } else {
    $ip = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike "127.*" -and $_.IPAddress -notlike "169.254.*" -and $_.InterfaceAlias -notmatch "vEthernet|WSL|Loopback" } | Select-Object -First 1).IPAddress
    $typed = Read-Host "Endereço deste computador na rede [$ip]"
    if ($typed) { $ip = $typed }
    $lines += @("MODE=local", "SERVER_ADDRESS=$ip")
    $url = "https://$ip"
  }
  # UTF-8 sem BOM (o docker compose lê melhor assim)
  [System.IO.File]::WriteAllLines($envFile, $lines, (New-Object System.Text.UTF8Encoding $false))
  New-Item -ItemType Directory -Force (Join-Path $PSScriptRoot "backups") | Out-Null
  Write-Host ""
  Write-Host "===============================================================" -ForegroundColor Yellow
  Write-Host " Usuário: admin"
  Write-Host " Senha:   $adminPass"
  Write-Host " Anote agora e troque no primeiro acesso (Meu perfil)."
  Write-Host "===============================================================" -ForegroundColor Yellow
} else {
  Write-Host "Já instalado: atualizando..."
  $cfg = @{}
  Get-Content $envFile | Where-Object { $_ -match "^\w+=" } | ForEach-Object { $k, $v = $_ -split "=", 2; $cfg[$k] = $v }
  if ($cfg["MODE"] -eq "cloud") { $url = "https://$($cfg['DOMAIN'])" } else { $url = "https://$($cfg['SERVER_ADDRESS'])" }
}

docker compose up -d --build
if ($LASTEXITCODE -ne 0) { Write-Host "Algo deu errado ao subir o sistema (veja as mensagens acima)." -ForegroundColor Red; exit 1 }

Write-Host ""
Write-Host "Pronto! Aguarde ~1 minuto e abra: $url" -ForegroundColor Green
if ((Get-Content $envFile) -match "^MODE=local") {
  $plain = $url -replace "^https://", "http://"
  Write-Host "Em cada aparelho, instale uma vez o certificado: $plain/certificado.crt"
  Write-Host "Libere no firewall do Windows as portas 80 e 443 (passo a passo em docs\INSTALACAO.md)."
}
