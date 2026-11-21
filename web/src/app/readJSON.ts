/** Read one JSON response under a byte cap, independent of status and schema. */
export async function readJSON(
  response: Response,
  limit: number,
): Promise<unknown> {
  if (
    response.headers.get("content-type")?.split(";")[0] !== "application/json"
  )
    throw Error("unavailable");
  const reader = response.body?.getReader();
  if (!reader) throw Error("invalid");
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let text = "";
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) throw Error("invalid");
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    return JSON.parse(text) as unknown;
  } catch {
    // Stop consuming malformed or oversized replies; never expose body text.
    await reader.cancel().catch(() => {});
    throw Error("invalid");
  } finally {
    reader.releaseLock();
  }
}
