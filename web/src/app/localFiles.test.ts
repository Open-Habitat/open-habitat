import { afterEach, expect, it, vi } from "vitest";
import { uploadAttachment } from "./attachments";
import { LocalFiles } from "./localFiles";
import { mutationFetch } from "./mutations";

vi.mock("./attachments", () => ({ uploadAttachment: vi.fn() }));
vi.mock("./mutations", () => ({ mutationFetch: vi.fn() }));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});
const id = "11111111-1111-4111-8111-111111111111";
const request = (name = "notes.txt") => ({
  id,
  action: "fetch",
  name,
  expires: Date.now() + 30000,
});
async function granted(permission = "granted") {
  const getFileHandle = vi.fn(async () => ({
    getFile: async () => new File(["native file"], "notes.txt"),
  }));
  const folder = {
    name: "Downloads",
    queryPermission: vi.fn(async () => permission),
    getFileHandle,
    values: async function* () {
      yield { kind: "file", name: "notes.txt" };
      yield { kind: "directory", name: "private" };
    },
  };
  Object.defineProperty(window, "showDirectoryPicker", {
    value: vi.fn(async () => folder),
    configurable: true,
  });
  const service = new LocalFiles(
    "alice",
    () => "csrf",
    () => {},
  );
  await service.grant();
  return { service, folder, getFileHandle };
}

it("claims a request before reading or uploading; only requested file crosses", async () => {
  const { service, getFileHandle } = await granted();
  vi.mocked(mutationFetch).mockResolvedValue(
    new Response("{}", { status: 200 }),
  );
  vi.mocked(uploadAttachment).mockResolvedValue({
    id,
    path: `/synthetic/attachments/${id}`,
    schema_version: 1,
    content_type: "text/plain",
    size: 11,
    reference: "",
  });
  await service.answer(request());
  expect(getFileHandle).toHaveBeenCalledExactlyOnceWith("notes.txt");
  expect(uploadAttachment).toHaveBeenCalledTimes(1);
  const writes = vi
    .mocked(mutationFetch)
    .mock.calls.map((call) => JSON.parse(String(call[2]?.body)));
  expect(writes).toEqual([
    { id, claim: expect.any(String) },
    { id, claim: writes[0].claim, complete: true, attachment: id },
  ]);
  service.dispose();
});
it("does not read after another tab claims, permission loss or traversal", async () => {
  const { service, getFileHandle, folder } = await granted();
  vi.mocked(mutationFetch).mockResolvedValue(
    new Response("{}", { status: 409 }),
  );
  await service.answer(request());
  await service.answer(request("../private"));
  folder.queryPermission.mockResolvedValue("denied");
  await service.answer(request());
  expect(getFileHandle).not.toHaveBeenCalled();
  expect(uploadAttachment).not.toHaveBeenCalled();
  expect(mutationFetch).toHaveBeenCalledTimes(1);
  expect(service.folder).toBeUndefined();
  service.dispose();
});
it("does not upload a file whose asynchronous read outlives identity disposal", async () => {
  const { service, getFileHandle } = await granted();
  let read!: (file: File) => void;
  getFileHandle.mockImplementation(async () => ({
    getFile: () =>
      new Promise<File>((resolve) => {
        read = resolve;
      }),
  }));
  vi.mocked(mutationFetch).mockResolvedValue(new Response("{}"));
  const answering = service.answer(request());
  await vi.waitFor(() => expect(read).toBeTypeOf("function"));
  service.dispose();
  read(new File(["private"], "notes.txt"));
  await answering;
  expect(uploadAttachment).not.toHaveBeenCalled();
  expect(mutationFetch).toHaveBeenCalledTimes(1);
});
it("lists only top-level files without uploading any contents", async () => {
  const { service, getFileHandle } = await granted();
  vi.mocked(mutationFetch).mockResolvedValue(new Response("{}"));
  await service.answer({ ...request(""), action: "list" });
  const done = JSON.parse(
    String(vi.mocked(mutationFetch).mock.calls[1][2]?.body),
  );
  expect(done.names).toEqual(["notes.txt"]);
  expect(getFileHandle).not.toHaveBeenCalled();
  expect(uploadAttachment).not.toHaveBeenCalled();
  service.dispose();
});

it("paginates a large folder without reading file contents", async () => {
  const { service, folder } = await granted();
  folder.values = async function* () {
    for (let n = 0; n < 205; n++) yield { kind: "file", name: `file-${n}.txt` };
  };
  vi.mocked(mutationFetch).mockResolvedValue(new Response("{}"));
  await service.answer({ ...request(""), action: "list" });
  let done = JSON.parse(
    String(vi.mocked(mutationFetch).mock.calls[1][2]?.body),
  );
  expect(done.names).toHaveLength(200);
  expect(done.next).toBe(200);
  await service.answer({ ...request(""), action: "list", offset: done.next });
  done = JSON.parse(String(vi.mocked(mutationFetch).mock.calls[3][2]?.body));
  expect(done.names).toEqual([
    "file-200.txt",
    "file-201.txt",
    "file-202.txt",
    "file-203.txt",
    "file-204.txt",
  ]);
  expect(done.next).toBeUndefined();
  expect(uploadAttachment).not.toHaveBeenCalled();
  service.dispose();
});

it("lets the daemon decide expiry despite client/server clock skew", async () => {
  const { service, getFileHandle } = await granted();
  vi.mocked(mutationFetch).mockResolvedValue(new Response("{}"));
  vi.mocked(uploadAttachment).mockResolvedValue({
    id,
    path: `/synthetic/attachments/${id}`,
    schema_version: 1,
    content_type: "text/plain",
    size: 11,
    reference: "",
  });
  await service.answer({ ...request(), expires: Date.now() + 3600000 });
  expect(getFileHandle).toHaveBeenCalledTimes(1);
  service.dispose();
});
it("reports a missing file separately from a lost upload response", async () => {
  const { service, getFileHandle } = await granted();
  vi.mocked(mutationFetch).mockResolvedValue(new Response("{}"));
  getFileHandle.mockRejectedValueOnce(
    new DOMException("synthetic", "NotFoundError"),
  );
  await service.answer(request());
  expect(
    JSON.parse(String(vi.mocked(mutationFetch).mock.calls[1][2]?.body)).error,
  ).toBe("file_not_found");
  vi.mocked(uploadAttachment).mockRejectedValueOnce(
    new Error("synthetic transport loss"),
  );
  await service.answer(request());
  expect(
    JSON.parse(String(vi.mocked(mutationFetch).mock.calls[3][2]?.body)).error,
  ).toBe("upload_unconfirmed");
  service.dispose();
});

it("bounds listing replies even when Go HTML-escapes filenames", async () => {
  const { service, folder } = await granted();
  folder.values = async function* () {
    for (let n = 0; n < 200; n++)
      yield { kind: "file", name: `${"&".repeat(60)}${n}.txt` };
  };
  vi.mocked(mutationFetch).mockResolvedValue(new Response("{}"));
  await service.answer({ ...request(""), action: "list" });
  const done = JSON.parse(
    String(vi.mocked(mutationFetch).mock.calls[1][2]?.body),
  );
  expect(done.names.length).toBeGreaterThan(0);
  expect(done.names.length).toBeLessThan(200);
  expect(done.next).toBe(done.names.length);
  const nativeJSON = JSON.stringify({
    names: done.names,
    next: done.next,
  }).replace(/&/g, "\\u0026");
  expect(new TextEncoder().encode(nativeJSON).length).toBeLessThan(64 * 1024);
  service.dispose();
});

it("skips unsupported names before paging so one file cannot poison a folder", async () => {
  const { service, folder, getFileHandle } = await granted();
  folder.values = async function* () {
    yield { kind: "file", name: "line\nbreak" };
    yield { kind: "file", name: "back\\slash" };
    yield { kind: "file", name: "ä".repeat(128) };
    for (let n = 0; n < 201; n++) yield { kind: "file", name: `ok-${n}` };
  };
  vi.mocked(mutationFetch).mockResolvedValue(new Response("{}"));
  await service.answer({ ...request(""), action: "list" });
  const first = JSON.parse(
    String(vi.mocked(mutationFetch).mock.calls[1][2]?.body),
  );
  expect(first.names).toHaveLength(200);
  expect(first.names[0]).toBe("ok-0");
  expect(first.next).toBe(200);
  await service.answer({ ...request(""), action: "list", offset: first.next });
  const last = JSON.parse(
    String(vi.mocked(mutationFetch).mock.calls[3][2]?.body),
  );
  expect(last.names).toEqual(["ok-200"]);
  await service.answer(request("ä".repeat(128)));
  expect(getFileHandle).not.toHaveBeenCalled();
  service.dispose();
});

it.each([
  ["AbortError", "aborted"],
  ["SecurityError", "security"],
  ["NotReadableError", "failed"],
])(
  "handles %s without dropping an existing grant and allows retry",
  async (name, issue) => {
    const { service, folder } = await granted();
    vi.mocked(
      (window as unknown as { showDirectoryPicker: () => Promise<unknown> })
        .showDirectoryPicker,
    ).mockRejectedValueOnce(new DOMException("private browser detail", name));
    await service.grant();
    expect(service.pickerIssue).toBe(issue);
    expect(service.folder).toBe(folder);
    await service.grant();
    expect(service.pickerIssue).toBeUndefined();
    expect(service.folder).toBe(folder);
    service.dispose();
  },
);

it("ignores picker rejection after identity disposal", async () => {
  const { service } = await granted();
  let reject!: (error: unknown) => void;
  vi.mocked(
    (window as unknown as { showDirectoryPicker: () => Promise<unknown> })
      .showDirectoryPicker,
  ).mockImplementationOnce(
    () =>
      new Promise((_, fail) => {
        reject = fail;
      }),
  );
  const picking = service.grant();
  service.dispose();
  reject(new DOMException("synthetic", "AbortError"));
  await picking;
  expect(service.pickerIssue).toBeUndefined();
  expect(service.folder).toBeUndefined();
});
