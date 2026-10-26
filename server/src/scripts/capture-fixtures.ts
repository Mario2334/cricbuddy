// Dev only: capture real CricHeroes payloads into src/__tests__/fixtures so the domain tests run offline.
//   npm run capture:fixtures            (from server/, on the Mac)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { FileCache } from '../cache/fileCache';
import { loadConfig } from '../config';
import { CricHeroesClient } from '../cricheroes/client';

async function main(): Promise<void> {
  const cfg = loadConfig({ ...process.env, CRICBUDDY_ALLOW_NO_DOC: '1' });
  const client = new CricHeroesClient({ creds: cfg.cricheroes, cache: new FileCache(fs.mkdtempSync(path.join(os.tmpdir(), 'ch-'))) });
  const dir = path.resolve(__dirname, '..', '..', 'src', '__tests__', 'fixtures');
  fs.mkdirSync(dir, { recursive: true });
  const save = (name: string, data: unknown) => {
    fs.writeFileSync(path.join(dir, name), JSON.stringify(data, null, 1));
    console.log('saved', name);
  };

  const ours = await client.teamMatches(cfg.teamId, { minPast: 20 });
  save('team-matches-ours.json', ours);
  const upcoming = ours.find(m => m.status === 'upcoming');
  const past = ours.filter(m => m.status === 'past');
  if (!upcoming || !past.length) throw new Error('need one upcoming and one past match');
  const oppId = upcoming.team_a_id === cfg.teamId ? upcoming.team_b_id : upcoming.team_a_id;
  save('team-matches-opp.json', await client.teamMatches(oppId, { minPast: 5 }));
  save('scorecard-past.json', await client.scorecard(past[0].match_id, { immutable: false }));
  try {
    save('scorecard-upcoming.json', await client.scorecard(upcoming.match_id, { immutable: false }));
  } catch (e) {
    console.warn('upcoming scorecard not available (CricHeroes often refuses fixtures):', (e as Error).message);
  }
  save('team-players-ours.json', await client.teamPlayers(cfg.teamId));
  save('team-statistic-opp.json', await client.teamStatistic(oppId));
  if (upcoming.ground_id) save('ground.json', await client.groundDetail(upcoming.ground_id));
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
