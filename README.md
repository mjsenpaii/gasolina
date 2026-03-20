# Live Fuel Price Tracker

A professional single-page web application for tracking fuel prices around Boac, Marinduque using:
- TypeScript
- Vite
- Google Maps JavaScript API
- Supabase
- Clean Architecture

## What changed in this version

- Fixed the blank-map issue when navigating from Admin back to Tracker by removing the fragile Google Maps callback dependency and reloading the map safely on page restore.
- On-map markers now show a gasoline icon and the selected fuel price in PHP before tap.
- Tapping a marker still opens a richer details card with all fuel prices and coordinates.
- Added a more vibrant futuristic glassmorphism UI with gradients and a cleaner premium layout.
- Replaced the insecure frontend-only admin password idea with **Supabase Auth**.

## Important security note

A password that is hardcoded in frontend browser code cannot be made truly secure or inaccessible because shipped client code can always be inspected.

This project now uses **Supabase Authentication** for the admin page instead:
- the admin password lives in Supabase, not in the frontend bundle
- insert and update operations are restricted to authenticated users in SQL policies

## Setup

1. Install dependencies
   ```bash
   npm install
   ```

2. Create your environment file
   ```bash
   cp .env.example .env
   ```

3. Add your values to `.env`
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_GOOGLE_MAPS_API_KEY`

4. Run the SQL in `supabase/schema.sql`.

5. In Supabase Dashboard, create an admin user:
   - Authentication
   - Users
   - Add user
   - use email/password

6. Start the app
   ```bash
   npm run dev
   ```

## App routes

- Public tracker: `/index.html`
- Admin dashboard: `/admin.html`

## Build

```bash
npm run build
```

## Notes

- The default map center is Boac, Marinduque.
- Fuel markers are re-rendered whenever the selected fuel type changes.
- The tracker now loads Google Maps from TypeScript instead of relying on a callback query param.
- If you exposed a Google Maps API key earlier, rotate it and restrict it before using this version.
