# match-analytics

The **Game plan** tab of MatchDetail, shown only for an upcoming Dev-Sena match. It talks to `cricbuddy-api`
(`server/` in this repo, hosted on the Veyden server, tailnet-only) which computes the facts from CricHeroes and
asks the Codex CLI for the plan. Grist on that server stores players, availability and analyses.

- `types/` — the API contract, a verbatim copy of `server/src/types.ts` (plus `GamePlanMatch`). Keep both in sync.
- `services/analyticsApiClient.ts` — fetch wrapper; GETs retry briefly, writes never; failures carry a `kind`
  (`unreachable` means "turn Tailscale on").
- `hooks/useAvailability.ts` — roster + yes/maybe/no per player, optimistic taps saved in one debounced PUT, gaps from the server.
- `hooks/useMatchAnalysis.ts` — latest job/report; polls every 5 s only while a job is active and the screen is focused and foregrounded.
- `components/` — `GamePlanTab` and its cards (`AvailabilityCard`, `AnalysisStatusCard`, `OppositionCard`, `BestXIICard`,
  `BattingOrderCard`, `BowlingPlanCard`, `GroundPitchCard`), all built from `src/ui`.
- `utils/teamIds.ts` — finds Dev-Sena and the opponent in whatever shape MatchDetail has (fixture, legacy list, scorecard).

Local server: `cd server && npm run dev`, then start the app with `EXPO_PUBLIC_CRICBUDDY_API_URL=http://localhost:8787`.
