Käyttöliittymän toiminto — ensisijainen lähetys, toissijainen keskeytys, ghost pienille toiminnoille kuten kopioinnille.

```jsx
<Button variant="primary" shortcut="⏎">Lähetä jonoon</Button>
```

- `variant`: primary (korostustäyttö) · secondary (reunus) · ghost (pelkkä teksti) · danger (punainen reunus, ei punaista täyttöä)
- `shortcut` näyttää näppäinoikotien painikkeen sisällä
- Estetyn painikkeen syy kirjoitetaan viereen, ei tooltipiin
