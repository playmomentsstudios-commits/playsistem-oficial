# Run manually ONCE, as the same Windows user who configured the bridge.
# No administrator rights, password or third-party software required.
$ErrorActionPreference='Stop'
$root=Split-Path -Parent $MyInvocation.MyCommand.Path
$taskName='Sagamente WhatsApp Bridge'
$entry=Join-Path $root 'ponte-background.ps1'
$envPath=Join-Path $root '.env'
if(-not(Test-Path -LiteralPath $envPath)){throw 'Arquivo .env ausente. Configure a ponte pelo CMD primeiro.'}
if(-not(Test-Path -LiteralPath (Join-Path $root '.local/session'))){throw 'Sessao nao encontrada. Pareie o WhatsApp pelo iniciador existente primeiro.'}
if(-not(Test-Path -LiteralPath (Join-Path $root 'node_modules/@whiskeysockets/baileys'))){throw 'Dependencias ausentes. Execute o iniciador original primeiro.'}
if(-not(Get-Command node.exe -ErrorAction SilentlyContinue)){throw 'Node.js nao encontrado.'}
$user=[System.Security.Principal.WindowsIdentity]::GetCurrent().Name
$psExe=Join-Path $PSHOME 'powershell.exe'
if(-not(Test-Path -LiteralPath $psExe)){$psExe=(Get-Command powershell.exe -ErrorAction Stop).Source}
$arguments='-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File "'+$entry+'"'
$action=New-ScheduledTaskAction -Execute $psExe -Argument $arguments -WorkingDirectory $root
$trigger=New-ScheduledTaskTrigger -AtLogOn -User $user
$principal=New-ScheduledTaskPrincipal -UserId $user -LogonType Interactive -RunLevel Limited
$settings=New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -ExecutionTimeLimit ([timespan]::Zero) -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) -StartWhenAvailable
$existing=Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if($existing){
  $actionPath=$existing.Actions.Execute
  $oldArgs=$existing.Actions.Arguments
  if($actionPath -notmatch 'powershell(?:\.exe)?$' -or $oldArgs -notlike "*ponte-background.ps1*"){
    throw 'Ja existe uma tarefa com este nome e conteudo diferente. Nenhuma tarefa foi alterada.'
  }
}
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Description 'Inicia a ponte WhatsApp Sagamente ao entrar no Windows, sem abrir CMD.' -Force | Out-Null
Write-Host 'Inicio automatico instalado para o usuario atual, ao entrar no Windows.' -ForegroundColor Green
Write-Host 'Mantem a pasta original com .env, node_modules e .local/session.'
Write-Host 'Nao e necessario escanear outro QR ao reiniciar, se a sessao continuar valida.'
Write-Host 'Se desejar iniciar agora, feche antes o CMD da ponte e execute:'
Write-Host 'Start-ScheduledTask -TaskName "Sagamente WhatsApp Bridge"'
