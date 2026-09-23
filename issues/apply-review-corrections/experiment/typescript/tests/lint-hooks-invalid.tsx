// Intentionally excluded from normal graph; copied to a temporary path by the evidence command.
import { useEffect, useState } from "react";
export function BadHooks({ enabled }: { enabled: boolean }) {
  if (enabled) {
    useState(0);
  }
  useEffect(() => console.log(enabled), []);
  return null;
}
