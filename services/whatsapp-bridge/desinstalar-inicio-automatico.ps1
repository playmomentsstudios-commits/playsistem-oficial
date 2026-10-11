# Removes ONLY Sagamente autostart scheduling; leaves credentials and session intact.
$ErrorActionPreference='Stop'
$name='Sagamente WhatsApp Bridge'
$task=Get-ScheduledTask -TaskName $name -ErrorAction SilentlyContinue
if(-not $task){Write-Host 'Inicio automatico nao estava instalado.';exit 0}
if($task.Actions.Arguments -notlike '*ponte-background.ps1*'){
  throw 'Uma tarefa diferente usa este nome; nada foi removido.'
}
Stop-ScheduledTask -TaskName $name -ErrorAction SilentlyContinue
Unregister-ScheduledTask -TaskName $name -Confirm:$false
Write-Host 'Inicio automatico removido. Arquivos de credenciais e sessao preservados.'
