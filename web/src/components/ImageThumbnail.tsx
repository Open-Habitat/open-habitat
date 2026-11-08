import { useState } from "react";
import { Icon } from "./Icon";

/** A refused thumbnail never retries the full-size resource. */
export function ImageThumbnail({
  src,
  className,
}: {
  src: string;
  className?: string;
}) {
  const [failed, setFailed] = useState<string>();
  return failed === src ? (
    <span className={className} aria-hidden="true">
      <Icon name="image" />
    </span>
  ) : (
    // biome-ignore lint/a11y/noNoninteractiveElementInteractions: load failure is not a user interaction
    <img
      className={className}
      src={src}
      alt=""
      loading="lazy"
      decoding="async"
      onError={() => setFailed(src)}
    />
  );
}
