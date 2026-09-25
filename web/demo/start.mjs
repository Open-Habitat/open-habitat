import { createServer } from "vite";
import { responseFor } from "./fixtures.mjs";

// No CLI flags: do not allow Vite's --host/--https overrides on this entrypoint.
process.env.VITE_SYNTHETIC_DEMO = "true";
const host = "127.0.0.1";
const port = 4184;
const server = await createServer({
  configFile: new URL("../vite.config.ts", import.meta.url).pathname,
  server: { host, port, strictPort: true, https: false },
  plugins: [
    {
      name: "synthetic-loopback-only",
      configureServer(dev) {
        dev.middlewares.use((req, res, next) => {
          if (
            req.headers.host !== `${host}:${port}` ||
            req.socket.localAddress !== host
          ) {
            res.writeHead(403).end("Loopback only");
            return;
          }
          const url = new URL(req.url ?? "/", `http://${host}:${port}`);
          // Vite's editor endpoint launches a subprocess. Never expose it, or
          // permit cross-site requests to the rehearsal listener.
          if (
            url.pathname === "/__open-in-editor" ||
            url.pathname.startsWith("/__open-in-editor/") ||
            req.headers["sec-fetch-site"] === "cross-site"
          ) {
            res.writeHead(404).end("Not available in the synthetic demo");
            return;
          }
          if (url.pathname === "/api/v1/snapshot") {
            const requested = url.searchParams.get("scenario");
            const cookie =
              /(?:^|; )demo_scenario=(ready|empty|partial|missing|unavailable|login)(?:;|$)/.exec(
                req.headers.cookie ?? "",
              )?.[1];
            const scenario = requested ?? cookie ?? "ready";
            const { status, body } = responseFor(scenario);
            if (requested && status !== 404)
              res.setHeader(
                "Set-Cookie",
                `demo_scenario=${scenario}; Path=/; SameSite=Strict; HttpOnly`,
              );
            res.writeHead(status, {
              "Content-Type": "application/json; charset=utf-8",
              "Cache-Control": "no-store",
              "X-Content-Type-Options": "nosniff",
            });
            res.end(body ? JSON.stringify(body) : "{}");
            return;
          }
          if (
            url.pathname.startsWith("/auth/") ||
            url.pathname.startsWith("/fixture/")
          ) {
            res
              .writeHead(404)
              .end("No authentication or test provider in synthetic demo");
            return;
          }
          next();
        });
      },
    },
  ],
});
await server.listen();
const address = server.httpServer?.address();
if (
  !address ||
  typeof address === "string" ||
  address.address !== host ||
  address.port !== port
) {
  await server.close();
  throw new Error("Synthetic server refused non-loopback bind");
}
console.log(
  `Synthetic-only HTTP demo: http://${host}:${port}/workspaces?scenario=ready`,
);
