import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { DataProvider } from "./lib/data";
import { ToastProvider } from "./components/toast-context";
import "./styles/tokens.css";
import "./styles/app.css";
createRoot(document.getElementById("root")!).render(<BrowserRouter><DataProvider><ToastProvider><App/></ToastProvider></DataProvider></BrowserRouter>);
