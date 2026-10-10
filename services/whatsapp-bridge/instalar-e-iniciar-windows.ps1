# Sagamente - ativador guiado do piloto de WhatsApp para Windows.
# So inicia o processo local. O envio permanece desligado ate ativacao no painel.
$ErrorActionPreference='Stop'
$root=Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location -LiteralPath $root
$envPath=Join-Path $root '.env'
$phone='5564981294186'
$projectUrl='https://lfmjqctiutajgtacvxfq.supabase.co'
function Say([string]$msg){ Write-Host $msg -ForegroundColor Cyan }
function Fatal([string]$msg){ Write-Host ''; Write-Host "ERRO: $msg" -ForegroundColor Red; exit 1 }

Say '=============================================='
Say ' SAGAMENTE | Conexao WhatsApp por QR Code'
Say '=============================================='
Write-Host 'Piloto: +55 64 98129-4186 | ate 10 tentativas por dia.'
Write-Host 'Biblioteca nao oficial: ha risco de bloqueio do numero.'
Write-Host 'Nao envia antes da conexao e da autorizacao no painel.'
Write-Host ''

if($PSVersionTable.PSVersion.Major -ge 6 -and -not $IsWindows){
  Fatal 'Execute este iniciador no Windows.'
}
$nodeCommand=Get-Command node.exe -ErrorAction SilentlyContinue
if(-not $nodeCommand){
  Fatal 'Node.js nao encontrado. Instale Node.js 22 LTS em https://nodejs.org/en/download e execute novamente.'
}
$nodeExe=$nodeCommand.Source
# npm.cmd nem sempre aparece no PATH, apesar de estar instalado junto ao node.exe.
$nodeFolder=Split-Path -Parent $nodeExe
$npmCommand=Get-Command npm.cmd -ErrorAction SilentlyContinue
$npmExe=$null
$npmCli=$null
if($npmCommand){
  $npmExe=$npmCommand.Source
}elseif(Test-Path -LiteralPath (Join-Path $nodeFolder 'npm.cmd')){
  $npmExe=Join-Path $nodeFolder 'npm.cmd'
}else{
  $npmCandidate=Join-Path $nodeFolder 'node_modules\npm\bin\npm-cli.js'
  if(Test-Path -LiteralPath $npmCandidate){$npmCli=$npmCandidate}
}
if(-not $npmExe -and -not $npmCli){
  Write-Host ''
  Write-Host 'Node.js foi encontrado, mas o gerenciador npm nao esta disponivel.' -ForegroundColor Yellow
  Write-Host "Pasta Node.js: $nodeFolder"
  Write-Host '1. Instale/repare Node.js LTS em https://nodejs.org/en/download'
  Write-Host '2. Na instalacao, habilite npm package manager e Add to PATH.'
  Write-Host '3. Feche e reabra o terminal e confira: node -v; npm -v'
  Write-Host '4. Abra novamente Iniciar WhatsApp Sagamente.cmd.'
  Fatal 'npm ausente. A ponte nao foi iniciada e nenhuma mensagem foi enviada.'
}
$nodeVersion=(& $nodeExe --version).Trim()
$match=[regex]::Match($nodeVersion,'^v(\d+)\.')
if(-not $match.Success -or [int]$match.Groups[1].Value -lt 22){
  Fatal "E necessario Node.js 22 ou superior. Encontrado: $nodeVersion"
}
Say "Node.js encontrado: $nodeVersion"

# Instala dependencias antes de solicitar segredos na primeira execucao.
# Nao executa npm install com um .env existente.
if(-not(Test-Path -LiteralPath (Join-Path $root 'node_modules\@whiskeysockets\baileys'))){
  if(Test-Path -LiteralPath $envPath){
    Fatal 'Dependencias ausentes e .env existente. Guarde o .env fora desta pasta antes de instalar pacotes.'
  }
  Say 'Instalando dependencias (somente na primeira execucao)...'
  if($npmExe){
    & $npmExe install --no-audit --no-fund
  }else{
    & $nodeExe $npmCli install --no-audit --no-fund
  }
  if($LASTEXITCODE -ne 0){ Fatal 'Instalacao falhou. Verifique a internet, a versao do Node.js e as dependencias npm.' }
}

$needsConfig=$true
if(Test-Path -LiteralPath $envPath){
  Write-Host 'Ja existe uma configuracao privada neste computador.'
  $choice=(Read-Host 'Usar a configuracao existente? (S/n)').Trim().ToUpperInvariant()
  if([string]::IsNullOrWhiteSpace($choice) -or $choice -eq 'S'){
    $needsConfig=$false
  }elseif($choice -ne 'N'){
    Fatal 'Opcao invalida. Reinicie e responda S ou N.'
  }
}
if($needsConfig){
  Say 'Configuracao privada: Supabase da Sagamente'
  Write-Host 'Utilize a chave service_role/secret do projeto Sagamente.'
  Write-Host 'Ela tem privilegios elevados. Nunca a compartilhe por mensagem ou no site.'
  Write-Host 'A chave ficara oculta enquanto voce digita ou cola.'
  $secure=Read-Host 'Cole a chave secreta localmente e pressione Enter' -AsSecureString
  if($null -eq $secure -or $secure.Length -lt 20){
    Fatal 'Chave vazia ou muito curta. Nenhum arquivo foi gerado.'
  }
  $ptr=[IntPtr]::Zero
  $secret=$null
  try{
    $ptr=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    $secret=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
    if($secret -match '[\r\n]' -or $secret.Length -lt 20){ Fatal 'Formato de chave invalido.' }
    $lines=@(
      "SUPABASE_URL=$projectUrl",
      "SUPABASE_SERVICE_ROLE_KEY=$secret",
      "SAGAMENTE_WHATSAPP_PHONE=$phone",
      "SAGAMENTE_WHATSAPP_AUTH_DIR=./.local/session"
    )
    $utf8=New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($envPath,($lines -join [Environment]::NewLine)+[Environment]::NewLine,$utf8)
    # Remover acesso herdado: somente a conta Windows que configurou pode ler o segredo.
    $principal=[System.Security.Principal.WindowsIdentity]::GetCurrent().Name
    $acl=Get-Acl -LiteralPath $envPath
    $acl.SetAccessRuleProtection($true,$false)
    $rule=New-Object System.Security.AccessControl.FileSystemAccessRule($principal,'FullControl','Allow')
    $acl.SetAccessRule($rule)
    Set-Acl -LiteralPath $envPath -AclObject $acl
  }catch{
    Remove-Item -LiteralPath $envPath -Force -ErrorAction SilentlyContinue
    throw
  }finally{
    if($ptr -ne [IntPtr]::Zero){[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)}
    $secret=$null
    $secure=$null
  }
  Say 'Configuracao salva somente neste computador e restrita ao seu usuario Windows.'
}
if(-not(Test-Path -LiteralPath $envPath)){ Fatal 'Arquivo .env nao encontrado.' }

Say ''
Say 'PONTE PRONTA PARA CONECTAR'
Write-Host '1. Deixe esta janela aberta.'
Write-Host '2. Sagamente > Comunicacao > Central WhatsApp > Solicitar conexao.'
Write-Host '3. Celular: WhatsApp > Dispositivos conectados > Conectar dispositivo.'
Write-Host '4. Leia o QR exibido no painel da Sagamente.'
Write-Host '5. Confira o numero conectado e clique em Ativar piloto.'
Write-Host '6. Clique em Enviar teste para meu WhatsApp.'
Write-Host 'CTRL+C encerra o processo. O computador deve permanecer ligado.'
Write-Host ''
Say 'Iniciando a ponte local...'
& $nodeExe (Join-Path $root 'index.mjs')
exit $LASTEXITCODE
