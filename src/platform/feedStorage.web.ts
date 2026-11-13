// Browser feed snapshots are owned by protectedFetch in user-scoped IndexedDB.
// Avoid a second, unscoped persistent copy.
export default { async getItem(_key: string): Promise<string|null> {return null;}, async setItem(_key:string,_value:string){}, async removeItem(_key:string){}, async getAllKeys():Promise<string[]>{return [];}, async multiGet(_keys:readonly string[]):Promise<[string,string|null][]>{return [];}, async multiSet(_pairs:readonly (readonly [string,string])[]){}, async multiRemove(_keys:readonly string[]){} };
