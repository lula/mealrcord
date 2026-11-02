fn main() {
    // The icons are embedded by `generate_context!` but cargo doesn't track them:
    // rebuild when they change, so `tauri dev` shows a new icon.
    println!("cargo:rerun-if-changed=icons");
    tauri_build::build()
}
