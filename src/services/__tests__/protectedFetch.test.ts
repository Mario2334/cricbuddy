import {IDBFactory} from 'fake-indexeddb';
const data = new Map<string,string>();
const events = new EventTarget();
let online = true;
let fetcher: jest.Mock;
beforeEach(()=>{
  jest.resetModules();data.clear();online=true;
  Object.defineProperty(globalThis,'window',{configurable:true,value:events});
  Object.defineProperty(globalThis,'document',{configurable:true,value:new EventTarget()});
  Object.defineProperty(globalThis,'location',{configurable:true,value:{origin:'https://test.local'}});
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:{get onLine(){return online;}}});
  Object.defineProperty(globalThis,'indexedDB',{configurable:true,value:new IDBFactory()});
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(k:string)=>data.get(k)??null,setItem:(k:string,v:string)=>data.set(k,v),removeItem:(k:string)=>data.delete(k)}});
  fetcher=jest.fn();globalThis.fetch=fetcher;
});
const json=(value:unknown,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json'}});
test('offline reads normalize timestamp but preserve page and filters; writes are blocked',async()=>{
  fetcher.mockResolvedValueOnce(json({user:'a'})).mockResolvedValueOnce(json({score:100}));
  const {protectedFetch,snapshotState}=require('../protectedFetch.web');
  await protectedFetch('/api/cricheroes/match/get-my-web-Matches?datetime=1&pageno=1');
  fetcher.mockRejectedValue(new Error('offline'));online=false;
  const cached=await protectedFetch('/api/cricheroes/match/get-my-web-Matches?pageno=1&datetime=2');
  expect(await cached.json()).toEqual({score:100});expect(snapshotState.cached).toBe(true);expect(snapshotState.retrievedAt).toBeTruthy();
  await expect(protectedFetch('/api/cricheroes/match/get-my-web-Matches?pageno=2')).rejects.toThrow('not saved');
  await expect(protectedFetch('/api/calendar/matches/123',{method:'PUT'})).rejects.toThrow('not queued');
});
test('authentication rejection clears saved responses and prevents reuse',async()=>{
  fetcher.mockResolvedValueOnce(json({user:'a'})).mockResolvedValueOnce(json({private:'data'}));
  const {protectedFetch}=require('../protectedFetch.web');await protectedFetch('/api/calendar/matches');
  fetcher.mockResolvedValueOnce(json({},401));await expect(protectedFetch('/api/calendar/matches')).rejects.toThrow('Authentication');
  expect(data.has('cricbuddy-user')).toBe(false);
  fetcher.mockRejectedValue(new Error('offline'));await expect(protectedFetch('/api/calendar/matches')).rejects.toThrow();
});
test('identity changes clear the previous user snapshots',async()=>{
  fetcher.mockResolvedValueOnce(json({user:'a'})).mockResolvedValueOnce(json({private:'a'}));
  const {protectedFetch}=require('../protectedFetch.web');await protectedFetch('/api/calendar/matches');
  events.dispatchEvent(new Event('focus'));
  fetcher.mockResolvedValueOnce(json({user:'b'})).mockRejectedValueOnce(new Error('offline'));
  await expect(protectedFetch('/api/calendar/matches')).rejects.toThrow('not saved');
});
test('IndexedDB failure does not prevent successful network reads',async()=>{
  Object.defineProperty(globalThis,'indexedDB',{configurable:true,value:{open(){throw new Error('quota');}}});
  fetcher.mockResolvedValueOnce(json({user:'a'})).mockResolvedValueOnce(json({matches:[]}));
  const {protectedFetch}=require('../protectedFetch.web');expect(await (await protectedFetch('/api/calendar/matches')).json()).toEqual({matches:[]});
});
