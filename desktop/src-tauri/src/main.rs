// IRONBOX 위젯 — Tauri 데스크톱 셸
// 창은 tauri.conf.json 에서 배포된 widget.html(원격 URL)을 불러온다.
// 창 컨트롤(최소화/닫기)·외부 링크 열기는 shell 플러그인 + capabilities/widget.json 권한으로 동작.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .run(tauri::generate_context!())
        .expect("IRONBOX 위젯 실행 중 오류");
}
