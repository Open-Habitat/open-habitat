export type AgentNotice = {
  notice_id: string;
  origin: "agent";
  timestamp: string;
  text: string;
  persistence: "persisted" | "not_persisted" | "unknown";
};

// Agent text is data, not markup, a link, or a system instruction.
export function AgentNoticeCard({ notice }: { notice: AgentNotice }) {
  return (
    <aside
      className="ah-pi-extension"
      role="note"
      data-testid="agent-notice"
      data-persistence={notice.persistence}
    >
      <span>
        Agentin ilmoitus ·{" "}
        <time dateTime={notice.timestamp}>
          {new Date(notice.timestamp).toLocaleString("fi-FI")}
        </time>
      </span>
      <p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
        {notice.text}
      </p>
      {notice.persistence !== "persisted" ? (
        <p>
          {notice.persistence === "not_persisted"
            ? "Ilmoitusta ei tallennettu historiaan."
            : "Tallennusta historiaan ei voitu varmistaa."}{" "}
          Tämä ilmoitus on väliaikainen.
        </p>
      ) : null}
    </aside>
  );
}
