import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { GitFork, Key, ArrowRight, Copy, Check, ExternalLink, X, ChevronRight } from "lucide-react";
import { useAccountStore } from "../../stores/accountStore";
import { useUIStore } from "../../stores/uiStore";
import { githubAddPat, githubDeviceFlowStart, githubDeviceFlowPoll } from "../../lib/tauri/commands";
import type { DeviceFlowStart } from "../../lib/tauri/types";
import { isTauriApp } from "../../lib/tauri/runtime";
import { formatInvokeError } from "../../lib/formatError";
import { AppLogoMark } from "../../components/icons/AppLogoMark";

type AuthStep = "choose" | "pat" | "device-flow" | "device-waiting";

export const AuthPage: React.FC = () => {
  const [step, setStep] = useState<AuthStep>("choose");
  const [inTauri, setInTauri] = useState(true);
  const [pat, setPat] = useState("");
  const [patLabel, setPatLabel] = useState("");
  const [clientId, setClientId] = useState("");
  const [deviceFlow, setDeviceFlow] = useState<DeviceFlowStart | null>(null);
  const [copied, setCopied] = useState(false);
  const [deviceError, setDeviceError] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const addAccount = useAccountStore((s) => s.addAccount);
  const addToast = useUIStore((s) => s.addToast);

  useEffect(() => { setInTauri(isTauriApp()); }, []);

  const handlePAT = async () => {
    if (!pat.trim()) return;
    setLoading(true); setError("");
    try {
      const account = await githubAddPat(pat.trim(), patLabel.trim() || "Personal Token");
      addAccount(account);
      addToast({ type: "success", title: "Connected", message: `Signed in as ${account.login}` });
    } catch (e: unknown) { setError(formatInvokeError(e)); }
    finally { setLoading(false); }
  };

  const handleDeviceFlowStart = async () => {
    if (!clientId.trim()) return;
    setLoading(true); setDeviceError(""); setError("");
    try {
      const flow = await githubDeviceFlowStart(clientId.trim());
      setDeviceFlow(flow);
      setStep("device-waiting");
      const interval = Math.max(Number(flow.interval) || 5, 5);
      githubDeviceFlowPoll(clientId.trim(), flow.device_code, interval)
        .then((account) => {
          addAccount(account);
          addToast({ type: "success", title: "Connected", message: `Signed in as ${account.login}` });
        })
        .catch((e: unknown) => {
          const msg = formatInvokeError(e);
          setDeviceError(msg);
          if (msg.includes("TIMEOUT") || msg.includes("EXPIRED") || msg.includes("ACCESS_DENIED")) setStep("device-flow");
        });
    } catch (e: unknown) { setError(formatInvokeError(e)); }
    finally { setLoading(false); }
  };

  const copyCode = () => {
    if (deviceFlow?.user_code) { void navigator.clipboard.writeText(deviceFlow.user_code); setCopied(true); setTimeout(() => setCopied(false), 2000); }
  };

  const reset = () => { setDeviceFlow(null); setDeviceError(""); setStep("choose"); setError(""); setPat(""); setPatLabel(""); setClientId(""); };

  return (
    <div
      className="flex h-full items-center justify-center relative overflow-hidden"
      style={{ background: "#04050E" }}
    >
      <div className="pointer-events-none absolute inset-0">
        <div style={{
          position: "absolute", top: "-10%", left: "20%", width: "60%", height: "55%",
          borderRadius: "50%",
          background: "radial-gradient(ellipse, rgba(109,60,220,0.18) 0%, rgba(139,92,246,0.06) 45%, transparent 70%)",
          filter: "blur(2px)",
        }} />
        <div style={{
          position: "absolute", bottom: "-5%", right: "10%", width: "40%", height: "40%",
          borderRadius: "50%",
          background: "radial-gradient(ellipse, rgba(6,182,212,0.08) 0%, transparent 65%)",
        }} />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 w-full"
        style={{ maxWidth: 440, margin: "0 32px" }}
      >
        <div className="flex flex-col items-center mb-10">
          <div
            className="flex items-center justify-center mb-4"
            style={{
              boxShadow: "0 0 48px rgba(139,92,246,0.30), 0 8px 32px rgba(0,0,0,0.40)",
              borderRadius: 20,
            }}
          >
            <AppLogoMark size={64} />
          </div>
          <h1
            style={{
              fontSize: "1.75rem", fontWeight: 800, letterSpacing: "-0.035em",
              lineHeight: 1.15, color: "#ECEEF5", textAlign: "center",
            }}
          >
            ZRepoManager
          </h1>
          <p style={{ marginTop: 6, fontSize: "0.9375rem", color: "#555E7A", textAlign: "center" }}>
            GitHub portfolio management, done right.
          </p>
        </div>

        <div
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.09)",
            borderRadius: 20,
            padding: "32px",
            boxShadow: "0 20px 60px rgba(0,0,0,0.45), 0 1px 0 rgba(255,255,255,0.06) inset",
          }}
        >
          <AnimatePresence mode="wait">
            {step === "choose" && (
              <motion.div key="choose"
                initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.2 }}
              >
                <p style={{ fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#4A5580", marginBottom: 8 }}>
                  Authentication
                </p>
                <h2 style={{ fontSize: "1.3125rem", fontWeight: 700, letterSpacing: "-0.025em", color: "#ECEEF5", marginBottom: 6 }}>
                  Connect to GitHub
                </h2>
                <p style={{ fontSize: "0.875rem", color: "#556080", marginBottom: 28 }}>
                  Select how you want to authenticate your account.
                </p>

                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <BigAuthButton
                    icon={<GitFork size={22} strokeWidth={1.75} />}
                    label="GitHub OAuth"
                    sub="Authorize via Device Flow — no password"
                    onClick={() => setStep("device-flow")}
                    disabled={!inTauri}
                    accent
                  />
                  <BigAuthButton
                    icon={<Key size={22} strokeWidth={1.75} />}
                    label="Personal Access Token"
                    sub="Paste a PAT with repo + delete_repo scope"
                    onClick={() => setStep("pat")}
                    disabled={!inTauri}
                  />
                </div>

                {!inTauri && (
                  <p style={{ marginTop: 18, fontSize: "0.75rem", textAlign: "center", color: "#4A5580" }}>
                    Desktop app required for authentication.
                  </p>
                )}
              </motion.div>
            )}

            {step === "pat" && (
              <motion.div key="pat"
                initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.2 }}
              >
                <BackBtn onClick={reset} />
                <h2 style={{ fontSize: "1.1875rem", fontWeight: 700, letterSpacing: "-0.025em", color: "#ECEEF5", marginBottom: 6, marginTop: 16 }}>
                  Personal Access Token
                </h2>
                <p style={{ fontSize: "0.8125rem", color: "#556080", lineHeight: 1.6, marginBottom: 24 }}>
                  Create a token at <span style={{ color: "#A78BFA" }}>GitHub → Settings → Developer settings → PATs</span> with{" "}
                  <code style={{ background: "rgba(139,92,246,0.15)", color: "#A78BFA", padding: "1px 6px", borderRadius: 4, fontSize: 11 }}>repo</code>{" "}
                  and{" "}
                  <code style={{ background: "rgba(139,92,246,0.15)", color: "#A78BFA", padding: "1px 6px", borderRadius: 4, fontSize: 11 }}>delete_repo</code> scopes.
                </p>

                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <Field placeholder="Label  (e.g. Work Laptop)" value={patLabel} onChange={(e) => setPatLabel(e.target.value)} />
                  <Field type="password" placeholder="ghp_••••••••••••••••••••••" value={pat}
                    onChange={(e) => setPat(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handlePAT()}
                    mono icon={<Key size={13} />} />
                  {error && <Err msg={error} />}
                  <PrimaryBtn onClick={handlePAT} loading={loading} disabled={!pat.trim()}>
                    Connect account
                  </PrimaryBtn>
                </div>
              </motion.div>
            )}

            {step === "device-flow" && (
              <motion.div key="device-flow"
                initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.2 }}
              >
                <BackBtn onClick={reset} />
                <h2 style={{ fontSize: "1.1875rem", fontWeight: 700, letterSpacing: "-0.025em", color: "#ECEEF5", marginBottom: 6, marginTop: 16 }}>
                  GitHub OAuth setup
                </h2>
                <p style={{ fontSize: "0.8125rem", color: "#556080", lineHeight: 1.6, marginBottom: 20 }}>
                  Create a <span style={{ color: "#22D3EE", fontWeight: 500 }}>GitHub OAuth App</span> with{" "}
                  <span style={{ color: "#ECEEF5", fontWeight: 500 }}>Device Flow</span> enabled, then paste its Client ID.
                </p>

                <ol style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 22 }}>
                  {[
                    "Create a GitHub OAuth App (any name / homepage URL).",
                    "Set callback URL to http://localhost (required field).",
                    "Enable Device Flow in the app's Advanced settings.",
                    "Copy the Client ID (not the client secret).",
                  ].map((txt, i) => (
                    <li key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: "0.8125rem", color: "#556080", lineHeight: 1.55 }}>
                      <span style={{
                        flexShrink: 0, width: 20, height: 20, borderRadius: "50%",
                        background: "rgba(139,92,246,0.14)", color: "#A78BFA",
                        fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center",
                      }}>{i + 1}</span>
                      <span>{txt}</span>
                    </li>
                  ))}
                </ol>

                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <Field label="Client ID" placeholder="Ov23li••••••••••••••••••" value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleDeviceFlowStart()} />
                  {error && <Err msg={error} />}
                  {deviceError && <Err msg={deviceError} />}
                  <PrimaryBtn onClick={handleDeviceFlowStart} loading={loading} disabled={!clientId.trim()}>
                    <ExternalLink size={15} strokeWidth={1.75} />
                    Authorize with GitHub
                  </PrimaryBtn>
                </div>
              </motion.div>
            )}

            {step === "device-waiting" && deviceFlow && (
              <motion.div key="device-waiting"
                initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.2 }}
              >
                <h2 style={{ fontSize: "1.1875rem", fontWeight: 700, letterSpacing: "-0.025em", color: "#ECEEF5", marginBottom: 4 }}>
                  Waiting for authorization
                </h2>
                <p style={{ fontSize: "0.8125rem", color: "#556080", marginBottom: 24 }}>
                  Open GitHub and enter the code below to continue.
                </p>

                <div style={{
                  borderRadius: 14, padding: "24px 20px", textAlign: "center", marginBottom: 16,
                  background: "linear-gradient(145deg, rgba(109,60,220,0.14) 0%, rgba(139,92,246,0.08) 100%)",
                  border: "1px solid rgba(139,92,246,0.24)",
                }}>
                  <p style={{ fontSize: "0.625rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#5C4590", marginBottom: 10 }}>
                    Your code
                  </p>
                  <p style={{
                    fontSize: "2.25rem", fontWeight: 800, letterSpacing: "0.22em", color: "#C4B5FD",
                    fontFamily: "'Cascadia Code','Consolas',monospace", lineHeight: 1,
                  }}>
                    {deviceFlow.user_code}
                  </p>
                </div>

                <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
                  <button onClick={copyCode} style={{
                    flex: 1, height: 44, borderRadius: 10, border: "1px solid rgba(255,255,255,0.09)",
                    background: "rgba(255,255,255,0.05)", color: "#9CA3B8",
                    fontSize: "0.8125rem", fontWeight: 500, cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                    transition: "all 140ms ease",
                  }}>
                    {copied ? <Check size={14} /> : <Copy size={14} />}
                    {copied ? "Copied!" : "Copy code"}
                  </button>
                  <a href={deviceFlow.verification_uri} target="_blank" rel="noopener noreferrer" style={{
                    flex: 1, height: 44, borderRadius: 10,
                    background: "linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%)",
                    border: "1px solid rgba(167,139,250,0.35)",
                    color: "#fff", fontSize: "0.8125rem", fontWeight: 600, cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                    boxShadow: "0 4px 20px rgba(139,92,246,0.30)",
                    textDecoration: "none",
                  }}>
                    Open GitHub <ExternalLink size={13} />
                  </a>
                </div>

                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 16, color: "#3A4560", fontSize: "0.75rem" }}>
                  <span style={{
                    width: 12, height: 12, borderRadius: "50%",
                    border: "2px solid #3A4560", borderTopColor: "#8B5CF6",
                    display: "inline-block", animation: "spin 1s linear infinite",
                  }} />
                  Polling for authorization…
                </div>

                {deviceError && <Err msg={deviceError} />}
                <button onClick={reset} style={{
                  width: "100%", height: 38, borderRadius: 8, border: "none", background: "transparent",
                  color: "#3A4560", fontSize: "0.75rem", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
                }}>
                  <X size={11} /> Cancel
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <p style={{ marginTop: 20, textAlign: "center", fontSize: "0.75rem", color: "#2D364F" }}>
          Tokens are stored in the desktop shell only — never in the cloud.
        </p>
      </motion.div>
    </div>
  );
};


const BigAuthButton: React.FC<{
  icon: React.ReactNode; label: string; sub: string;
  onClick: () => void; disabled?: boolean; accent?: boolean;
}> = ({ icon, label, sub, onClick, disabled, accent }) => {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: "100%", padding: "16px 20px", borderRadius: 14, cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.4 : 1, textAlign: "left",
        display: "flex", alignItems: "center", gap: 16,
        background: hovered
          ? (accent ? "rgba(139,92,246,0.16)" : "rgba(255,255,255,0.08)")
          : (accent ? "rgba(139,92,246,0.09)" : "rgba(255,255,255,0.04)"),
        border: accent
          ? `1px solid ${hovered ? "rgba(139,92,246,0.40)" : "rgba(139,92,246,0.22)"}`
          : `1px solid ${hovered ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.08)"}`,
        transition: "all 150ms ease",
        boxShadow: hovered && accent ? "0 4px 24px rgba(139,92,246,0.18)" : "none",
      }}
    >
      <span style={{
        width: 48, height: 48, borderRadius: 12, flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: accent ? "rgba(139,92,246,0.18)" : "rgba(255,255,255,0.07)",
        color: accent ? "#A78BFA" : "#6B7A9B",
        transition: "all 150ms ease",
      }}>
        {icon}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: "0.9375rem", fontWeight: 600, color: "#ECEEF5", marginBottom: 2, letterSpacing: "-0.01em" }}>
          {label}
        </p>
        <p style={{ fontSize: "0.75rem", color: "#556080" }}>{sub}</p>
      </div>
      <ChevronRight size={16} style={{ color: accent ? "#8B5CF6" : "#2D3650", flexShrink: 0 }} />
    </button>
  );
};

const BackBtn: React.FC<{ onClick: () => void }> = ({ onClick }) => (
  <button
    onClick={onClick}
    style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      fontSize: "0.8125rem", color: "#4A5580", background: "none", border: "none",
      cursor: "pointer", padding: 0, transition: "color 140ms",
    }}
    onMouseEnter={(e) => (e.currentTarget.style.color = "#8991A4")}
    onMouseLeave={(e) => (e.currentTarget.style.color = "#4A5580")}
  >
    <ArrowRight size={13} style={{ transform: "rotate(180deg)" }} />
    Back
  </button>
);

interface FieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string; icon?: React.ReactNode; mono?: boolean;
}
const Field: React.FC<FieldProps> = ({ label, icon, mono, ...props }) => {
  const [focused, setFocused] = useState(false);
  return (
    <div>
      {label && (
        <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 500, color: "#556080", marginBottom: 6 }}>
          {label}
        </label>
      )}
      <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
        {icon && (
          <span style={{
            position: "absolute", left: 12, pointerEvents: "none",
            color: focused ? "#A78BFA" : "#4A5580", transition: "color 160ms",
            display: "flex",
          }}>{icon}</span>
        )}
        <input
          {...props}
          onFocus={(e) => { setFocused(true); props.onFocus?.(e); }}
          onBlur={(e) => { setFocused(false); props.onBlur?.(e); }}
          style={{
            width: "100%", height: 48, borderRadius: 10,
            background: "rgba(255,255,255,0.055)",
            border: focused ? "1px solid rgba(139,92,246,0.50)" : "1px solid transparent",
            boxShadow: focused ? "0 0 0 3px rgba(139,92,246,0.10)" : "none",
            color: "#ECEEF5", fontSize: "0.875rem",
            paddingLeft: icon ? 36 : 14, paddingRight: 14,
            fontFamily: mono ? "'Cascadia Code','Consolas',monospace" : "inherit",
            outline: "none", transition: "border-color 160ms ease, box-shadow 160ms ease, background 160ms ease",
            ...props.style,
          }}
        />
      </div>
    </div>
  );
};

const PrimaryBtn: React.FC<{
  onClick?: () => void; loading?: boolean; disabled?: boolean; children: React.ReactNode;
}> = ({ onClick, loading, disabled, children }) => (
  <button
    onClick={onClick}
    disabled={disabled || loading}
    style={{
      width: "100%", height: 50, borderRadius: 12, marginTop: 4,
      background: disabled ? "rgba(139,92,246,0.35)" : "linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%)",
      border: "1px solid rgba(167,139,250,0.35)",
      color: "#fff", fontSize: "0.9375rem", fontWeight: 600, cursor: disabled || loading ? "not-allowed" : "pointer",
      display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
      boxShadow: disabled ? "none" : "0 4px 24px rgba(139,92,246,0.30), 0 1px 0 rgba(255,255,255,0.12) inset",
      transition: "all 150ms ease", letterSpacing: "-0.01em",
      opacity: disabled ? 0.6 : 1,
    }}
  >
    {loading
      ? <span style={{ width: 18, height: 18, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.35)", borderTopColor: "#fff", animation: "spin 0.8s linear infinite", display: "inline-block" }} />
      : children}
  </button>
);

const Err: React.FC<{ msg: string }> = ({ msg }) => (
  <div style={{
    padding: "10px 14px", borderRadius: 10,
    background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.18)",
    fontSize: "0.75rem", color: "#F87171", lineHeight: 1.5,
  }}>{msg}</div>
);
