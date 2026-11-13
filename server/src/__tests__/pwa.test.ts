import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CalendarRepo,validateMatch} from '../grist/calendar';
import {proxyPath,normalizePages,checkBrowserWrite} from '../http/pwa';
import type {GristClient,GristRow} from '../grist/client';
import type {IncomingMessage} from 'node:http';
const match=(id='123')=>({matchId:id,tournamentName:'Cup',teamNames:{team1:'A',team2:'B'},scheduledAt:'2026-11-14'});
function memory() {
  const rows:GristRow[]=[]; let fail=false;
  const grist={async records(_t:string,filter:any){return rows.filter(r=>r.fields.user===filter.user[0]);},async addRecords(_t:string,fields:any[]){if(fail){fail=false;throw new Error('interrupted');}rows.push(...fields.map(f=>({id:rows.length+1,fields:f})));},async patchRecords(_t:string,updates:GristRow[]){for(const r of updates)rows.find(x=>x.id===r.id)!.fields=r.fields;}} as unknown as GristClient;
  return {repo:new CalendarRepo(grist),interrupt:()=>{fail=true;}};
}
test('proxy pins hosts, paths, IDs and pagination',()=>{
  assert.equal(proxyPath('/team/get-team-match/42?pageno=2'),'/team/get-team-match/42?pageno=2');
  for(const p of ['https://evil.test/team/get-team-match/42','/team/get-team-match/0','/team/get-team-match/42?pagesize=9999','/team/get-team-match/42?url=https://evil.test','/admin','//evil.test/a'])assert.throws(()=>proxyPath(p));
  assert.equal(normalizePages({page:{next:'https://api.cricheroes.in/api/v1/team/get-team-match/42?pageno=2'}}).page.next,'/api/cricheroes/team/get-team-match/42?pageno=2');
  assert.equal(normalizePages({page:{next:'https://evil.test'}}).page.next,'');
});
test('browser writes reject cross origin and accept native requests',()=>{
  const req=(headers:any)=>({method:'PUT',headers}) as IncomingMessage;
  assert.throws(()=>checkBrowserWrite(req({origin:'https://evil.test'}),'https://good.test'));
  assert.doesNotThrow(()=>checkBrowserWrite(req({origin:'https://good.test'}),'https://good.test'));
  assert.doesNotThrow(()=>checkBrowserWrite(req({}),'https://good.test'));
});
test('calendar validates payloads and isolates identities',async()=>{
  const {repo}=memory();assert.throws(()=>validateMatch({matchId:'x'}));await repo.put('a','123',match());assert.equal((await repo.list('a')).length,1);assert.deepEqual(await repo.list('b'),[]);
});
test('concurrent duplicate imports preserve edits and deletion markers',async()=>{
  const {repo}=memory();await Promise.all([repo.import('a',[match(),match()]),repo.import('a',[match()])]);assert.equal((await repo.list('a')).length,1);
  await repo.put('a','123',{...match(),tournamentName:'Edited'});await repo.import('a',[match()]);assert.equal((await repo.list('a'))[0].tournamentName,'Edited');
  await repo.put('a','123',null);await repo.import('a',[match()]);assert.deepEqual(await repo.list('a'),[]);
});
test('interrupted import remains retryable',async()=>{
  const {repo,interrupt}=memory();interrupt();await assert.rejects(repo.import('a',[match()]));await repo.import('a',[match()]);assert.equal((await repo.list('a')).length,1);
});
