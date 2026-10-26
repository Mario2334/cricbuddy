// One-time: create the workspace + document for CricBuddy in the Veyden Grist and print its id.
//   GRIST_URL=https://veyden.tail2874a5.ts.net:8484 npm run setup:grist -- --org veyden --workspace CricBuddy --doc DevSena
import { GristClient } from '../grist/client';
import { ensureSchema } from '../grist/schema';

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

async function main(): Promise<void> {
  const url = arg('url', process.env.GRIST_URL ?? 'https://veyden.tail2874a5.ts.net:8484').replace(/\/+$/, '');
  const org = arg('org', 'veyden');
  const wsName = arg('workspace', 'CricBuddy');
  const docName = arg('doc', 'DevSena');
  const user = arg('user', process.env.GRIST_USER ?? 'sanketm221995@gmail.com');
  const apiKey = process.env.GRIST_API_KEY ?? null;

  const admin = new GristClient({ url, docId: '', user, apiKey });
  const workspaces = await admin.workspaces(org);
  let ws = workspaces.find(w => w.name === wsName);
  if (!ws) {
    const id = await admin.createWorkspace(org, wsName);
    console.log(`created workspace ${wsName} (id ${id})`);
    ws = { id, name: wsName, docs: [] };
  }
  let doc = ws.docs.find(d => d.name === docName);
  if (!doc) {
    const id = await admin.createDoc(ws.id, docName);
    console.log(`created document ${docName} (id ${id})`);
    doc = { id, name: docName };
  } else {
    console.log(`document ${docName} already exists (id ${doc.id})`);
  }
  await ensureSchema(new GristClient({ url, docId: doc.id, user, apiKey }));
  console.log(`tables ready. Put this in server/.env (and /root/apps/cricbuddy-api/.env on the server):\nGRIST_DOC_ID=${doc.id}`);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
