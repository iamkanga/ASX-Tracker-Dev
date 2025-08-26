$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
# workspace root is the parent of the scripts directory
$repoRoot = Split-Path -Parent $scriptDir
$indexPath = Join-Path $repoRoot 'index.html'
$cssPath = Join-Path $repoRoot 'style.css'

function Fail([string]$msg) { Write-Host "FAIL: $msg" -ForegroundColor Red; exit 2 }
function Pass([string]$msg) { Write-Host "PASS: $msg" -ForegroundColor Green }
function Warn([string]$msg) { Write-Host "WARN: $msg" -ForegroundColor Yellow }

if (-Not (Test-Path $indexPath)) { Fail("index.html not found at $indexPath") }
if (-Not (Test-Path $cssPath)) { Fail("style.css not found at $cssPath") }

$html = Get-Content $indexPath -Raw
$css = Get-Content $cssPath -Raw

# Check for container with id and class
if ($html -match '<[^>]*id=["'']livePriceTimestampContainer["''][^>]*class=["'']([^"'']*)["''][^>]*>') {
    $classes = $matches[1]
    if ($classes -match 'live-price-inside-sort-left') {
        Pass 'Found #livePriceTimestampContainer with class live-price-inside-sort-left'
    } else {
        Warn "Found #livePriceTimestampContainer but missing class 'live-price-inside-sort-left' (found: $classes)"
    }
} else {
    Fail 'Element with id="livePriceTimestampContainer" not found in index.html'
}

if ($html -match 'id=["'']livePriceTimestamp["'']') { Pass 'Found #livePriceTimestamp element' } else { Fail 'Element with id="livePriceTimestamp" not found in index.html' }

# CSS checks
if ($css -match '\.live-price-inside-sort-left\s*\{([\s\S]*?)\}') {
    $block = $matches[1]
    $hasJustify = $block -match 'justify-content\s*:\s*flex-start'
    $hasTextAlign = $block -match 'text-align\s*:\s*left'
    $hasTabular = $block -match 'font-variant-numeric\s*:\s*tabular-nums'
    if ($hasJustify -or $hasTextAlign) { Pass '.live-price-inside-sort-left has left-alignment (justify-content:flex-start or text-align:left)' } else { Warn '.live-price-inside-sort-left exists but no left-alignment properties found in its block' }
    if ($hasTabular) { Pass 'font-variant-numeric: tabular-nums present in .live-price-inside-sort-left (good for numeric alignment)' }
} else {
    Warn '.live-price-inside-sort-left selector not found in style.css'
}

# Check for more specific timestamp rule
if ($css -match '\.live-price-inside-sort-left[\s\S]*#livePriceTimestamp\s*\{([\s\S]*?)\}') { Pass 'Found rule targeting #livePriceTimestamp inside .live-price-inside-sort-left' }

Write-Host "`nSUMMARY:`n"
Write-Host 'Automated verification completed. Warnings indicate possible visual/style checks to confirm in browser.'
exit 0
