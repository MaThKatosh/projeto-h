// App de computador: uma janela que abre a tela "Conectar ao servidor" e,
// depois, o próprio sistema do hotel. Não guarda dados do hotel.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("não foi possível abrir o app");
}
