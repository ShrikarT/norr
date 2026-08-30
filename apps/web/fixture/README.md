# Read-only design fixture

These static files exist only for offline visual QA. Every page displays a visible fixture banner, uses synthetic non-production addresses, and disables transaction controls. The production Vite entry is `src/main.tsx`; it does not enable fixture data unless `?fixture=1` is supplied deliberately during development.
