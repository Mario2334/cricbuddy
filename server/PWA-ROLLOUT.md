# CricBuddy PWA rollout

Build with `npm run typecheck`, `npm --prefix server test`, and `npm run build:web` from the repository root. Expo stays on SDK 53. Workbox precaches the shell, icons, fonts and assets; protected API responses live in identity-scoped IndexedDB. Browser APIs use the current origin. The health endpoint alone is public.

Run `bash server/release.sh` to stage an immutable timestamped bundle on Veyden and switch `current` atomically. The service keeps `.env`, `cache/`, and `work/` at `/root/apps/cricbuddy-api/`. Health failure restores the previous symlink. Old immutable assets are copied into each new release for open clients. Keep previous release directories for rollback. To roll back manually, atomically point `current` to the prior release and restart `cricbuddy-api`.

Required provider environment: `CH_API_KEY`, `CH_AUTHORIZATION`, `CH_UDID`; optional `CH_COOKIE`, `GOOGLE_PLACES_API_KEY`, `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`. No provider credentials belong in Expo configuration. Production requires an explicit user allowlist. Local development can use `DEV_AUTH=1` and `ALLOWED_USERS=*`; wildcard auth is rejected in production. `PUBLIC_ORIGIN` must match the browser origin.

Grist schema creation adds `ScheduledMatches` without changing existing tables. Rows are scoped by authenticated user and match ID. Deleted rows remain as tombstones. Imports skip existing rows, including tombstones, and are retryable. One process serializes each user's mutations; do not run multiple API writers without a distributed lock.

Updated native clients retain `scheduledMatches`, save `scheduledMatches-backup-v1`, import once per authenticated identity, and set `calendar-migrated-v1:<user>` only after confirmation. Storage or transfer failure leaves original data untouched. Calendar changes use server-confirmed per-match writes; they are never queued offline.

Physical device acceptance still requires the user's iPhone:

- Install the updated native build using the existing signing setup; open Home/Calendar while connected to Tailscale and confirm migration.
- Open the Veyden HTTPS URL in Safari, add to Home Screen, and compare the calendar to native.
- Check safe areas, keyboard and sheets, map attribution, directions, manual clipboard paste, and all five tabs.
- After successful reads, reopen offline, check the saved timestamp and stale-score warning, verify uncached screens explain the missing connection, and verify writes fail without queuing.
- Reconnect and refresh; verify calendar and availability. On a subsequent release, leave a form open and confirm the update waits until the update action is pressed.

Retain native source, signing configuration, and refresh jobs until the migration and PWA use are confirmed. Do not retire native as part of this release.
