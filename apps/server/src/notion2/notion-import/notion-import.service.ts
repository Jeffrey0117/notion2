import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PageRepo } from '@docmost/db/repos/page/page.repo';
import { Page } from '@docmost/db/types/entity.types';
import { generateSlugId } from '../../common/helpers';
import { jsonToText } from '../../collaboration/collaboration.util';
import { ImportService } from '../../integrations/import/services/import.service';
import { NotionRecordMap } from './notion-record';
import { databasePlaceholder, notionPageToHtml } from './notion-to-html';
import { ImportedDatabase } from './notion-collection';
import { N2DatabaseService } from '../database/database.service';
import { parseNotionUrl, toDashedId } from './notion-url';

/** One pasted link may pull in sub-pages; keep a single request bounded. */
const MAX_PAGES = 25;
const MAX_DEPTH = 3;

interface ImportTarget {
  userId: string;
  spaceId: string;
  workspaceId: string;
}

interface NotionApi {
  getPage(pageId: string, options?: Record<string, unknown>): Promise<NotionRecordMap>;
}

@Injectable()
export class NotionImportService {
  private readonly logger = new Logger(NotionImportService.name);

  constructor(
    private readonly pageRepo: PageRepo,
    private readonly importService: ImportService,
    private readonly databaseService: N2DatabaseService,
  ) {}

  /** Copies a public Notion page, and the sub-pages under it, into a space. */
  async importFromUrl(url: string, target: ImportTarget) {
    let ref: ReturnType<typeof parseNotionUrl>;
    try {
      ref = parseNotionUrl(url);
    } catch (err: any) {
      throw new BadRequestException(err.message);
    }

    // notion-client ships as ESM only.
    const { NotionAPI } = await import('notion-client');
    const api: NotionApi = new NotionAPI({ apiBaseUrl: ref.apiBaseUrl });

    const budget = { left: MAX_PAGES };
    const page = await this.importPage(api, ref.pageId, null, 0, budget, target);
    return { page, importedPages: MAX_PAGES - budget.left };
  }

  private async importPage(
    api: NotionApi,
    pageId: string,
    parentPageId: string | null,
    depth: number,
    budget: { left: number },
    target: ImportTarget,
  ): Promise<Page> {
    let map: NotionRecordMap;
    try {
      map = await api.getPage(pageId, { signFileUrls: false });
    } catch (err: any) {
      this.logger.warn(`Notion fetch failed for ${pageId}: ${err?.message}`);
      throw new BadRequestException(
        'Could not read that Notion page. It has to be published to the web.',
      );
    }

    let converted: ReturnType<typeof notionPageToHtml>;
    try {
      converted = notionPageToHtml(map, toDashedId(pageId));
    } catch (err: any) {
      throw new BadRequestException(err.message);
    }

    let html = converted.html;
    for (const [index, imported] of converted.databases.entries()) {
      const databaseId = await this.createDatabase(imported, target);
      html = html.replace(databasePlaceholder(index), databaseId);
    }

    const content = await this.importService.processHTML(html, target.spaceId);
    const position = await this.importService.getNewPagePosition(
      target.spaceId,
      parentPageId ?? undefined,
    );

    const page = await this.pageRepo.insertPage({
      slugId: generateSlugId(),
      title: converted.title,
      icon: converted.icon,
      content,
      textContent: jsonToText(content),
      ydoc: await this.importService.createYdoc(content),
      position,
      parentPageId,
      spaceId: target.spaceId,
      creatorId: target.userId,
      workspaceId: target.workspaceId,
      lastUpdatedById: target.userId,
    });
    budget.left -= 1;

    if (depth + 1 >= MAX_DEPTH) return page;

    for (const childId of converted.childPageIds) {
      if (budget.left <= 0) break;
      try {
        await this.importPage(api, childId, page.id, depth + 1, budget, target);
      } catch (err: any) {
        // A sub-page that is not public should not sink the whole import.
        this.logger.warn(`Skipped Notion sub-page ${childId}: ${err?.message}`);
      }
    }

    return page;
  }

  /** Builds a notion2 database, with its rows, from one read out of Notion. */
  private async createDatabase(imported: ImportedDatabase, target: ImportTarget): Promise<string> {
    const actor = { userId: target.userId, workspaceId: target.workspaceId };
    const groupBy = imported.schema.find((column) => column.type === 'select');
    const views = [
      { id: 'table', name: '表格', type: 'table' },
      ...(groupBy ? [{ id: 'board', name: '看板', type: 'board', groupBy: groupBy.id }] : []),
    ];

    const database = await this.databaseService.create(
      { spaceId: target.spaceId, name: imported.name, schema: imported.schema, views },
      actor,
    );
    for (const row of imported.rows) {
      await this.databaseService.createRow(database, { title: row.title, values: row.values }, actor);
    }
    return database.id;
  }
}
