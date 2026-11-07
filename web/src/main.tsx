import "./theme";
import React from "react";
import ReactDOM from "react-dom/client";
import { Provider } from "react-redux";
import { createBrowserRouter, RouterProvider } from "react-router";
import "../../design-system/styles.css";
import "./app.css";
import { App } from "./app/App";
import { ChunkLoadBoundary } from "./app/ChunkLoadBoundary";
import { LinkPage, takeLinkToken } from "./app/LinkPage";
import { store } from "./app/store";
import { atViewEntry, ViewOpenPage } from "./app/ViewOpenPage";
import { loadSiteLanguage } from "./i18n/siteLanguage";

void loadSiteLanguage();
const viewTab = window.location.pathname === "/view" || atViewEntry();
const standalone = window.location.pathname === "/link" || viewTab;
const router = standalone
  ? undefined
  : createBrowserRouter([
      {
        path: "*",
        element: (
          <ChunkLoadBoundary>
            <App />
          </ChunkLoadBoundary>
        ),
      },
    ]);
const root = document.getElementById("root");
if (!root) throw new Error("missing #root application mount");
// The phone sign-in page stands alone: it has no session yet, and the app's
// session and snapshot reads must not run before the code is redeemed. The
// view tab page stands alone too: it only replaces itself with the view, at
// `/view?id=…` or at the view's stable address `/n/<entry>`.
ReactDOM.createRoot(root).render(
  <React.StrictMode>
    {window.location.pathname === "/link" ? (
      <LinkPage token={takeLinkToken()} />
    ) : viewTab ? (
      <ViewOpenPage />
    ) : (
      <Provider store={store}>
        {router && <RouterProvider router={router} />}
      </Provider>
    )}
  </React.StrictMode>,
);
