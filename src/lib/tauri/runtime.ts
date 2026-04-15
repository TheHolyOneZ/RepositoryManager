
export function isTauriApp(): boolean {
  return (
    typeof window !== "undefined" &&
    Boolean((window as Window & { __TAURI_INTERNALS__?: { invoke?: unknown } }).__TAURI_INTERNALS__?.invoke)
  );
}

export const TAURI_REQUIRED_MESSAGE =
  "Run the desktop app: open a terminal in this project and use pnpm tauri dev. Sign in from the app window — not from a normal browser tab at localhost:1420.";

export function assertTauriApp(): void {
  if (!isTauriApp()) {
    throw new Error(TAURI_REQUIRED_MESSAGE);
  }
}
