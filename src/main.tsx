import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Register the custom service worker (for notifications) without vite-plugin-pwa
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((error) => {
      console.error("Service worker registration failed:", error);
    });
  });
}

createRoot(document.getElementById("root")!).render(<App />);
