import { Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { Kysely, sql } from 'kysely';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import { DatabaseColumn, DatabaseView, RowValues } from './database.schema';

export interface N2Database {
  id: string;
  workspaceId: string;
  spaceId: string;
  name: string;
  schema: DatabaseColumn[];
  views: DatabaseView[];
  creatorId: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface N2DatabaseRow {
  id: string;
  databaseId: string;
  pageId: string;
  values: RowValues;
  position: string;
  createdAt: Date;
  updatedAt: Date;
}

/** A row as the client sees it: its values plus the page it opens. */
export interface N2RowWithPage extends N2DatabaseRow {
  title: string | null;
  icon: string | null;
  slugId: string;
}

/**
 * These tables are notion2's own, so they are not in upstream's generated
 * database types. They are typed here instead of regenerating that file.
 */
interface N2Tables {
  n2Databases: N2Database;
  n2DatabaseRows: N2DatabaseRow;
  pages: { id: string; title: string | null; icon: string | null; slugId: string; deletedAt: Date | null };
}

// Sent as text and cast, the way upstream repos do: a bare jsonb parameter gets
// JSON-encoded a second time by the driver and lands as a JSON string.
const json = (value: unknown) => sql`${JSON.stringify(value)}::text::jsonb` as any;

@Injectable()
export class N2DatabaseRepo {
  private readonly db: Kysely<N2Tables>;

  constructor(@InjectKysely() db: KyselyDB) {
    this.db = db as unknown as Kysely<N2Tables>;
  }

  findById(id: string, workspaceId: string): Promise<N2Database | undefined> {
    return this.db
      .selectFrom('n2Databases')
      .selectAll()
      .where('id', '=', id)
      .where('workspaceId', '=', workspaceId)
      .where('deletedAt', 'is', null)
      .executeTakeFirst();
  }

  insert(data: Pick<N2Database, 'workspaceId' | 'spaceId' | 'name' | 'schema' | 'views' | 'creatorId'>) {
    return this.db
      .insertInto('n2Databases')
      .values({ ...data, schema: json(data.schema), views: json(data.views) })
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  update(id: string, data: Partial<Pick<N2Database, 'name' | 'schema' | 'views' | 'deletedAt'>>) {
    const { schema, views, ...rest } = data;
    return this.db
      .updateTable('n2Databases')
      .set({
        ...rest,
        ...(schema ? { schema: json(schema) } : {}),
        ...(views ? { views: json(views) } : {}),
        updatedAt: new Date(),
      })
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  /** Rows whose page is in the trash are left out. */
  listRows(databaseId: string): Promise<N2RowWithPage[]> {
    return this.db
      .selectFrom('n2DatabaseRows as r')
      .innerJoin('pages as p', 'p.id', 'r.pageId')
      .select([
        'r.id',
        'r.databaseId',
        'r.pageId',
        'r.values',
        'r.position',
        'r.createdAt',
        'r.updatedAt',
        'p.title',
        'p.icon',
        'p.slugId',
      ])
      .where('r.databaseId', '=', databaseId)
      .where('p.deletedAt', 'is', null)
      .orderBy('r.position', (ob) => ob.collate('C').asc())
      .orderBy('r.id', 'asc')
      .execute();
  }

  findRowById(id: string): Promise<N2DatabaseRow | undefined> {
    return this.db.selectFrom('n2DatabaseRows').selectAll().where('id', '=', id).executeTakeFirst();
  }

  findRowByPageId(pageId: string): Promise<N2DatabaseRow | undefined> {
    return this.db
      .selectFrom('n2DatabaseRows')
      .selectAll()
      .where('pageId', '=', pageId)
      .executeTakeFirst();
  }

  async lastRowPosition(databaseId: string): Promise<string | null> {
    const last = await this.db
      .selectFrom('n2DatabaseRows')
      .select('position')
      .where('databaseId', '=', databaseId)
      .orderBy('position', (ob) => ob.collate('C').desc())
      .limit(1)
      .executeTakeFirst();
    return last?.position ?? null;
  }

  insertRow(data: Pick<N2DatabaseRow, 'databaseId' | 'pageId' | 'values' | 'position'>) {
    return this.db
      .insertInto('n2DatabaseRows')
      .values({ ...data, values: json(data.values) })
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  updateRow(id: string, data: Partial<Pick<N2DatabaseRow, 'values' | 'position'>>) {
    const { values, ...rest } = data;
    return this.db
      .updateTable('n2DatabaseRows')
      .set({ ...rest, ...(values ? { values: json(values) } : {}), updatedAt: new Date() })
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  async deleteRow(id: string): Promise<void> {
    await this.db.deleteFrom('n2DatabaseRows').where('id', '=', id).execute();
  }
}
