import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { CRICBUDDY_API_URL } from '../config/server';
import { protectedFetch } from './protectedFetch';
import type { ScheduledMatch } from '../types/Match';
let migration: Promise<void> | undefined;
async function request(path: string, method = 'GET', body?: unknown) {
  const res = await protectedFetch(CRICBUDDY_API_URL + '/api/calendar/' + path, {method,headers:{'Content-Type':'application/json'},body:body === undefined ? undefined : JSON.stringify(body)});
  if (!res.ok) throw new Error('Calendar unavailable. Connect to Tailscale and try again.');
  return res.json();
}
async function migrate() {
  if (Platform.OS === 'web') return;
  // The marker is identity scoped; failed uploads keep the backup and retry next time.
  const session = await fetch(CRICBUDDY_API_URL + '/api/session');
  if (!session.ok) throw new Error('Sign in to transfer your calendar');
  const {user} = await session.json();
  const marker = 'calendar-migrated-v1:' + user;
  if (await AsyncStorage.getItem(marker)) return;
  const original = await AsyncStorage.getItem('scheduledMatches');
  if (original) {
    if (!(await AsyncStorage.getItem('scheduledMatches-backup-v1'))) await AsyncStorage.setItem('scheduledMatches-backup-v1',original);
    const result = await request('import','POST',{matches:JSON.parse(original)});
    if (!result.ok) throw new Error('Calendar transfer not confirmed');
  }
  await AsyncStorage.setItem(marker,'1');
}
async function ready() {
  if (!migration) migration = migrate().catch(e => {migration = undefined; throw e;});
  await migration;
}
export const calendarRepository = {
  async list(): Promise<ScheduledMatch[]> { await ready(); return (await request('matches')).matches; },
  async put(match: ScheduledMatch) { await ready(); await request('matches/'+match.matchId,'PUT',match); },
  async remove(id: string) { await ready(); await request('matches/'+id,'DELETE'); },
};
