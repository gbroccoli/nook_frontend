# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
bun dev       # Dev server (Vite HMR)
bun build     # TypeScript type-check + production build
bun lint      # ESLint
bun preview   # Preview production build locally
```

No test runner is configured.

## Architecture

Discord-like frontend for a messaging app ("Nook"). Stack: **React 19 + TypeScript + Vite + Tailwind CSS v4 + Zustand + React Router DOM v7**.

### Path alias
`@` maps to `src/` (configured in `vite.config.ts` and TypeScript).

### Routing (`src/App.tsx`)
Two-layer guard system wraps all routes:

1. **`SetupGuard`** — hits `GET /api/v1/setup` on every public route; redirects to `/setup` if the server hasn't been initialized yet (first-run admin account creation).
2. **`AuthGuard`** — validates the stored JWT by calling `GET /api/v1/users/me`; redirects to `/login` on failure.

The protected app lives under `/app` and renders inside `AppLayout`.

### API layer (`src/api/`)
- `client.ts` — central `fetch` wrapper. All requests go to `/api/v1`. Automatically attaches `Authorization: Bearer <token>` from `localStorage`. On **401**, calls `POST /api/v1/auth/refresh` with the stored `refresh_token`, updates `localStorage`, and retries the original request once. Throws `ApiError` (with `.status` and `.body`) on failures.
- `auth.ts`, `users.ts`, `friends.ts` — thin domain wrappers over `api.get/post/patch/delete/postForm`.

### State (`src/store/auth.ts`)
Single Zustand store (`useAuthStore`) holds `user`, `isAuthenticated`, `isLoading`. `setAuth()` persists tokens to `localStorage`. `clearAuth()` removes them. The store starts with `isLoading: true`; `AuthGuard` sets it to `false` after the session check resolves.

### HWID (`src/lib/hwid.ts`)
`getHwid()` generates a pseudo hardware ID from browser characteristics (UA, screen size, timezone, CPU count, etc.), hashes them, appends a timestamp, and caches the result in `localStorage`. Sent with every auth operation (`login`, `register`, `setup`) to tie sessions to devices.

### Design system
Tailwind v4 — theme tokens are defined via `@theme` in `src/index.css` (not a `tailwind.config.js`). Use the CSS custom property names as Tailwind utilities:

| Token | Value |
|---|---|
| `bg-bg` | `#0D0F12` — page background |
| `bg-secondary` | `#171A1F` — sidebars |
| `bg-elevated` | `#1E2228` — cards, inputs |
| `text-primary` / `bg-primary` | `#00F5A0` — accent green |
| `text-text` | `#F5F7FA` |
| `text-text-secondary` | `#A8B0B8` |
| `text-text-disabled` | `#5C646C` |
| `font-sans` | Manrope (default body font) |
| `font-pixel` | Pixelify Sans |

### UI components (`src/components/ui/`)
- `Button` — variants: `primary`, `ghost`, `danger`; sizes: `sm`, `md`, `lg`; `loading` prop shows a spinner.
- `Input` — labeled input with optional `hint` text (used for char counters etc.).
- `Logo` — renders the app logo SVG.

### Settings modal (`src/pages/app/SettingsPage.tsx`)
Full-screen modal opened from the userbar. Tabs: **Profile** (display name + avatar crop via `react-easy-crop`), **Security** (placeholder), **Sessions** (lists active sessions grouped by HWID; deduplicates to latest per device), **Account** (logout / logout-all danger zone). Closed via ESC or clicking the backdrop.

### Development notes
- The Vite dev server allows `tuna.testenvenv.ru` as a host (tunnel for remote testing). API calls go to `/api/v1` — the backend must be running and accessible at the same origin or proxied.
- There is no Vite proxy configured; the backend URL must match the origin of the dev server or be served via the allowed tunnel host.
