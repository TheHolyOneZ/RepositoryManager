import { useEffect } from "react";

type KeyHandler = (e: KeyboardEvent) => void;

interface ShortcutOptions {
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
  alt?: boolean;
}

export function useKeyboard(
  key: string,
  handler: KeyHandler,
  options: ShortcutOptions = {}
): void {
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (options.ctrl !== undefined && e.ctrlKey !== options.ctrl) return;
      if (options.meta !== undefined && e.metaKey !== options.meta) return;
      if (options.shift !== undefined && e.shiftKey !== options.shift) return;
      if (options.alt !== undefined && e.altKey !== options.alt) return;
      if (e.key.toLowerCase() === key.toLowerCase()) {
        handler(e);
      }
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [key, handler, options.ctrl, options.meta, options.shift, options.alt]);
}

export function useGlobalKeyboard(handlers: Record<string, () => void>): void {
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) || target.isContentEditable;

      if (e.key === "k" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handlers["cmd+k"]?.();
        return;
      }
      if (e.key === "?" && !isInput) {
        handlers["?"]?.();
        return;
      }
      if (isInput) return;

      if (e.key === "j") handlers["j"]?.();
      if (e.key === "k") handlers["k"]?.();
      if (e.key === " ") { e.preventDefault(); handlers["space"]?.(); }
      if (e.key === "Enter") handlers["enter"]?.();
      if (e.key === "Escape") handlers["escape"]?.();
      if (e.key === "f") handlers["f"]?.();
      if (e.key === "r") handlers["r"]?.();
      if (e.key === "a") handlers["a"]?.();
      if (e.key === "d") handlers["d"]?.();
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [handlers]);
}
