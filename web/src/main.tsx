import "./theme";
import React from "react";
import ReactDOM from "react-dom/client";
import { Provider } from "react-redux";
import { BrowserRouter } from "react-router";
import "../../design-system/styles.css";
import "./app.css";
import { App } from "./app/App";
import { store } from "./app/store";

const root = document.getElementById("root");
if (!root) throw new Error("missing #root application mount");
ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <Provider store={store}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </Provider>
  </React.StrictMode>,
);
