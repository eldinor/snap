import "./babylon-bootstrap";
import "./style.css";
import { buildEditorMarkup, createEditorUi, ModularEditorApp } from "./editor";

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("App root was not found.");
}

app.innerHTML = buildEditorMarkup();

const canvas = document.querySelector<HTMLCanvasElement>("#renderCanvas");

if (!canvas) {
  throw new Error("Render canvas was not found.");
}

const ui = createEditorUi(canvas);

new ModularEditorApp(ui);
