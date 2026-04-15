import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles/globals.css";


window.addEventListener("unhandledrejection", (e) => {
  console.error("[unhandledrejection]", e.reason);
});

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <App />
);
