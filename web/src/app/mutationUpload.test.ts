import { afterEach, expect, it, vi } from "vitest";
import { mutationUpload } from "./mutations";

class XHR {
  static last: XHR;
  constructor() {
    XHR.last = this;
  }
  upload = { onprogress: (_event: { loaded: number }) => {}, onload: () => {} };
  onprogress = (_event: { loaded: number }) => {};
  onload = () => {};
  onabort = () => {};
  onerror = () => {};
  response = new TextEncoder().encode("{}").buffer;
  status = 200;
  open = vi.fn();
  setRequestHeader = vi.fn();
  getResponseHeader = () => "application/json";
  send = vi.fn();
  abort = vi.fn(() => this.onabort());
}
afterEach(() => vi.unstubAllGlobals());
const file = new File(["test"], "test.txt");
function start(signal = new AbortController().signal) {
  vi.stubGlobal("XMLHttpRequest", XHR);
  const progress = vi.fn();
  const result = mutationUpload(
    "attachment.upload",
    "/api/v1/attachments",
    file,
    "csrf",
    signal,
    progress,
  );
  return { result, xhr: XHR.last, progress };
}
it("sends a File with CSRF and reports bytes without completing before the host reply", async () => {
  const { result, xhr, progress } = start();
  const settled = vi.fn();
  void result.then(settled);
  expect(xhr.open).toHaveBeenCalledWith("POST", "/api/v1/attachments");
  expect(xhr.send).toHaveBeenCalledWith(file);
  expect(xhr.setRequestHeader).toHaveBeenCalledWith(
    "X-Agent-Host-CSRF",
    "csrf",
  );
  xhr.upload.onprogress({ loaded: 2 });
  expect(progress).toHaveBeenLastCalledWith(2);
  xhr.upload.onload();
  expect(progress).toHaveBeenLastCalledWith(4);
  await Promise.resolve();
  expect(settled).not.toHaveBeenCalled();
  xhr.onload();
  expect(await (await result).json()).toEqual({});
});
it("aborts this request and rejects on cancellation or oversized reply", async () => {
  const controller = new AbortController();
  const first = start(controller.signal);
  controller.abort();
  await expect(first.result).rejects.toThrow();
  expect(first.xhr.abort).toHaveBeenCalledOnce();
  const second = start();
  second.xhr.onprogress({ loaded: 4097 });
  await expect(second.result).rejects.toThrow();
  expect(second.xhr.abort).toHaveBeenCalledOnce();
});
it("rejects malformed host replies instead of leaving the upload pending", async () => {
  const { result, xhr } = start();
  xhr.status = 205;
  xhr.onload();
  await expect(result).rejects.toThrow();
});
it("does not send with an already aborted signal; network errors reject", async () => {
  const controller = new AbortController();
  controller.abort();
  const first = start(controller.signal);
  await expect(first.result).rejects.toThrow();
  expect(first.xhr.send).not.toHaveBeenCalled();
  const second = start();
  second.xhr.onerror();
  await expect(second.result).rejects.toThrow();
});
