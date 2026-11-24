import { type Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('attachments')
    .addColumn('diagram_type', 'text', (col) =>
      col.check(sql`diagram_type IN ('drawio', 'excalidraw')`),
    )
    .execute();

  // Backfill existing diagrams.
  await db
    .updateTable('attachments')
    .set({ diagram_type: sql`split_part(file_name, '.', 2)` })
    .where('type', '=', 'file')
    .where('file_name', 'in', ['diagram.drawio.svg', 'diagram.excalidraw.svg'])
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable('attachments').dropColumn('diagram_type').execute();
}
