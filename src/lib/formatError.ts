
export function formatInvokeError(err: unknown): string {
  if (err == null) return "Something went wrong.";
  if (typeof err === "string") return err.trim() || "Something went wrong.";
  if (err instanceof Error) return err.message.trim() || err.name || "Something went wrong.";

  if (typeof err === "object") {
    const o = err as Record<string, unknown>;
    const msg = o.message;
    const code = o.code;
    if (typeof msg === "string" && msg.trim()) {
      if (typeof code === "string" && code.trim()) return `${code}: ${msg.trim()}`;
      return msg.trim();
    }
    const nested = o.error;
    if (typeof nested === "string" && nested.trim()) return nested.trim();
    try {
      const s = JSON.stringify(err);
      if (s && s !== "{}") return s;
    } catch {

    }
  }

  return "Something went wrong.";
}
