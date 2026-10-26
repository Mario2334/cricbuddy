# cricbuddy-api

Game-plan backend for the CricBuddy app. One Node 20 process, no runtime dependencies:

- **HTTP API** on `127.0.0.1:8787`, exposed tailnet-only through `tailscale serve` (`https://veyden.tail2874a5.ts.net:8787`). Requests must carry the `Tailscale-User-Login` header that `tailscale serve` injects, and the login must be in `ALLOWED_USERS`.
- **Facts** are computed deterministically from CricHeroes: our last 20 scorecards (roster, roles, batting positions), the opposition's last 5, head-to-head, the last 5 matches at the ground, and a squad-gap check from the availability Sanket ticks in the app.
- **AI** runs on the host with the OpenAI Codex CLI (`codex exec -m gpt-6.1-sol --output-schema codex/schema.json`), one job at a time. The answer is validated against the pool (no invented players, 12 distinct, a full order, overs that add up, a keeper) and retried once with the checker's feedback.
- **Storage** is Grist (document "DevSena" in workspace "CricBuddy"): `Players` (roster + hand-edited `override`), `Availability`, `Analyses` (job rows with facts and report JSON). Finished scorecards are cached as JSON files under `cache/`.

## Endpoints
| | |
|---|---|
| `GET /health` | no auth |
| `GET /team/players?refresh=1` | roster with derived roles |
| `GET /matches/:id/availability?all=1` | players, entries, gaps |
| `PUT /matches/:id/availability` | `{entries:[{player_id,status,note?}]}` |
| `POST /matches/:id/analysis` | 202 queued / 200 already running / 429 daily cap / 404 not ours / 409 not upcoming |
| `GET /matches/:id/analysis` | `{job, report, stale}` |

The contract lives in `src/types.ts`; the app keeps a verbatim copy in `src/features/match-analytics/types/index.ts`.

## Develop
```
cd server && npm ci
npm test                       # builds, then node --test on dist/__tests__
cp .env.example .env.local     # GRIST_URL=https://veyden.tail2874a5.ts.net:8484, ALLOWED_USERS=*, GRIST_DOC_ID=…
npm run dev                    # http://localhost:8787 (Codex runs locally; or set CODEX_FAKE)
npm run capture:fixtures       # refresh src/__tests__/fixtures from the live API
```

## Deploy (first time)
1. `GRIST_URL=https://veyden.tail2874a5.ts.net:8484 npm run setup:grist` → prints `GRIST_DOC_ID`.
2. On the server: `mkdir -p /root/apps/cricbuddy-api`, write `/root/apps/cricbuddy-api/.env` from `.env.example` with that id.
3. `bash server/release.sh` (builds + tests here, ships `dist/`, installs `cricbuddy-api.service`, `tailscale serve --https=8787`).

Later releases: `bash server/release.sh`. Logs: `journalctl -u cricbuddy-api -f`. If Codex says the login expired: `codex login` over ssh on veyden.
