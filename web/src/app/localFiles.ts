import { uploadAttachment } from "./attachments";
import { mutationFetch } from "./mutations";

type Folder = FileSystemDirectoryHandle & {
  queryPermission(options: { mode: "read" }): Promise<PermissionState>;
  requestPermission(options: { mode: "read" }): Promise<PermissionState>;
  values(): AsyncIterable<FileSystemHandle>;
};
type PickerWindow = Window & {
  showDirectoryPicker?: (options: { mode: "read" }) => Promise<Folder>;
};
export const localFilesSupported = () =>
  typeof (window as PickerWindow).showDirectoryPicker === "function";

// Match the daemon's portable filename boundary before listing or reading.
// One unsupported local name must not invalidate the whole folder reply.
function validName(name: string) {
  return (
    !!name &&
    name !== "." &&
    name !== ".." &&
    new TextEncoder().encode(name).length <= 255 &&
    !/[/\\\0\r\n]/.test(name)
  );
}

// Only a native permission handle is stored, keyed by authenticated identity.
// No file contents, listings, history or grant shared with the next identity.
async function savedFolder(
  identity: string,
  write?: { folder?: Folder },
): Promise<Folder | undefined> {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("open-habitat-local-folder", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("grants");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error("folder_storage_unavailable"));
  });
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction("grants", write ? "readwrite" : "readonly");
      const store = tx.objectStore("grants");
      const request = write
        ? write.folder
          ? store.put(write.folder, identity)
          : store.delete(identity)
        : store.get(identity);
      tx.oncomplete = () => resolve(write ? write.folder : request.result);
      tx.onerror = () => reject(new Error("folder_storage_unavailable"));
      tx.onabort = () => reject(new Error("folder_storage_unavailable"));
    });
  } finally {
    db.close();
  }
}

export class LocalFiles {
  folder?: Folder;
  pickerIssue?: "aborted" | "security" | "failed";
  private alive = true;
  private generation = 0;
  private requests = new Set<AbortController>();
  private storage: Promise<unknown> = Promise.resolve();
  constructor(
    private identity: string,
    private csrf: () => string | undefined,
    private changed: () => void,
  ) {}
  async restore() {
    this.alive = true;
    const generation = this.generation;
    if (!localFilesSupported()) return;
    try {
      const folder = await savedFolder(this.identity);
      if (
        folder &&
        (await folder.queryPermission({ mode: "read" })) === "granted" &&
        this.alive &&
        generation === this.generation
      ) {
        this.folder = folder;
        this.changed();
      }
    } catch {
      /* Storage/permission may be unavailable; the picker still works. */
    }
  }
  async grant() {
    const generation = this.generation;
    this.pickerIssue = undefined;
    this.changed();
    let folder: Folder | undefined;
    try {
      folder = await (window as PickerWindow).showDirectoryPicker?.({
        mode: "read",
      });
    } catch (error) {
      if (!this.alive || generation !== this.generation) return;
      // AbortError also covers sensitive-directory refusal and denied access;
      // the browser does not tell us whether the person merely cancelled.
      const name = error instanceof DOMException ? error.name : "";
      this.pickerIssue =
        name === "AbortError"
          ? "aborted"
          : name === "SecurityError"
            ? "security"
            : "failed";
      this.changed();
      return;
    }
    if (!folder || !this.alive || generation !== this.generation) return;
    this.revokePending();
    this.folder = folder;
    this.changed();
    try {
      this.storage = this.storage
        .catch(() => {})
        .then(() => savedFolder(this.identity, { folder }));
      await this.storage;
    } catch {
      /* session-only grant */
    }
  }
  private revokePending() {
    ++this.generation;
    for (const controller of this.requests) controller.abort();
    this.requests.clear();
  }
  async revoke() {
    this.revokePending();
    this.folder = undefined;
    this.pickerIssue = undefined;
    this.changed();
    this.storage = this.storage
      .catch(() => {})
      .then(() => savedFolder(this.identity, {}));
    await this.storage;
  }
  dispose() {
    this.alive = false;
    this.revokePending();
    this.folder = undefined;
  }
  async answer(payload: Record<string, unknown>) {
    const folder = this.folder,
      csrf = this.csrf(),
      generation = this.generation;
    if (
      !this.alive ||
      !folder ||
      !csrf ||
      typeof payload.id !== "string" ||
      !/^[0-9a-f-]{36}$/.test(payload.id) ||
      !["list", "fetch"].includes(String(payload.action)) ||
      typeof payload.expires !== "number" ||
      !Number.isSafeInteger(payload.expires) ||
      payload.expires <= 0
    )
      return;
    const offset = payload.offset ?? 0;
    if (
      !Number.isInteger(offset) ||
      Number(offset) < 0 ||
      Number(offset) > 100000
    )
      return;
    const name = payload.name;
    if (
      typeof name !== "string" ||
      name.length > 255 ||
      (payload.action === "fetch" && !validName(name))
    )
      return;
    const controller = new AbortController();
    this.requests.add(controller);
    // The daemon enforces its own expiry at claim time. Client/server clocks
    // need not agree, and replayed requests cannot obtain an expired claim.
    const timer = window.setTimeout(() => controller.abort(), 30000);
    const claim = crypto.randomUUID();
    const post = (body: Record<string, unknown>) =>
      mutationFetch("local-files.reply", "/api/v1/local-files", {
        method: "POST",
        credentials: "same-origin",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          "X-Agent-Host-CSRF": csrf,
        },
        body: JSON.stringify({ id: payload.id, claim, ...body }),
      });
    try {
      // Never prompt from a host event. A gesture in grant() is the only grant.
      if ((await folder.queryPermission({ mode: "read" })) !== "granted") {
        if (
          this.alive &&
          generation === this.generation &&
          this.folder === folder
        ) {
          this.folder = undefined;
          this.changed();
        }
        return;
      }
      const claimed = await post({});
      if (
        !claimed.ok ||
        !this.alive ||
        generation !== this.generation ||
        this.csrf() !== csrf
      )
        return;
      let result: Record<string, unknown>;
      let uploading = false;
      try {
        if (payload.action === "list") {
          const names: string[] = [];
          let skipped = 0;
          let more = false;
          let nameBudget = 48 * 1024;
          for await (const entry of folder.values()) {
            if (controller.signal.aborted) return;
            if (entry.kind !== "file" || !validName(entry.name)) continue;
            if (skipped++ < Number(offset)) continue;
            // Six bytes per UTF-16 unit bounds UTF-8 and Go JSON escaping
            // (including &, <, > and line separators). Leave room for both
            // completion and native response envelopes under their 64 KiB caps.
            const cost = entry.name.length * 6 + 3;
            if (names.length === 200 || cost > nameBudget) {
              more = true;
              break;
            }
            nameBudget -= cost;
            names.push(entry.name);
          }
          result = {
            names,
            ...(more ? { next: Number(offset) + names.length } : {}),
          };
        } else {
          const file = await (await folder.getFileHandle(name)).getFile();
          if (
            !this.alive ||
            generation !== this.generation ||
            this.csrf() !== csrf ||
            controller.signal.aborted
          )
            return;
          if (!file.size || file.size > 20 * 1024 * 1024) {
            result = { error: "file_size_invalid" };
          } else {
            uploading = true;
            const uploaded = await uploadAttachment(
              file,
              csrf,
              controller.signal,
            );
            result = { attachment: uploaded.id };
          }
        }
      } catch (error) {
        result = {
          error: uploading
            ? "upload_unconfirmed"
            : error instanceof DOMException &&
                ["NotFoundError", "TypeMismatchError"].includes(error.name)
              ? "file_not_found"
              : "folder_unavailable",
        };
      }
      if (
        this.alive &&
        generation === this.generation &&
        this.csrf() === csrf &&
        !controller.signal.aborted
      )
        await post({ complete: true, ...result });
    } catch {
      /* No retries: lost replies never cause another upload. */
    } finally {
      window.clearTimeout(timer);
      this.requests.delete(controller);
    }
  }
}
