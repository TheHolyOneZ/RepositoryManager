import React from "react";

interface GlassInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  icon?: React.ReactNode;
  suffix?: React.ReactNode;
  label?: string;
}

export const GlassInput = React.forwardRef<HTMLInputElement, GlassInputProps>(
  ({ icon, suffix, label, className = "", style, ...props }, ref) => {
    const [focused, setFocused] = React.useState(false);
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
              color: focused ? "#A78BFA" : "#4A5580",
              display: "flex", transition: "color 160ms",
            }}>
              {icon}
            </span>
          )}
          <input
            ref={ref}
            className={className}
            onFocus={(e) => { setFocused(true); props.onFocus?.(e); }}
            onBlur={(e) => { setFocused(false); props.onBlur?.(e); }}
            style={{
              width: "100%",
              height: 40,
              borderRadius: 8,
              background: "rgba(255,255,255,0.06)",
              border: focused ? "1px solid rgba(139,92,246,0.48)" : "1px solid transparent",
              boxShadow: focused ? "0 0 0 3px rgba(139,92,246,0.10)" : "none",
              color: "#ECEEF5",
              fontSize: "0.875rem",
              paddingLeft: icon ? 36 : 12,
              paddingRight: suffix ? 36 : 12,
              outline: "none",
              fontFamily: "inherit",
              transition: "border-color 160ms ease, box-shadow 160ms ease, background 160ms ease",
              ...style,
            }}
            {...props}
          />
          {suffix && (
            <span style={{
              position: "absolute", right: 12, pointerEvents: "none",
              color: "#4A5580", display: "flex",
            }}>
              {suffix}
            </span>
          )}
        </div>
      </div>
    );
  }
);
GlassInput.displayName = "GlassInput";
