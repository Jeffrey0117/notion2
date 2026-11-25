import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { generateJitteredKeyBetween } from 'fractional-indexing-jittered';
import { PageRepo } from '@docmost/db/repos/page/page.repo';
import { generateSlugId } from '../../common/helpers';
import { N2Database, N2DatabaseRepo, N2RowWithPage } from './database.repo';
import {
  DatabaseColumn,
  RowValues,
  sanitizeSchema,
  sanitizeValues,
  sanitizeViews,
} from './database.schema';

const MAX_TITLE = 500;
const MAX_ROWS = 5000;

interface Actor {
  userId: string;
  workspaceId: string;
}

export interface CreateDatabaseInput {
  spaceId: string;
  name?: unknown;
  schema?: unknown;
  views?: unknown;
}

export interface UpdateDatabaseInput {
  name?: unknown;
  schema?: unknown;
  views?: unknown;
}

export interface RowInput {
  title?: unknown;
  values?: unknown;
  /** place the row right after this one; null means first */
  afterRowId?: string | null;
}

function cleanTitle(title: unknown): string | undefined {
  return typeof title === 'string' ? title.trim().slice(0, MAX_TITLE) : undefined;
}

/** Drops values that no longer fit the schema (deleted column or option). */
function pruneValues(schema: DatabaseColumn[], values: RowValues): RowValues {
  return sanitizeValues(schema, values);
}

@Injectable()
export class N2DatabaseService {
  constructor(
    private readonly repo: N2DatabaseRepo,
    private readonly pageRepo: PageRepo,
  ) {}

  async getOrThrow(databaseId: string, workspaceId: string): Promise<N2Database> {
    const database =
      typeof databaseId === 'string' ? await this.repo.findById(databaseId, workspaceId) : undefined;
    if (!database) throw new NotFoundException('Database not found');
    return database;
  }

  create(input: CreateDatabaseInput, actor: Actor): Promise<N2Database> {
    const schema = sanitizeSchema(input.schema);
    return this.repo.insert({
      workspaceId: actor.workspaceId,
      spaceId: input.spaceId,
      name: cleanTitle(input.name) ?? '',
      schema,
      views: sanitizeViews(input.views, schema),
      creatorId: actor.userId,
    });
  }

  async info(database: N2Database): Promise<{ database: N2Database; rows: N2RowWithPage[] }> {
    const rows = await this.repo.listRows(database.id);
    return {
      database,
      rows: rows.map((row) => ({ ...row, values: pruneValues(database.schema, row.values) })),
    };
  }

  update(database: N2Database, input: UpdateDatabaseInput): Promise<N2Database> {
    const schema = input.schema === undefined ? database.schema : sanitizeSchema(input.schema);
    const views =
      input.views === undefined && input.schema === undefined
        ? database.views
        : sanitizeViews(input.views ?? database.views, schema);

    return this.repo.update(database.id, {
      name: cleanTitle(input.name) ?? database.name,
      schema,
      views,
    });
  }

  async remove(database: N2Database): Promise<void> {
    await this.repo.update(database.id, { deletedAt: new Date() });
  }

  async createRow(database: N2Database, input: RowInput, actor: Actor): Promise<N2RowWithPage> {
    const existing = await this.repo.listRows(database.id);
    if (existing.length >= MAX_ROWS) {
      throw new BadRequestException(`A database holds at most ${MAX_ROWS} rows`);
    }

    const position = this.positionAfter(existing, input.afterRowId);

    // Each row is a real page, so it opens in the full editor. It sits at the
    // top level of the space and is hidden from the sidebar tree.
    const page = await this.pageRepo.insertPage({
      slugId: generateSlugId(),
      title: cleanTitle(input.title) ?? '',
      position: generateJitteredKeyBetween(null, null),
      spaceId: database.spaceId,
      workspaceId: database.workspaceId,
      creatorId: actor.userId,
      lastUpdatedById: actor.userId,
    });

    const row = await this.repo.insertRow({
      databaseId: database.id,
      pageId: page.id,
      values: sanitizeValues(database.schema, input.values),
      position,
    });

    return { ...row, title: page.title, icon: page.icon, slugId: page.slugId };
  }

  async updateRow(database: N2Database, rowId: string, input: RowInput, actor: Actor) {
    const row = await this.rowOrThrow(database, rowId);

    const title = cleanTitle(input.title);
    if (title !== undefined) {
      await this.pageRepo.updatePage({ title, lastUpdatedById: actor.userId }, row.pageId);
    }

    const changes: { values?: RowValues; position?: string } = {};
    if (input.values !== undefined) {
      changes.values = {
        ...pruneValues(database.schema, row.values),
        ...sanitizeValues(database.schema, input.values),
      };
    }
    if (input.afterRowId !== undefined) {
      const others = (await this.repo.listRows(database.id)).filter((r) => r.id !== row.id);
      changes.position = this.positionAfter(others, input.afterRowId);
    }

    return Object.keys(changes).length ? this.repo.updateRow(row.id, changes) : row;
  }

  async removeRow(database: N2Database, rowId: string, actor: Actor): Promise<void> {
    const row = await this.rowOrThrow(database, rowId);
    await this.repo.deleteRow(row.id);
    // The page goes to the trash like any other deleted page.
    await this.pageRepo.removePage(row.pageId, actor.userId, actor.workspaceId);
  }

  /** If this page is a database row, the database it belongs to and its values. */
  async rowByPage(pageId: string, workspaceId: string) {
    const row = typeof pageId === 'string' ? await this.repo.findRowByPageId(pageId) : undefined;
    if (!row) return null;
    const database = await this.repo.findById(row.databaseId, workspaceId);
    if (!database) return null;
    return { database, row: { ...row, values: pruneValues(database.schema, row.values) } };
  }

  private async rowOrThrow(database: N2Database, rowId: string) {
    const row = typeof rowId === 'string' ? await this.repo.findRowById(rowId) : undefined;
    if (!row || row.databaseId !== database.id) throw new NotFoundException('Row not found');
    return row;
  }

  /** Position that sorts right after `afterRowId`; last when it is not given. */
  private positionAfter(rows: { id: string; position: string }[], afterRowId?: string | null): string {
    if (afterRowId === null) {
      return generateJitteredKeyBetween(null, rows[0]?.position ?? null);
    }
    const index = afterRowId ? rows.findIndex((row) => row.id === afterRowId) : rows.length - 1;
    const anchor = index >= 0 ? index : rows.length - 1;
    return generateJitteredKeyBetween(rows[anchor]?.position ?? null, rows[anchor + 1]?.position ?? null);
  }
}
