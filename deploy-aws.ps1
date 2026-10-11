# Run the shared deployment script from Windows PowerShell 5.1 or PowerShell 7.
# Example: .\deploy-aws.ps1 --plan
# Example: .\deploy-aws.ps1 --profile hackathon --region ap-south-1
$ErrorActionPreference = "Stop"
$deployArguments = $args
$deployScript = Join-Path $PSScriptRoot "scripts/deploy_aws.py"

foreach ($candidateName in @("py", "python", "python3")) {
    $candidate = Get-Command $candidateName -CommandType Application -ErrorAction SilentlyContinue |
        Select-Object -First 1
    if ($null -eq $candidate) {
        continue
    }

    $pythonArguments = @()
    if ($candidateName -eq "py") {
        $pythonArguments = @("-3")
    }

    try {
        $null = & $candidate.Source @pythonArguments -c "import sys; sys.exit(0 if sys.version_info >= (3, 10) else 1)" 2>$null
        if ($LASTEXITCODE -ne 0) {
            continue
        }
    } catch {
        continue
    }

    & $candidate.Source @pythonArguments $deployScript @deployArguments
    exit $LASTEXITCODE
}

[Console]::Error.WriteLine("Install Python 3.10 or newer and add it to PATH before deployment.")
exit 1
