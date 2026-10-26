import fs from 'node:fs';
import path from 'node:path';

/** JSON file cache: `key` may contain '/' for sub-folders ('scorecards/123'). */
export class FileCache {
  constructor(private readonly dir: string) {}

  private file(key: string): string {
    const safe = key
      .split('/')
      .map(part => part.replace(/[^a-zA-Z0-9._-]/g, '_'))
      .join(path.sep);
    return path.join(this.dir, `${safe}.json`);
  }

  get<T>(key: string): T | null {
    try {
      return JSON.parse(fs.readFileSync(this.file(key), 'utf8')) as T;
    } catch {
      return null;
    }
  }

  set(key: string, value: unknown): void {
    const file = this.file(key);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const tmp = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(value));
    fs.renameSync(tmp, file);
  }

  has(key: string): boolean {
    return fs.existsSync(this.file(key));
  }
}
