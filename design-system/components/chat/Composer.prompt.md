Keskustelun syöte kaikissa tiloissa.

```jsx
<Composer value={draft} onChange={setDraft} onSend={send} working queue={queue} onInterrupt={stop} />
```

- Enter → jonoon, ⌘/Ctrl+Enter → heti, Shift+Enter → rivinvaihto; IME-koostamisen Enter ei lähetä
- Keskeytä on kiinteästi kentän alla, ei keskustelun seassa; Esc Esc tekee saman
- Estetty lähetys näyttää syyn (`disabledReason`), esim. yhteyskatkos
