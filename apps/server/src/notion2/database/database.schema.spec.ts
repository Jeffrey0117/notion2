import { sanitizeSchema, sanitizeValues, sanitizeViews } from './database.schema';

describe('sanitizeSchema', () => {
  it('keeps valid columns and gives select columns their options', () => {
    const schema = sanitizeSchema([
      { id: 'a', name: ' Status ', type: 'select', options: [{ id: 'o1', name: 'Todo', color: 'blue' }] },
      { id: 'b', name: 'Count', type: 'number', options: [{ id: 'x' }] },
    ]);
    expect(schema).toEqual([
      { id: 'a', name: 'Status', type: 'select', options: [{ id: 'o1', name: 'Todo', color: 'blue' }] },
      { id: 'b', name: 'Count', type: 'number' },
    ]);
  });

  it('repairs bad ids, duplicate ids, unknown types, empty names and bad colors', () => {
    const schema = sanitizeSchema([
      { id: 'same', name: '', type: 'formula' },
      { id: 'same', name: 'B', type: 'select', options: [{ id: 'o', name: '', color: 'url(x)' }] },
      { id: '<script>', name: 'C', type: 'text' },
    ]);
    expect(schema[0]).toMatchObject({ id: 'same', name: 'Column', type: 'text' });
    expect(schema[1].id).not.toBe('same');
    expect(schema[1].options).toEqual([{ id: 'o', name: 'Option', color: 'gray' }]);
    expect(schema[2].id).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('returns an empty schema for anything that is not a list', () => {
    expect(sanitizeSchema('nope')).toEqual([]);
    expect(sanitizeSchema(null)).toEqual([]);
  });
});

describe('sanitizeViews', () => {
  const schema = sanitizeSchema([
    { id: 's', name: 'Status', type: 'select', options: [] },
    { id: 't', name: 'Note', type: 'text' },
  ]);

  it('only lets a board group by a select column that exists', () => {
    const views = sanitizeViews(
      [
        { id: 'v1', name: 'Board', type: 'board', groupBy: 's' },
        { id: 'v2', name: 'Bad', type: 'board', groupBy: 't' },
        { id: 'v3', name: 'T', type: 'table', groupBy: 's' },
      ],
      schema,
    );
    expect(views).toEqual([
      { id: 'v1', name: 'Board', type: 'board', groupBy: 's' },
      { id: 'v2', name: 'Bad', type: 'board' },
      { id: 'v3', name: 'T', type: 'table' },
    ]);
  });

  it('always leaves at least one table view', () => {
    expect(sanitizeViews([], schema)).toMatchObject([{ type: 'table' }]);
    expect(sanitizeViews(undefined, schema)).toHaveLength(1);
  });
});

describe('sanitizeValues', () => {
  const schema = sanitizeSchema([
    { id: 'txt', name: 'T', type: 'text' },
    { id: 'num', name: 'N', type: 'number' },
    { id: 'sel', name: 'S', type: 'select', options: [{ id: 'o1', name: 'A', color: 'red' }] },
    { id: 'chk', name: 'C', type: 'checkbox' },
    { id: 'day', name: 'D', type: 'date' },
  ]);

  it('coerces each value to its column type', () => {
    expect(
      sanitizeValues(schema, { txt: 'hi', num: '3.5', sel: 'o1', chk: true, day: '2026-11-25' }),
    ).toEqual({ txt: 'hi', num: 3.5, sel: 'o1', chk: true, day: '2026-11-25' });
  });

  it('nulls values of the wrong shape and drops unknown columns', () => {
    expect(
      sanitizeValues(schema, {
        txt: 5,
        num: 'abc',
        sel: 'missing',
        chk: 'yes',
        day: '25/11/2026',
        ghost: 'x',
      }),
    ).toEqual({ txt: null, num: null, sel: null, chk: false, day: null });
  });

  it('leaves columns that were not sent untouched', () => {
    expect(sanitizeValues(schema, { num: 1 })).toEqual({ num: 1 });
    expect(sanitizeValues(schema, null)).toEqual({});
  });
});
