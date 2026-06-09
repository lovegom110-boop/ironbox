# autostart-toggle.ps1
#  IRONBOX 위젯 자동실행 켜기/끄기 토글
#  - 시작프로그램 폴더에 위젯 바로가기가 있으면  → 빼기(끄기)
#  - 없으면 설치된 위젯 바로가기를 찾아 복사     → 넣기(켜기)
#  ※ 위젯은 크롬 PWA이므로, 크롬에서 "앱으로 설치"가 되어 있어야 켤 수 있습니다.

$ErrorActionPreference = 'Stop'
$appName = 'IRONBOX 위젯'
$startup = [Environment]::GetFolderPath('Startup')
$dst     = Join-Path $startup ($appName + '.lnk')

function Find-Source {
  $roots = @(
    (Join-Path $env:APPDATA   'Microsoft\Windows\Start Menu\Programs'),
    (Join-Path $env:ProgramData 'Microsoft\Windows\Start Menu\Programs')
  )
  foreach ($r in $roots) {
    if (Test-Path -LiteralPath $r) {
      $hit = Get-ChildItem -LiteralPath $r -Recurse -Filter '*.lnk' -ErrorAction SilentlyContinue |
             Where-Object { $_.BaseName -eq $appName -and $_.FullName -ne $dst } |
             Select-Object -First 1
      if ($hit) { return $hit.FullName }
    }
  }
  return $null
}

Write-Host ''
if (Test-Path -LiteralPath $dst) {
  Remove-Item -LiteralPath $dst -Force
  Write-Host '  [ 자동실행  꺼짐 ]' -ForegroundColor Yellow
  Write-Host '  이제 Windows를 켜도 위젯이 자동으로 뜨지 않아요.'
  Write-Host '  다시 켜려면 이 파일을 한 번 더 더블클릭하세요.'
}
else {
  $src = Find-Source
  if (-not $src) {
    Write-Host '  [ 못 켰어요 ]' -ForegroundColor Red
    Write-Host '  설치된 위젯 바로가기(IRONBOX 위젯)를 찾지 못했어요.'
    Write-Host '  크롬에서 위젯을 "앱으로 설치" 한 뒤 다시 시도해 주세요.'
  }
  else {
    Copy-Item -LiteralPath $src -Destination $dst -Force
    Write-Host '  [ 자동실행  켜짐 ]' -ForegroundColor Green
    Write-Host '  이제 Windows에 로그인하면 위젯이 자동으로 떠요.'
    Write-Host '  끄려면 이 파일을 한 번 더 더블클릭하세요.'
  }
}
Write-Host ''
