# sterkir-pabbar

Scaffolded with the TypeScript 7 + oxc toolchain (`astro`).

```sh
bun install
bun run dev
bun run check   # lint, format, astro check, members' area typecheck, tests and build
```

- **Type-check:** `astro check` on typescript@5 (Volar embeds the TS API — no TS7)
- **Lint:** oxlint (`oxlint.config.ts`)
- **Format:** oxfmt (`bun run format`)

The repo holds three packages: the landing page (`src/`), the members' area (`innri/`) and the
Sanity Studio (`studio/`). Start with `CLAUDE.md`; decisions are in `docs/decisions.md`.
