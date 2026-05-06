$ErrorActionPreference = "Stop"

Write-Host "Starting: npm install"

# Install dependencies (captures both stdout/stderr)
$output = npm install --no-audit --no-fund --progress=false 2>&1
$output | ForEach-Object { Write-Host $_ }

Write-Host "Finished: npm install (LASTEXITCODE=$LASTEXITCODE)"
Write-Host "Starting: Node verification snippet"

node -e "console.log('after npm install'); setTimeout(()=>{console.log('done verification')},5000);"

