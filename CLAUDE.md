# Money Track – Figma → Code Rules

Read `AGENTS.md` first: this is Next.js 16 with breaking changes; check `node_modules/next/dist/docs/` before writing framework code.

## 1. Design System Structure

### Tokens
- Defined as **CSS custom properties** on `:root` in `src/app/globals.css` (the only token source; no Tailwind config, no JSON tokens, no Style Dictionary / transform pipeline).
- Dark mode is automatic through `@media (prefers-color-scheme: dark)` overriding the same variables (no class/data-attribute toggle).
- Print overrides the tokens again in `@media print`.

```css
:root {
  --bg: #f4f6fa;  --card: #ffffff;  --text: #0f172a;  --muted: #64748b;
  --border: #e2e8f0;  --primary: #4f46e5;  --pos: #16a34a;  --neg: #dc2626;
}
@media (prefers-color-scheme: dark) {
  :root { --bg: #0b1020; --card: #131a2e; --text: #e8ecf5; --muted: #8b97b3;
          --border: #243049; --primary: #818cf8; --pos: #4ade80; --neg: #f87171; }
}
```

- Semantic roles: `--bg` page, `--card` surfaces, `--text`/`--muted` text, `--border`, `--primary` brand/active, `--pos` income/positive, `--neg` expense/negative/danger.
- Tints are derived with `color-mix(in srgb, var(--pos) 18%, transparent)`, not extra tokens.
- No spacing/typography/radius tokens. Values are literal and recurring: radii 6/8/14px/999px (pills); gaps 4/6/8/12/16/20px; container `max-width: 1100px`; font sizes in rem (h1 1.5, h2 1.05, body 1, small 0.8–0.9).
- Font: system stack `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif` (no `next/font`, no webfonts).
- Category colors are **data**, stored per category in SQLite (`categories.color`, default `#64748b`, seeded in `src/lib/db.ts`) and applied via inline `style`/chart `fill`. Chart bars use literal `#ef4444`.

**Mapping Figma variables:** map to the existing variables above; match Figma colors to the nearest token rather than adding hex values. If a genuinely new token is needed, add it to both the light `:root` and dark block.

### Components
- Flat folder `src/components/*.tsx`, one default-exported function component per file (PascalCase file = component name): `Nav`, `SubmitButton`, `TransactionForm`, `TxTable`, `MonthPicker`, `Charts` (named exports `CategoryPie`, `DailyBars`, `TrendBars`), `AuthForm`, `ReminderManager`, etc.
- No primitive UI library (no shadcn/MUI), no Storybook, no component docs. "Primitives" are **CSS classes** (`.btn`, `.card`, `.pill`, `.tab`) used directly in JSX.
- Client components start with `"use client"`; pages in `src/app/**/page.tsx` are async Server Components that fetch data from `src/lib/queries.ts` and pass props down. Mutations are Server Actions in `src/lib/*actions.ts`, invoked via `<form action>` or `useTransition`.
- Props are typed inline; shared types in `src/lib/types.ts`.

```tsx
<button className={className} disabled={pending} aria-busy={pending}>{pending ? pendingText : children}</button>
```

### Frameworks
- Next.js 16.4 (App Router, Turbopack), React 19.3, TypeScript strict, path alias `@/*` → `src/*`.
- Charts: `recharts` 3. DB: `better-sqlite3` (`data/money.db`, server-only; in `serverExternalPackages`). Email: `nodemailer`.
- Build/lint: `npm run dev | build | start | lint` (ESLint 9 + `eslint-config-next`). No CSS preprocessor, no Tailwind.

### Assets / Icons
- Only `public/sw.js` (service worker for reminders) and `src/app/favicon.ico`. No images, videos, CDN, or `next/image` usage; no optimization config.
- **No icon library or SVG icon files.** Icons are emoji or text glyphs inline in JSX (e.g. `💸 Money Track` brand, category `emoji` column in DB, `.icon-btn` buttons with text characters). For Figma icons, use an emoji/text glyph consistent with this, or ask before adding an icon dependency or inline SVG.

### Styling Approach
- One **global stylesheet** (`src/app/globals.css`, imported in `src/app/layout.tsx`) with plain, flat, kebab-case class selectors. No CSS Modules, no CSS-in-JS, no utility framework. Occasional inline `style={{}}` for one-offs (padding tweaks, dynamic colors).
- Add new styles to `globals.css` next to related sections (commented groups: `/* buttons */`, `/* report */`, …); reuse existing classes first.
- Key classes: layout `.container`, `.page-head`, `.grid` + `.cols-4`/`.cols-2`; surface `.card`; buttons `.btn` (+ `.primary`, `.ghost`, `.danger`, `.sm`), `.icon-btn`; forms `.form-grid`, `.inline-form`, `.filters`, plain `input/select/label` element styles; tables `.table-wrap`, `.num`, `.pill.in/.out`; text `.muted`, `.pos`, `.neg`, `.error`, `.notice`; nav `.nav`, `.nav-inner`, `.active`; misc `.skeleton`, `.stat` (`.label/.value/.sub`), `.legend-row`, `.dot`, `.bar-track/.bar-fill`.
- **Responsive:** intrinsically responsive, no breakpoint media queries. Uses `flex-wrap`, `grid-template-columns: repeat(auto-fit, minmax(190px|340px|180px, 1fr))`, and `overflow-x: auto` tables. Prefer this over adding breakpoints.
- Accessibility bits present: `aria-busy`, `prefers-reduced-motion` for skeleton, print stylesheet hiding `.nav`, `.btn`, `form`, `.no-print`.

### Project Structure
```
src/app/            routes (page.tsx per route; api/ route handlers; globals.css; layout.tsx; loading.tsx)
  /, transactions, transactions/[id]/edit, loans, report, categories, login, signup, forgot-password, reset-password
src/components/     shared React components (flat)
src/lib/            server logic: db, queries, actions, auth, currency, format, mail, notify, rate, settings, types
src/proxy.ts        auth middleware (Next 16 "proxy")
public/sw.js        service worker
data/               SQLite files (never commit/edit)
```
Feature organization is by route + shared flat components; business logic never lives in components.

## 2. Figma Integration Workflow
1. `create_session` first, then `get_design_context` for the node; use `get_screenshot` for visual reference. Treat generated React+Tailwind output as a **reference only**: translate to this repo's conventions.
2. Replace Tailwind/utility classes with existing `globals.css` classes or new kebab-case classes added to `globals.css`.
3. Replace hard-coded colors with `var(--token)`; ensure the dark values look right (check Figma variable modes via `get_variable_defs`).
4. Reuse existing components (`SubmitButton`, `Nav`, `Charts`, etc.) before creating new ones; place new ones in `src/components/` as default-exported function components, `"use client"` only when state/hooks are needed.
5. Keep layouts fluid (flex-wrap/auto-fit grid, max-width 1100px); do not hard-code Figma frame widths.
6. Money values go through `money()` in `src/lib/currency.ts`; dates through `src/lib/format.ts`.
7. Validate against the Figma screenshot at desktop and ~375px widths, in light and dark.
