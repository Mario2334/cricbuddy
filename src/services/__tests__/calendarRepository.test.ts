import AsyncStorage from '@react-native-async-storage/async-storage';
jest.mock('react-native', () => ({Platform:{OS:'ios'}}));
const original = JSON.stringify([{matchId:'123',tournamentName:'Cup',teamNames:{team1:'A',team2:'B'},scheduledAt:'2026-11-14'}]);
const response=(body:unknown,ok=true)=>({ok,json:async()=>body});
beforeEach(async()=>{jest.resetModules();await AsyncStorage.clear();});
test('failed native transfer preserves original and backup and retries without a completion marker',async()=>{
  const storage = require('@react-native-async-storage/async-storage');
  await storage.setItem('scheduledMatches',original);
  const fetcher=jest.fn().mockResolvedValueOnce(response({user:'a'})).mockResolvedValueOnce(response({},false));
  globalThis.fetch=fetcher;
  const {calendarRepository}=require('../calendarRepository');
  await expect(calendarRepository.list()).rejects.toThrow();
  expect(await storage.getItem('scheduledMatches')).toBe(original);
  expect(await storage.getItem('scheduledMatches-backup-v1')).toBe(original);
  expect(await storage.getItem('calendar-migrated-v1:a')).toBeNull();
  fetcher.mockResolvedValueOnce(response({user:'a'})).mockResolvedValueOnce(response({ok:true})).mockResolvedValueOnce(response({matches:JSON.parse(original)}));
  expect(await calendarRepository.list()).toEqual(JSON.parse(original));
  expect(await storage.getItem('calendar-migrated-v1:a')).toBe('1');
  expect(await storage.getItem('scheduledMatches')).toBe(original);
});
test('unconfirmed import never marks migration complete',async()=>{
  const storage = require('@react-native-async-storage/async-storage');
  await storage.setItem('scheduledMatches',original);
  globalThis.fetch=jest.fn().mockResolvedValueOnce(response({user:'b'})).mockResolvedValueOnce(response({ok:false}));
  const {calendarRepository}=require('../calendarRepository');
  await expect(calendarRepository.list()).rejects.toThrow('not confirmed');
  expect(await storage.getItem('calendar-migrated-v1:b')).toBeNull();
});
