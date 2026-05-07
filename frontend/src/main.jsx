import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import { I18nProvider } from "./i18n.jsx";
import "./theme.css";

// EN: Wrap the entire app in I18nProvider with default language zh (Traditional Chinese).
// zh-TW: 以 I18nProvider 包裹整個 app，預設語言為繁體中文。
ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <I18nProvider defaultLang="zh">
      <App />
    </I18nProvider>
  </React.StrictMode>
);
