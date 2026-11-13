// Protected responses never enter the service-worker cache. IndexedDB is scoped to the last verified identity.
let user: string | null = null;
let session: Promise<void> | undefined;
let blocked = false;
export const snapshotState = { cached: false, retrievedAt: '', offline: false };
const emit = () => window.dispatchEvent(new Event('cricbuddy-snapshot'));
async function db() {
  return new Promise<IDBDatabase>((resolve,reject) => {
    const req = indexedDB.open('cricbuddy-protected-v1',1);
    req.onupgradeneeded = () => req.result.createObjectStore('snapshots');
    req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error);
  });
}
async function storage(action: 'get'|'put'|'clear', key = '', value?: unknown): Promise<any> {
  try { const d = await db(); return await new Promise((resolve,reject) => {
    const tx=d.transaction('snapshots', action==='get'?'readonly':'readwrite');
    const s=tx.objectStore('snapshots'); const r=action==='get'?s.get(key):action==='put'?s.put(value,key):s.clear();
    tx.oncomplete=()=>{d.close();resolve(r.result);}; tx.onerror=()=>{d.close();reject(tx.error);};
  }); } catch { return undefined; }
}
async function timedFetch(input: Parameters<typeof fetch>[0], init: RequestInit, ms: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try { return await fetch(input, {...init, signal: init.signal ?? controller.signal}); }
  finally { clearTimeout(timer); }
}
async function identity() {
  try {
    const res=await timedFetch('/api/session',{cache:'no-store'},8000);
    if (res.status===401 || res.status===403) {blocked=true;user=null;try{localStorage.removeItem('cricbuddy-user');}catch{} await storage('clear');throw new Error('Authentication required');}
    if (!res.ok) throw new Error('Session unavailable');
    const next=(await res.json()).user;
    if (!next) throw new Error('Identity missing');
    let previous: string|null=null;try { previous=localStorage.getItem('cricbuddy-user'); }catch{}
    if (previous!==next) await storage('clear');
    user=next;blocked=false;try{localStorage.setItem('cricbuddy-user',next);}catch{}
  } catch(e) {
    if(blocked) throw e;
    try{user=localStorage.getItem('cricbuddy-user');}catch{}
    if(!user) throw e;
  }
}
window.addEventListener('focus',()=>{session=undefined;});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')session=undefined;});
window.addEventListener('online',()=>{session=undefined; snapshotState.offline=false;emit();});
export const protectedFetch: typeof fetch = async (input,init) => {
  if (!session) session=identity().catch(e=>{session=undefined;throw e;});
  await session;
  const u=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url,location.origin);
  if (u.origin!==location.origin) throw new Error('Unsupported API origin');
  const method=(init?.method ?? 'GET').toUpperCase();
  if (method!=='GET' && !navigator.onLine) throw new Error('Connect to make changes. Offline writes are not queued.');
  const keyUrl=new URL(u.href);for(const k of ['datetime','timestamp','_','refresh'])keyUrl.searchParams.delete(k);keyUrl.searchParams.sort();
  const key=user+':'+keyUrl.pathname+keyUrl.search;
  let response: Response;
  try { response=await timedFetch(input instanceof URL ? input.href : input,{...init,cache:'no-store'},15000); }
  catch(e) {
    if (method!=='GET' || blocked) throw e;
    const saved=await storage('get',key);if(!saved)throw new Error('This screen is not saved offline. Connect and refresh.');
    snapshotState.cached=true;snapshotState.offline=true;snapshotState.retrievedAt=saved.at;emit();
    return new Response(saved.body,{status:200,headers:{'content-type':'application/json','x-cricbuddy-cached-at':saved.at}});
  }
  if(response.status===401||response.status===403){blocked=true;user=null;session=undefined;try{localStorage.removeItem('cricbuddy-user');}catch{}await storage('clear');throw new Error('Authentication required');}
  if(method==='GET'&&response.ok){
    const body=await response.clone().text();
    let completed=true;if(u.pathname.endsWith('/analysis')){try{completed=!!JSON.parse(body).report;}catch{completed=false;}}
    if(completed)await storage('put',key,{body,at:new Date().toISOString()});
    // Cached status remains visible until an explicit reload, so another successful request cannot hide stale scores.
  }
  return response;
};
