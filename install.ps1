# One-command Windows bootstrap. Windows PowerShell 5.1+, no Node/Python/Git needed.
param(
    [ValidateSet('both','claude','codex')][string]$Agent = 'both',
    [string]$InstallDir = $env:AZIZ_WA_HOME,
    [string]$SourceDir = '',
    [switch]$NoShortcut,
    [switch]$Plan
)
$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
if (-not $InstallDir) { $InstallDir = Join-Path $env:LOCALAPPDATA 'aziz-wa' }
$InstallDir = [IO.Path]::GetFullPath($InstallDir)
if ($InstallDir -eq [IO.Path]::GetPathRoot($InstallDir) -or $InstallDir -eq $env:USERPROFILE) {
    throw 'Use a dedicated installation folder.'
}
$MachineArch = $env:PROCESSOR_ARCHITEW6432
if (-not $MachineArch) { $MachineArch = $env:PROCESSOR_ARCHITECTURE }
switch ($MachineArch.ToUpperInvariant()) {
    'AMD64' { $NodeArch = 'x64' }
    'ARM64' { $NodeArch = 'arm64' }
    default { throw 'Windows x64 or ARM64 is required.' }
}
if ($Plan) {
    Write-Host "Platform: win32-$NodeArch`nInstallation: $InstallDir`nAgents: $Agent"
    Write-Host 'Install verified Node.js 24 LTS, managed Python, browser/audit tools, chosen agents, skill and launcher; run doctor.'
    return
}
function Get-AzizDownload([string]$Url, [string]$Destination) {
    Invoke-WebRequest -UseBasicParsing -Uri $Url -OutFile $Destination -TimeoutSec 600
}
New-Item -ItemType Directory -Force -Path (Join-Path $InstallDir 'runtime'), (Join-Path $InstallDir 'tmp') | Out-Null
$WorkDir = Join-Path (Join-Path $InstallDir 'tmp') ([guid]::NewGuid().ToString())
New-Item -ItemType Directory -Path $WorkDir | Out-Null
try {
    $NodeRoot = Join-Path $InstallDir 'runtime\node'
    $NodeExe = Join-Path $NodeRoot 'node.exe'
    $NodeReady = $false
    if (Test-Path $NodeExe) {
        & $NodeExe -e 'process.exit(Number(process.versions.node.split(/[.]/)[0])===24?0:1)'
        $NodeReady = $LASTEXITCODE -eq 0
    }
    if (-not $NodeReady) {
        Write-Host 'Installing a private Node.js 24 LTS runtime...'
        $BaseUrl = 'https://nodejs.org/dist/latest-v24.x'
        $SumsPath = Join-Path $WorkDir 'SHASUMS256.txt'
        Get-AzizDownload "$BaseUrl/SHASUMS256.txt" $SumsPath
        $Pattern = '^([a-fA-F0-9]{64})\s+(node-v24\.\d+\.\d+-win-' + $NodeArch + '\.zip)$'
        $Match = Get-Content $SumsPath | Select-String -Pattern $Pattern | Select-Object -First 1
        if (-not $Match) { throw 'No supported Node.js archive found.' }
        $ExpectedHash = $Match.Matches[0].Groups[1].Value
        $ArchiveName = $Match.Matches[0].Groups[2].Value
        $NodeZip = Join-Path $WorkDir $ArchiveName
        Get-AzizDownload "$BaseUrl/$ArchiveName" $NodeZip
        if ((Get-FileHash -Algorithm SHA256 $NodeZip).Hash -ne $ExpectedHash) { throw 'Node.js checksum mismatch; installation stopped.' }
        $NodeStage = Join-Path $WorkDir 'node'
        Expand-Archive -LiteralPath $NodeZip -DestinationPath $NodeStage
        $ExtractedNode = Get-ChildItem -Directory $NodeStage | Select-Object -First 1
        if (-not $ExtractedNode) { throw 'Node.js archive is empty.' }
        if (Test-Path $NodeRoot) { Move-Item -LiteralPath $NodeRoot -Destination ($NodeRoot + '.backup.' + [guid]::NewGuid().ToString()) }
        Move-Item -LiteralPath $ExtractedNode.FullName -Destination $NodeRoot
    }
    if (-not $SourceDir) {
        Write-Host 'Downloading aziz-WA from VercaaLLC/aziz...'
        $RepoZip = Join-Path $WorkDir 'aziz.zip'
        Get-AzizDownload 'https://github.com/VercaaLLC/aziz/archive/refs/heads/main.zip' $RepoZip
        $RepoStage = Join-Path $WorkDir 'source'
        Expand-Archive -LiteralPath $RepoZip -DestinationPath $RepoStage
        $SourceDir = (Get-ChildItem -Directory $RepoStage | Select-Object -First 1).FullName
    }
    if (-not (Test-Path (Join-Path $SourceDir 'SKILL.md')) -or -not (Test-Path (Join-Path $SourceDir 'scripts\setup.mjs'))) {
        throw 'The downloaded skill is incomplete.'
    }
    $env:AZIZ_WA_HOME = $InstallDir
    $env:AZIZ_WA_DESKTOP = [Environment]::GetFolderPath('Desktop')
    $env:PATH = "$NodeRoot;$env:PATH"
    $SetupArguments = @((Join-Path $SourceDir 'scripts\setup.mjs'), '--home', $InstallDir, '--node-root', $NodeRoot, '--agent', $Agent)
    if ($NoShortcut) { $SetupArguments += '--no-shortcut' }
    & $NodeExe @SetupArguments
    if ($LASTEXITCODE -ne 0) { throw "aziz-WA setup stopped (exit $LASTEXITCODE). See the error above; rerun the same install command after resolving it." }
} finally {
    if (Test-Path $WorkDir) { Remove-Item -LiteralPath $WorkDir -Recurse -Force }
}
