Työn tai yhteyden tila. Sykkivä piste vain kun jokin on oikeasti käynnissä.

```jsx
<StatusDot tone="running" label="Työskentelee" />
```

- `running` sykkii, `ok`/`error`/`stopped` näyttävät merkin ✓ ✕ ⃠
- Oletustila (yhdistetty, odottaa viestiä) piirretään ilman labelia
- Syke katoaa `prefers-reduced-motion`-asetuksella
