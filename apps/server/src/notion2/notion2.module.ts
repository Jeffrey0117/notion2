import { Module } from '@nestjs/common';
import { ImportModule } from '../integrations/import/import.module';
import { NotionImportController } from './notion-import/notion-import.controller';
import { NotionImportService } from './notion-import/notion-import.service';

/** Everything notion2 adds on top of upstream lives under this module. */
@Module({
  imports: [ImportModule],
  controllers: [NotionImportController],
  providers: [NotionImportService],
})
export class Notion2Module {}
