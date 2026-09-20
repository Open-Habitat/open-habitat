Harnessin kysymys, joka pysäyttää työn.

```jsx
<ApprovalCard question="Ohitetaanko piilohakemistot?" options={["Kyllä, ohita", "Näytä kaikki"]} onAnswer={answer} />
```

- Katkaisee työkaluryhmän — seuraavat kutsut aloittavat uuden ryhmän
- `supported={false}` näyttää syyn sen sijaan että piirtäisi toimimattoman painikkeen
- Vastauksen lähetys voi epäonnistua: näytä virhe ja jätä kysymys auki
