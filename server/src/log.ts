// One line per event; journald adds the timestamp in production, so ours is short.
type Fields = Record<string, unknown> | undefined;

function line(level: string, msg: string, fields?: Fields): string {
  const extra = fields && Object.keys(fields).length ? ' ' + JSON.stringify(fields) : '';
  return `${new Date().toISOString().slice(11, 19)} ${level} ${msg}${extra}`;
}

export const log = {
  info: (msg: string, fields?: Fields) => console.log(line('INFO', msg, fields)),
  warn: (msg: string, fields?: Fields) => console.warn(line('WARN', msg, fields)),
  error: (msg: string, fields?: Fields) => console.error(line('ERROR', msg, fields)),
};
