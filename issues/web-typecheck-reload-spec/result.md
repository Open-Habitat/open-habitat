# Result

The spec annotated the fetched response as `Awaited<ReturnType<typeof route.fetch>>`.
`ReturnType` of the generic `route.fetch<T>` instantiates `T` as `unknown`, so
`response.json()` was `unknown` and could not be spread (TS2698). The contract's
`Snapshot` type is also `unknown`, so there is no generated type to name. The
parsed body is now held as `unknown` and narrowed with a runtime object check
that throws on anything else, so the spread is typed without an `any` cast.

Checks: `./scripts/test-focused.sh --area web` passes (tsc, 1022 unit tests);
`--area browser --spec server-version-reload.spec.ts` with `OH_PORT_BASE=9150`
passes 3/3. Review: focused self-review (test-only change).

## Decisions for later review

None.
