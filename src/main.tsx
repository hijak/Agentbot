import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { bootstrapBrand } from "./lib/brand";
import "./styles.css";

document.documentElement.classList.add("dark");
document.documentElement.style.colorScheme = "dark";

void bootstrapBrand().then(() => {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
