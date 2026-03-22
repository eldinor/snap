import "@babylonjs/core/Legacy/legacy";
import "./style.css";
import { createRoot } from "react-dom/client";
import { App } from "./App";

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("App root was not found.");
}

createRoot(app).render(<App />);
