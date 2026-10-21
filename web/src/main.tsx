import "./theme";
import React from "react";
import ReactDOM from "react-dom/client";
import { Provider } from "react-redux";
import { createBrowserRouter, RouterProvider } from "react-router";
import "../../design-system/styles.css";
import "./app.css";
import { App } from "./app/App";
import { LinkPage, takeLinkToken } from "./app/LinkPage";
import { store } from "./app/store";

const router =
  window.location.pathname === "/link"
    ? undefined
    : createBrowserRouter([{ path: "*", element: <App /> }]);
const root = document.getElementById("root");
if (!root) throw new Error("missing #root application mount");
// The phone sign-in page stands alone: it has no session yet, and the app's
// session and snapshot reads must not run before the code is redeemed.
ReactDOM.createRoot(root).render(
  <React.StrictMode>
    {window.location.pathname === "/link" ? (
      <LinkPage token={takeLinkToken()} />
    ) : (
      <Provider store={store}>
        {router && <RouterProvider router={router} />}
      </Provider>
    )}
  </React.StrictMode>,
);
