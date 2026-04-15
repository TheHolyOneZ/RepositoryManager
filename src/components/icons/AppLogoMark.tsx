import React from "react";


import iconPng from "../../assets/icon.png";

export const AppLogoMark: React.FC<{ className?: string; size?: number }> = ({
  className = "",
  size = 32,
}) => (
  <img
    src={iconPng}
    width={size}
    height={size}
    alt="ZRepoManager"
    aria-hidden
    draggable={false}
    className={className}
    style={{
      borderRadius: Math.round(size * 0.28),
      display: "block",
      objectFit: "contain",
      userSelect: "none",
    }}
  />
);
