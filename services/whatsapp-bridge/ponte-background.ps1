# Sagamente WhatsApp Bridge — background entrypoint for Windows Task Scheduler.
# Never installs dependencies, prompts for passwords, or changes WhatsApp settings.
$ErrorActionPreference='Stop'
$root=Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location -LiteralPath $root
$envPath=Join-Path $root '.env'
$sessionPath=Join-Path $root '.local/session'
if(-not(Test-Path -LiteralPath $envPath) -or -not(Test-Path -LiteralPath $sessionPath)){
  throw 'Ponte nao configurada: execute primeiro o iniciador original e conecte o WhatsApp.'
}
if(-not(Test-Path -LiteralPath (Join-Path $root 'node_modules/@whiskeysockets/baileys'))){
  throw 'Dependencias nao instaladas: execute primeiro Iniciar WhatsApp Sagamente.cmd.'
}
$node=Get-Command node.exe -ErrorAction Stop
$version=(& $node.Source --version)
if(-not($version -match '^v(\d+)\.') -or [int]$Matches[1] -lt 22){throw 'Node.js 22 ou superior necessario.'}
$script=Join-Path $root 'index.mjs'
# Prevent a second process using the same local session, including the CMD launcher.
# The mutex prevents duplicate scheduled tasks for the same Windows user.
$mutex=New-Object System.Threading.Mutex($false,'Local\SagamenteWhatsAppBridgeAutostart')
$owned=$false
try{
  $owned=$mutex.WaitOne(0)
  if(-not $owned){exit 0}
  $existing=@(Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" -ErrorAction Stop |
    Where-Object {$_.CommandLine -and $_.CommandLine.Contains('index.mjs') -and
      ($_.CommandLine.Contains($root) -or $_.CommandLine.Contains('whatsapp-bridge'))})
  if($existing.Count -gt 0){exit 0}
  & $node.Source $script
  exit $LASTEXITCODE
}finally{
  if($owned){$mutex.ReleaseMutex()}
  $mutex.Dispose()
}
