import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { applyDirection, i18n } from "./i18n/index.ts";
import { App } from "./ui/App.tsx";
import "./ui/styles.css";

applyDirection(i18n.language);
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
