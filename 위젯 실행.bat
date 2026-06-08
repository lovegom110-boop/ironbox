@echo off
REM ============================================================
REM  IRONBOX widget launcher
REM  사용법:
REM   1) 아래 WIDGET_URL 의 주소를 "배포된 내 위젯 주소"로 바꾸세요.
REM      예) https://ironbox.vercel.app/widget.html
REM      (로컬 테스트면 http://localhost:8000/widget.html)
REM   2) 이 파일을 더블클릭하면 위젯이 앱 창(주소창 없는 깔끔한 창)으로 열립니다.
REM   3) 항상 위에 고정하려면 PowerToys 의 Always On Top:  Win + Ctrl + T
REM ============================================================

set "WIDGET_URL=https://ironbox-six.vercel.app/widget"

start "" msedge --app=%WIDGET_URL% --window-size=320,480
