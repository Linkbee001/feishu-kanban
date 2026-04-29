param(
  [string]$BaseUrl = 'http://localhost:3000',
  [string]$AdminToken = $env:ADMIN_JWT_SECRET,
  [string]$ChatId = 'dev_chat_runtime_smoke',
  [string]$OwnerOpenId = 'ou_dev_user',
  [string]$ProjectName = 'Runtime Smoke Project',
  [string]$RepoUrl = '',
  [string]$RepoBranch = 'main',
  [ValidateSet('CreateTask', 'Confirm')]
  [string]$Scenario = 'CreateTask',
  [int]$PollSeconds = 60
)

$ErrorActionPreference = 'Stop'

if ([string]::IsNullOrWhiteSpace($AdminToken)) {
  throw 'ADMIN_JWT_SECRET is required. Pass -AdminToken or export ADMIN_JWT_SECRET first.'
}

function Invoke-JsonApi {
  param(
    [ValidateSet('GET', 'POST', 'PATCH')]
    [string]$Method,
    [string]$Path,
    [object]$Body = $null,
    [switch]$SkipAuth
  )

  $headers = @{
    Accept = 'application/json'
  }
  if (-not $SkipAuth) {
    $headers.Authorization = "Bearer $AdminToken"
  }

  $uri = '{0}{1}' -f $BaseUrl.TrimEnd('/'), $Path
  if ($null -eq $Body) {
    return Invoke-RestMethod -Method $Method -Uri $uri -Headers $headers
  }

  $json = $Body | ConvertTo-Json -Depth 20
  return Invoke-RestMethod -Method $Method -Uri $uri -Headers $headers -ContentType 'application/json' -Body $json
}

function Write-Step {
  param([string]$Message)
  Write-Host $Message -ForegroundColor Cyan
}

function New-EventPayload {
  param(
    [string]$Text,
    [Array]$Mentions
  )

  return @{
    header = @{
      event_id = ('evt_' + [guid]::NewGuid().ToString('N'))
    }
    event = @{
      message = @{
        chat_id = $ChatId
        message_id = ('msg_' + [guid]::NewGuid().ToString('N'))
        chat_type = 'group'
        content = (
          @{
            text = $Text
            mentions = $Mentions
          } | ConvertTo-Json -Compress -Depth 10
        )
      }
      sender = @{
        sender_id = @{
          open_id = $OwnerOpenId
        }
      }
    }
  }
}

$originalOverride = $null

try {
  Write-Step '[1/7] Checking API health'
  $health = Invoke-JsonApi -Method GET -Path '/health' -SkipAuth
  Write-Host ("Health: {0}" -f ($health | ConvertTo-Json -Compress))

  Write-Step '[2/7] Seeding a bound project and default environment'
  $seed = Invoke-JsonApi -Method POST -Path '/api/dev/seed-project' -Body @{
    name = $ProjectName
    feishuChatId = $ChatId
    ownerOpenId = $OwnerOpenId
    repoUrl = $RepoUrl
    repoBranch = $RepoBranch
  }
  $projectId = $seed.project.id
  $environmentId = $seed.environment.id
  Write-Host ("Seeded projectId={0} environmentId={1}" -f $projectId, $environmentId)

  Write-Step '[3/7] Saving the current project-level manager profile override'
  $originalOverrideResponse = Invoke-JsonApi -Method GET -Path "/api/projects/$projectId/agent-profiles/manager"
  if ($null -ne $originalOverrideResponse -and $null -ne $originalOverrideResponse.overrideJson) {
    $originalOverride = $originalOverrideResponse.overrideJson
  } else {
    $originalOverride = @{}
  }

  Write-Step '[4/7] Applying a deterministic smoke override for the manager runtime'
  $smokeOverride = @{
    standingOrdersMd = @'
Only respond to explicit @bot messages in the bound project group.
Extract actionable work into persisted todos before doing execution.
Keep at most one todo in running state.
If human confirmation is required, stop the running todo in waiting_confirmation and ask through the confirmation tool.
Use Feishu read tools on demand; do not assume remote documents are mirrored locally.
If the latest user message contains [SMOKE_CREATE_TASK], do exactly these steps and nothing else:
1. Create one todo titled smoke-create-task with intent progress_summary and outputMode summary.
2. If needed, call todo_list to find that task id.
3. Start that task.
4. Reply to the group with exact text SMOKE_CREATE_TASK_ACK.
5. Complete that task with resultSummary smoke done.
6. Emit one summary output titled smoke-summary with content SMOKE_CREATE_TASK_DONE.
If the latest user message contains [SMOKE_CONFIRM], do exactly these steps and nothing else:
1. Create one todo titled smoke-confirm-task with intent progress_summary and outputMode summary.
2. Call todo_list and find the newest queued task id for smoke-confirm-task.
3. Start that task.
4. Request group confirmation for that task with actionType smoke_confirm, summary SMOKE_CONFIRM_REQUESTED, detail Confirm smoke flow, and payload { reply: "SMOKE_CONFIRM_REQUESTED", intent: "progress_summary", executionPrompt: "After confirmation, reply_group exact text SMOKE_CONFIRM_RESUMED, complete the task, and emit one summary output titled smoke-confirm-summary with content SMOKE_CONFIRM_DONE.", outputMode: "summary" }.
5. Do not emit outputs before confirmation.
If the latest message mentions Confirmation accepted for task, do exactly these steps and nothing else:
1. Call todo_list and find the newest task titled smoke-confirm-task.
2. Start it if needed.
3. Reply to the group with exact text SMOKE_CONFIRM_RESUMED.
4. Complete that task with resultSummary confirmed smoke done.
5. Emit one summary output titled smoke-confirm-summary with content SMOKE_CONFIRM_DONE.
'@
    promptPreludeMd = 'Treat [SMOKE_CREATE_TASK] and [SMOKE_CONFIRM] as deterministic validation commands for runtime scheduling.'
  }
  Invoke-JsonApi -Method PATCH -Path "/api/projects/$projectId/agent-profiles/manager" -Body $smokeOverride | Out-Null

  $messageText = if ($Scenario -eq 'CreateTask') {
    '@bot [SMOKE_CREATE_TASK] run the runtime smoke flow'
  } else {
    '@bot [SMOKE_CONFIRM] run the runtime confirmation smoke flow'
  }

  Write-Step '[5/7] Posting a synthetic Feishu group webhook event'
  $payload = New-EventPayload -Text $messageText -Mentions @(@{ id = 'ou_bot'; name = 'bot' })
  $webhookResponse = Invoke-JsonApi -Method POST -Path '/webhooks/feishu/events' -Body $payload -SkipAuth
  Write-Host ("Webhook accepted: {0}" -f ($webhookResponse | ConvertTo-Json -Compress))

  Write-Step '[6/7] Polling runtime state'
  $deadline = (Get-Date).AddSeconds($PollSeconds)
  $confirmationId = $null
  $completed = $false
  while ((Get-Date) -lt $deadline) {
    Start-Sleep -Seconds 2
    $monitor = Invoke-JsonApi -Method GET -Path ("/api/dev/monitor?chatId={0}" -f [uri]::EscapeDataString($ChatId))
    $tasks = Invoke-JsonApi -Method GET -Path "/api/group-runtime-sessions/$ChatId/tasks"

    if ($Scenario -eq 'CreateTask') {
      $task = @($tasks) | Where-Object { $_.title -eq 'smoke-create-task' } | Select-Object -First 1
      $run = @($monitor.runs) | Select-Object -First 1
      if ($null -ne $task -and $task.status -eq 'completed') {
        Write-Host ("Task completed: {0}" -f ($task | ConvertTo-Json -Compress))
        if ($null -ne $run) {
          Write-Host ("Latest run: {0}" -f ($run | ConvertTo-Json -Compress))
        }
        $completed = $true
        break
      }
    } else {
      $confirmation = @($monitor.confirmations) | Where-Object { $_.status -eq 'pending' } | Select-Object -First 1
      if ($null -ne $confirmation -and [string]::IsNullOrWhiteSpace($confirmationId)) {
        $confirmationId = $confirmation.id
        Write-Host ("Pending confirmation found: {0}" -f $confirmationId)
        Write-Step '[6.1] Auto-confirming the runtime confirmation'
        Invoke-JsonApi -Method POST -Path "/internal/confirmations/$confirmationId/confirm" -Body @{} | Out-Null
      }

      $task = @($tasks) | Where-Object { $_.title -eq 'smoke-confirm-task' } | Select-Object -First 1
      $run = @($monitor.runs) | Select-Object -First 1
      if ($null -ne $task -and $task.status -eq 'completed') {
        Write-Host ("Task completed after confirmation: {0}" -f ($task | ConvertTo-Json -Compress))
        if ($null -ne $run) {
          Write-Host ("Latest run: {0}" -f ($run | ConvertTo-Json -Compress))
        }
        $completed = $true
        break
      }
    }
  }

  if (-not $completed) {
    throw "Smoke scenario $Scenario did not complete within $PollSeconds seconds."
  }

  Write-Step '[7/7] Final session snapshot'
  $snapshot = Invoke-JsonApi -Method GET -Path "/api/group-runtime-sessions/$ChatId"
  Write-Host ($snapshot | ConvertTo-Json -Depth 10)
  Write-Host ("Scenario {0} passed." -f $Scenario) -ForegroundColor Green
} finally {
  if ($null -ne $projectId) {
    Write-Step 'Restoring the original project-level manager profile override'
    Invoke-JsonApi -Method PATCH -Path "/api/projects/$projectId/agent-profiles/manager" -Body $originalOverride | Out-Null
  }
}
