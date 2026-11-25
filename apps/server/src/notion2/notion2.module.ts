import { Module } from '@nestjs/common';
import { ImportModule } from '../integrations/import/import.module';
import { NotionImportController } from './notion-import/notion-import.controller';
import { NotionImportService } from './notion-import/notion-import.service';
import { N2DatabaseController } from './database/database.controller';
import { N2DatabaseRepo } from './database/database.repo';
import { N2DatabaseService } from './database/database.service';

/** Everything notion2 adds on top of upstream lives under this module. */
@Module({
  imports: [ImportModule],
  controllers: [NotionImportController, N2DatabaseController],
  providers: [NotionImportService, N2DatabaseRepo, N2DatabaseService],
})
export class Notion2Module {}
