import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import AuthGate from "./AuthGate";
import ErrorBoundary from "./components/ErrorBoundary";
import { creerStorageFirestore } from "./lib/firestoreStorage";
import "./index.css";

window.storage = creerStorageFirestore();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <ErrorBoundary>
        <AuthGate />
      </ErrorBoundary>
    </BrowserRouter>
  </React.StrictMode>
);
