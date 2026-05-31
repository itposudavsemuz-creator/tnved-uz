import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";

// Глобальный CSS (анимации, сброс)
const style = document.createElement("style");
style.textContent = `
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  :focus-visible {
    outline: 2px solid #3b82f6;
    outline-offset: 2px;
  }
  ::selection {
    background: #1d4ed8;
    color: #fff;
  }
  input[type="search"]::-webkit-search-cancel-button {
    display: none;
  }
  input:focus {
    border-color: #3b82f6 !important;
  }
  @media (max-width: 600px) {
    .result-row {
      grid-template-columns: 1fr !important;
    }
  }
  /* Плавный скролл */
  html { scroll-behavior: smooth; }
  /* Скроллбар в тёмном стиле */
  ::-webkit-scrollbar { width: 6px; height: 6px; }
  ::-webkit-scrollbar-track { background: #0f172a; }
  ::-webkit-scrollbar-thumb { background: #334155; border-radius: 3px; }
  ::-webkit-scrollbar-thumb:hover { background: #475569; }
`;
document.head.appendChild(style);

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);
