import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import AuthGate from "./AuthGate";
import { creerStorageFirestore } from "./lib/firestoreStorage";
import "./index.css";

window.storage = creerStorageFirestore();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthGate />
    </BrowserRouter>
  </React.StrictMode>
);
