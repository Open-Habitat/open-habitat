export function AttachmentChips({ text }: { text: string }) {
  const refs = Array.from(
    text.matchAll(
      /(!?)\[([^\]\n]*)\]\((\/api\/v1\/attachments\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\)/g,
    ),
  );
  if (!refs.length) return null;
  return (
    <div
      className="ah-attachment-chips"
      style={{
        display: "flex",
        gap: 8,
        flexWrap: "wrap",
        maxHeight: 140,
        overflow: "auto",
      }}
    >
      {refs.map((ref) => (
        <a
          key={`${ref[3]}:${ref.index}`}
          href={ref[3]}
          download={ref[1] ? undefined : ref[2]}
          target="_blank"
          rel="noopener noreferrer"
        >
          {ref[1] ? (
            <img
              src={ref[3]}
              alt={ref[2] || "Liite"}
              loading="lazy"
              style={{ maxWidth: 180, maxHeight: 120 }}
            />
          ) : (
            <span>📎 {ref[2]}</span>
          )}
        </a>
      ))}
    </div>
  );
}
