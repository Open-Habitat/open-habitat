Kokoaa esimerkiksi 15 tiedostolukua yhteen riviin, jonka voi avata.

```jsx
<ToolGroup title="Luettu 15 tiedostoa" counts={{ done: "✓ 15/15" }} meta="2,4 s · rinnakkain" open={open} onToggle={toggle}>
  <ToolGroupItem path="src/workspaces.ts" meta="142 riviä" />
</ToolGroup>
```

- Ryhmän avaus, lukukohta ja fokus säilyvät streamauksen aikana
- Näytä rinnakkaisuus vain jos lähde kertoo sen — älä piirrä keksittyä järjestystä
