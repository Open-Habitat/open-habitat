import { useCallback, useEffect, useState } from "react";
import { ControlButton } from "../components/ControlElements";
import { InlineTextSetting } from "../components/InlineTextSetting";
import { ServerLanguageRow } from "../components/LanguageSettings";
import {
  SectionCard,
  SectionLead,
  ServerSection,
} from "../components/ServerSection";
import { type LanguageChoice, textNow, useText } from "../i18n";
import { serverAdministrationText } from "../text/serverAdministration";
import { ServerAccessSettings } from "./ServerAccessSettings";
import { ServerStorage } from "./ServerStorage";
import { ServerVersionRow } from "./ServerVersion";
import {
  type Administration,
  administration,
  changeAdministration,
} from "./serverAdministration";
import { ViewLinkAdministration } from "./ViewLinkSettings";

// This view never receives another user's daemon route, files or credentials.
export function ServerAdministration({
  csrf,
  section = "palvelin",
  version,
  commit,
}: {
  csrf?: string;
  section?: "palvelin" | "kayttajat" | "levy";
  version?: string;
  commit?: string;
}) {
  const t = useText(serverAdministrationText);
  if (section === "levy") return <ServerStorage csrf={csrf} />;
  if (section === "kayttajat")
    return (
      <ServerSection>
        <SectionLead>{t.accessLead}</SectionLead>
        <ServerAccessSettings csrf={csrf}>
          <ViewLinkAdministration csrf={csrf} />
        </ServerAccessSettings>
      </ServerSection>
    );
  return <GeneralSettings csrf={csrf} version={version} commit={commit} />;
}

/** Yleiset: the server's name, default language and version. */
function GeneralSettings({
  csrf,
  version,
  commit,
}: {
  csrf?: string;
  version?: string;
  commit?: string;
}) {
  const [data, setData] = useState<Administration>();
  const [error, setError] = useState("");
  const [languageSaving, setLanguageSaving] = useState(false);
  const [languageError, setLanguageError] = useState(false);
  const t = useText(serverAdministrationText);
  const reload = useCallback(async (signal?: AbortSignal) => {
    setData(await administration(signal));
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    void reload(controller.signal).catch(() => {
      if (!controller.signal.aborted)
        setError(textNow(serverAdministrationText).settingsUnavailable);
    });
    return () => controller.abort();
  }, [reload]);
  // An inline field keeps its own text and failure; a write is idempotent,
  // so trying again needs no reload first.
  const saveName = async (name: string) => {
    if (!csrf) throw new Error("unavailable");
    await changeAdministration(csrf, { name });
    await reload().catch(() => {});
  };
  const saveLanguage = async (language: LanguageChoice) => {
    if (!csrf || languageSaving) return;
    setLanguageSaving(true);
    setLanguageError(false);
    try {
      await changeAdministration(csrf, { default_language: language });
      await reload().catch(() => {});
    } catch {
      setLanguageError(true);
    } finally {
      setLanguageSaving(false);
    }
  };
  return (
    <ServerSection>
      <SectionLead>{t.lead}</SectionLead>
      <SectionCard>
        {error && (
          <div className="s-row" role="alert">
            {error}
            <ControlButton
              size="row"
              onPress={() => {
                setError("");
                void reload().catch(() => setError(t.settingsUnavailable));
              }}
            >
              {t.reloadData}
            </ControlButton>
          </div>
        )}
        {data ? (
          <>
            <InlineTextSetting
              row="server-name"
              data-testid="server-name-input"
              label={t.serverName}
              description={t.serverNameDesc}
              value={data.name}
              maxLength={80}
              disabled={!csrf}
              invalid={(draft) => (draft.trim() ? undefined : t.nameEmpty)}
              onSave={saveName}
            />
            <ServerLanguageRow
              choice={data.default_language}
              disabled={!csrf || languageSaving}
              error={languageError}
              onChange={(language) => void saveLanguage(language)}
            />
            <ServerVersionRow version={version} commit={commit} />
          </>
        ) : (
          !error && <p className="s-row">{t.loading}</p>
        )}
      </SectionCard>
    </ServerSection>
  );
}
