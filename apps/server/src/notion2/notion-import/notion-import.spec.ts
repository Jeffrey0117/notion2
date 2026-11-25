import { parseNotionUrl } from './notion-url';
import { richTextToHtml } from './notion-rich-text';
import { notionPageToHtml } from './notion-to-html';
import { NotionRecordMap } from './notion-record';

const ROOT = '1a006d6b-0a1c-8076-80bc-ec252bfb9af3';

function block(id: string, type: string, extra: Record<string, any> = {}) {
  return { [id]: { value: { value: { id, type, ...extra } } } };
}

function title(text: string) {
  return { title: [[text]] };
}

describe('parseNotionUrl', () => {
  it('reads the id from the tail of a notion.site link and keeps its host', () => {
    expect(
      parseNotionUrl(
        'https://organizeddashboard.notion.site/H-a-b-i-t-T-r-a-c-k-e-r-1a006d6b0a1c807680bcec252bfb9af3',
      ),
    ).toEqual({
      pageId: ROOT,
      apiBaseUrl: 'https://organizeddashboard.notion.site/api/v3',
    });
  });

  it('is not fooled by a title that ends in hex letters', () => {
    const ref = parseNotionUrl(
      'https://www.notion.so/team/cafe-1a006d6b0a1c807680bcec252bfb9af3?pvs=4',
    );
    expect(ref.pageId).toBe(ROOT);
    expect(ref.apiBaseUrl).toBe('https://www.notion.so/api/v3');
  });

  it.each([
    'http://x.notion.site/a-1a006d6b0a1c807680bcec252bfb9af3',
    'https://127.0.0.1/a-1a006d6b0a1c807680bcec252bfb9af3',
    'https://notion.site.evil.com/a-1a006d6b0a1c807680bcec252bfb9af3',
    'https://evilnotion.so/a-1a006d6b0a1c807680bcec252bfb9af3',
    'https://www.notion.so/no-id-here',
    'not a url',
  ])('rejects %s', (url) => {
    expect(() => parseNotionUrl(url)).toThrow();
  });
});

describe('richTextToHtml', () => {
  it('applies marks and escapes markup', () => {
    expect(
      richTextToHtml([['a<b', [['b'], ['i']]], [' x'], ['link', [['a', 'https://e.com/?q="1"']]]]),
    ).toBe(
      '<em><strong>a&lt;b</strong></em> x<a href="https://e.com/?q=&quot;1&quot;">link</a>',
    );
  });

  it('drops links that are not http(s) or mailto', () => {
    expect(richTextToHtml([['x', [['a', 'javascript:alert(1)']]]])).toBe('x');
  });
});

describe('notionPageToHtml', () => {
  const map: NotionRecordMap = {
    block: {
      ...block(ROOT, 'page', {
        properties: title(' Habit '),
        format: { page_icon: '🔥' },
        content: ['h', 'b1', 'b2', 't1', 'c', 'cols', 'sub', 'btn', 'hidden', 'db', 'db2'],
      }),
      ...block('h', 'sub_header', { properties: title('Head') }),
      ...block('b1', 'bulleted_list', { properties: title('one') }),
      ...block('b2', 'bulleted_list', { properties: title('two') }),
      ...block('t1', 'to_do', { properties: { title: [['done']], checked: [['Yes']] } }),
      ...block('c', 'callout', {
        format: { page_icon: '/icons/forward_gray.svg' },
        content: ['ct'],
      }),
      ...block('ct', 'text', { properties: title('inside') }),
      ...block('cols', 'column_list', { content: ['col1', 'col2'] }),
      ...block('col1', 'column', { content: ['ct'] }),
      ...block('col2', 'column', {}),
      ...block('sub', 'page', { properties: title('Child') }),
      ...block('btn', 'button', {}),
      hidden: { value: { role: 'none' } },
      ...block('db', 'collection_view', { collection_id: 'coll', view_ids: ['v1'] }),
      ...block('db2', 'collection_view', { collection_id: 'private', view_ids: ['v2'] }),
      ...block('r1', 'page', {
        properties: { title: [['Row A']], num: [['3']], chk: [['Yes']] },
      }),
    },
    collection: {
      coll: {
        value: {
          value: {
            id: 'coll',
            name: [['Tracker']],
            schema: {
              num: { name: 'Count', type: 'number' },
              title: { name: 'Name', type: 'title' },
              chk: { name: 'Done', type: 'checkbox' },
              f: { name: 'Calc', type: 'formula' },
            },
          },
        },
      },
      private: { value: { role: 'none' } },
    },
    collection_query: {
      coll: { v1: { collection_group_results: { blockIds: ['r1'] } } },
    },
  };

  const page = notionPageToHtml(map, ROOT);

  it('takes title and emoji icon from the page', () => {
    expect(page.title).toBe('Habit');
    expect(page.icon).toBe('🔥');
  });

  it('groups list items and keeps task state', () => {
    expect(page.html).toContain('<h2>Head</h2><ul><li><p>one</p></li><li><p>two</p></li></ul>');
    expect(page.html).toContain(
      '<ul data-type="taskList"><li data-type="taskItem" data-checked="true"><p>done</p></li></ul>',
    );
  });

  it('converts callouts and columns, dropping non-emoji icons', () => {
    expect(page.html).toContain(
      '<div data-type="callout" data-callout-type="default"><p>inside</p></div>',
    );
    expect(page.html).toContain(
      '<div data-type="columns" data-layout="two_equal"><div data-type="column"><p>inside</p></div><div data-type="column"><p></p></div></div>',
    );
  });

  it('lists sub-pages for the caller and skips blocks it cannot read', () => {
    expect(page.childPageIds).toEqual(['sub']);
    expect(page.html).toContain('<p>📄 Child</p>');
  });

  it('turns a public database into a database block, computed columns dropped', () => {
    expect(page.html).toContain(
      '<div data-type="n2Database" data-database-id="n2db-placeholder-0"></div>',
    );
    expect(page.databases).toEqual([
      {
        name: 'Tracker',
        schema: [
          { id: 'c0', name: 'Count', type: 'number' },
          { id: 'c2', name: 'Done', type: 'checkbox' },
        ],
        rows: [{ title: 'Row A', values: { c0: 3, c2: true } }],
      },
    ]);
  });

  it('says so when a database is not public', () => {
    expect(page.html).toContain('這個資料庫沒有公開');
  });

  it('fails clearly when the page itself is not readable', () => {
    expect(() => notionPageToHtml({ block: {} }, ROOT)).toThrow(/not public/);
  });
});

describe('nested columns', () => {
  it('stacks a column list that sits inside a column', () => {
    const map: NotionRecordMap = {
      block: {
        ...block(ROOT, 'page', { properties: title('P'), content: ['outer'] }),
        ...block('outer', 'column_list', { content: ['o1', 'o2'] }),
        ...block('o1', 'column', { content: ['inner'] }),
        ...block('o2', 'column', { content: ['t'] }),
        ...block('inner', 'column_list', { content: ['i1', 'i2'] }),
        ...block('i1', 'column', { content: ['t'] }),
        ...block('i2', 'column', { content: ['t'] }),
        ...block('t', 'text', { properties: title('x') }),
      },
    };
    expect(notionPageToHtml(map, ROOT).html).toBe(
      '<div data-type="columns" data-layout="two_equal">' +
        '<div data-type="column"><p>x</p><p>x</p></div>' +
        '<div data-type="column"><p>x</p></div></div>',
    );
  });
});
