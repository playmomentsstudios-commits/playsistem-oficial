# Play Moments

Standalone React + Vite + Tailwind CSS application. Figma Make is not required.

## Toolchain and commands

- Node.js 22.22.0 (see .nvmrc and netlify.toml).
- pnpm 10.30.3 (see package.json packageManager).
- Install: pnpm install. Keep pnpm-lock.yaml committed.
- Development: pnpm dev (port 8443). Start the server when needed.
- Production build: pnpm build (output: dist/).
- Preview: pnpm preview.
- Formatting: pnpm format. Avoid unrelated formatting changes.

## Project structure

- src/main.tsx mounts src/App.tsx and imports src/index.css.
- src/App.tsx declares public, customer and admin routes.
- src/pages/ contains the pages; src/layouts/ contains their layouts.
- src/components/, src/contexts/, src/api/ and src/types/ contain shared code.
- vite.config.ts uses the React and Tailwind CSS v4 plugins and the @ alias for src.
- index.html provides the standalone HTML shell.
- supabase/functions/server/ contains the separate Deno/Hono backend.

## Styling

Tailwind CSS v4 is configured through @tailwindcss/vite. src/index.css imports
Tailwind and contains global styling. Preserve existing design unless the task
explicitly requests visual changes.

## Environment and deployment

Copy .env.example to .env.local for local configuration. VITE_API_URL is public
frontend configuration; never expose private backend credentials in VITE_ variables.
Netlify builds with pnpm build, publishes dist, and rewrites SPA routes to index.html.
No /api proxy is configured. Backend deployment and authentication are separate work.
