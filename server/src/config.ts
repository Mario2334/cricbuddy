import path from 'node:path';

export interface Config {
  port: number;
  host: string;
  gristUrl: string;
  gristDocId: string;
  gristUser: string;
  gristApiKey: string | null;
  /** Lower-cased logins allowed through; ['*'] disables the check (local dev only). */
  allowedUsers: string[];
  teamId: number;
  teamName: string;
  codexBin: string | null;
  codexModel: string;
  codexReasoningEffort: string;
  codexTimeoutMs: number;
  /** Path of a canned AiReport JSON; when set, Codex is not called. */
  codexFake: string | null;
  analysisDailyCap: number;
  rosterWindow: number;
  ourWindow: number;
  oppWindow: number;
  groundWindow: number;
  cacheDir: string;
  workDir: string;
  codexDir: string;
  cricheroes: { apiKey: string; authorization: string; udid: string };
  version: string;
}

const num = (v: string | undefined, d: number): number => {
  if (v === undefined || v.trim() === '') return d;
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};
const str = (v: string | undefined, d: string): string => (v && v.trim() ? v.trim() : d);

/** Root = the folder holding dist/, codex/, cache/, work/ (the repo's server/ in dev, /root/apps/cricbuddy-api in prod). */
export function loadConfig(env: NodeJS.ProcessEnv = process.env, root: string = path.resolve(__dirname, '..')): Config {
  const docId = str(env.GRIST_DOC_ID, '');
  if (!docId && env.CRICBUDDY_ALLOW_NO_DOC !== '1') {
    throw new Error('GRIST_DOC_ID is required: run `npm run setup:grist` once and put the printed id in .env');
  }
  const cacheDir = str(env.CACHE_DIR, path.join(root, 'cache'));
  const workDir = str(env.WORK_DIR, path.join(root, 'work'));
  return {
    port: num(env.PORT, 8787),
    host: str(env.HOST, '127.0.0.1'),
    gristUrl: str(env.GRIST_URL, 'http://127.0.0.1:8484').replace(/\/+$/, ''),
    gristDocId: docId,
    gristUser: str(env.GRIST_USER, 'sanketm221995@gmail.com'),
    gristApiKey: str(env.GRIST_API_KEY, '') || null,
    allowedUsers: str(env.ALLOWED_USERS, 'sanketm221995@gmail.com')
      .split(',')
      .map(s => s.trim().toLowerCase())
      .filter(Boolean),
    teamId: num(env.TEAM_ID, 5179117),
    teamName: str(env.TEAM_NAME, 'Dev-Sena'),
    codexBin: str(env.CODEX_BIN, '') || null,
    codexModel: str(env.CODEX_MODEL, 'gpt-6.1-sol'),
    codexReasoningEffort: str(env.CODEX_REASONING_EFFORT, 'medium'),
    codexTimeoutMs: num(env.CODEX_TIMEOUT_S, 600) * 1000,
    codexFake: str(env.CODEX_FAKE, '') ? path.resolve(root, str(env.CODEX_FAKE, '')) : null,
    analysisDailyCap: num(env.ANALYSIS_DAILY_CAP, 10),
    rosterWindow: num(env.ROSTER_WINDOW, 20),
    ourWindow: num(env.OUR_WINDOW, 10),
    oppWindow: num(env.OPP_WINDOW, 5),
    groundWindow: num(env.GROUND_WINDOW, 5),
    cacheDir: path.resolve(root, cacheDir),
    workDir: path.resolve(root, workDir),
    codexDir: path.join(root, 'codex'),
    cricheroes: {
      // The same public web-client credentials the app ships with (src/services/apiService.ts).
      apiKey: str(env.CH_API_KEY, 'cr!CkH3r0s'),
      authorization: str(env.CH_AUTHORIZATION, '167a0e60-4ecf-11f0-9aaf-65c0aaccdb8b'),
      udid: str(env.CH_UDID, 'b06d1d63f90cf3493b39e534c59b6935'),
    },
    version: str(env.npm_package_version, '0.1.0'),
  };
}
