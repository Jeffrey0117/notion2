// End-to-end check of the notion2 database endpoints against the running local app.
// usage: node scripts/notion2/db-check.mjs data/dev-token.txt <spaceId>
// It creates a database, exercises every endpoint, and deletes what it made.
import fs from 'node:fs';

const token = fs.readFileSync(process.argv[2], 'utf8').trim();
const spaceId = process.argv[3];
const base = `${process.env.NOTION2_URL ?? 'http://127.0.0.1:4491'}/api`;

async function call(path, body, auth = true) {
  const res = await fetch(`${base}/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, data: json.data ?? json };
}

const results = [];
const check = (name, ok, detail = '') => results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`);

const noAuth = await call('n2/databases/info', { databaseId: 'x' }, false);
check('no login is refused', noAuth.status === 401, String(noAuth.status));

const created = await call('n2/databases/create', {
  spaceId,
  name: 'API 測試',
  schema: [
    { id: 'st', name: '狀態', type: 'select', options: [{ id: 'todo', name: '未開始', color: 'gray' }, { id: 'done', name: '完成', color: 'green' }] },
    { id: 'n', name: '數量', type: 'number' },
    { id: 'bad', name: 'X', type: 'formula' },
  ],
  views: [{ id: 'b', name: '看板', type: 'board', groupBy: 'st' }],
});
const db = created.data;
check('create', created.status === 200 && db.schema.length === 3, `status ${created.status}`);
check('unknown column type becomes text', db.schema[2]?.type === 'text');

const r1 = await call('n2/databases/rows/create', { databaseId: db.id, title: '第一列', values: { st: 'todo', n: '5', ghost: 1 } });
const r2 = await call('n2/databases/rows/create', { databaseId: db.id, title: '第二列', values: { st: 'nope' } });
check('row create coerces values', r1.data.values.n === 5 && r1.data.values.st === 'todo' && !('ghost' in r1.data.values), JSON.stringify(r1.data.values));
check('unknown option is dropped', r2.data.values.st === null);

await call('n2/databases/rows/update', { databaseId: db.id, rowId: r1.data.id, title: '改過的標題', values: { st: 'done' } });
let info = await call('n2/databases/info', { databaseId: db.id });
const row1 = info.data.rows.find((r) => r.id === r1.data.id);
check('row update keeps other values', row1.title === '改過的標題' && row1.values.st === 'done' && row1.values.n === 5, JSON.stringify(row1.values));
check('rows come back in order', info.data.rows.map((r) => r.id).join() === [r1.data.id, r2.data.id].join());

const byPage = await call('n2/databases/row-by-page', { pageId: r1.data.pageId });
check('row-by-page finds the row', byPage.data.row?.id === r1.data.id && byPage.data.database?.id === db.id);

const sidebar = await call('pages/sidebar-pages', { spaceId });
const sidebarIds = (sidebar.data.items ?? []).map((p) => p.id);
check('row pages stay out of the sidebar', sidebar.status === 200 && !sidebarIds.includes(r1.data.pageId), `sidebar has ${sidebarIds.length} pages`);

const page = await call('pages/info', { pageId: r1.data.pageId });
check('row page opens as a normal page', page.status === 200 && page.data.title === '改過的標題', String(page.status));

await call('n2/databases/update', { databaseId: db.id, schema: db.schema.filter((c) => c.id !== 'n') });
info = await call('n2/databases/info', { databaseId: db.id });
check('deleting a column hides its values', !('n' in info.data.rows[0].values));

await call('n2/databases/rows/delete', { databaseId: db.id, rowId: r2.data.id });
info = await call('n2/databases/info', { databaseId: db.id });
check('row delete', info.data.rows.length === 1);

const otherRow = await call('n2/databases/rows/update', { databaseId: db.id, rowId: '00000000-0000-7000-8000-000000000000', title: 'x' });
check('unknown row is 404', otherRow.status === 404, String(otherRow.status));

await call('n2/databases/rows/delete', { databaseId: db.id, rowId: r1.data.id });
const removed = await call('n2/databases/delete', { databaseId: db.id });
const gone = await call('n2/databases/info', { databaseId: db.id });
check('database delete', removed.status === 200 && gone.status === 404, `${removed.status}/${gone.status}`);

console.log(results.join('\n'));
