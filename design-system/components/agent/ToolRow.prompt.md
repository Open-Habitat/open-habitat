Yksi työkalukutsu keskustelun seassa — tiedoston luku, haku, shell-komento tai muokkaus.

```jsx
<ToolRow name="Haku" detail="readdir(" tone="ok" statusLabel="✓ 7 osumaa" />
```

- Ilman `onToggle`:a rivi ei ole avattava
- `error` värittää rivin, jotta virhe näkyy myös ryhmän ollessa kiinni
- Älä keksi kestoa tai rinnakkaisuutta: `meta` vain lähteen antamasta tiedosta
