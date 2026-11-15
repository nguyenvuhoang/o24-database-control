& "$PSScriptRoot\collect.ps1" -AgentId emi-cms-live -Instance CMSLIVE -BackupDirectory 'D:\Backup\EMI_CMS' |
    ConvertFrom-Json | ConvertTo-Json -Depth 8
