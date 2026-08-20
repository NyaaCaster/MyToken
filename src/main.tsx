import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { BLESSING } from "./version";

// 代码签名：控制台启动日志，见 src/version.ts 的 SSOT 来源
console.log(BLESSING);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
