import { useState } from "react";
import { Loader, UnstyledButton } from "@mantine/core";
import { IconLayoutKanban, IconTable } from "@tabler/icons-react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { buildPageUrl } from "@/features/page/page.utils.ts";
import { BoardView } from "./board-view";
import { TextCell } from "./cells";
import { useDatabase, useDatabaseActions } from "./database-api";
import { DatabaseRow } from "./database-types";
import { TableView } from "./table-view";
import classes from "./database.module.css";

interface DatabaseViewProps {
  databaseId: string;
  editable: boolean;
}

const VIEW_ICONS = { table: IconTable, board: IconLayoutKanban };

/** One database: its name, the switch between its views, and the active view. */
export function DatabaseView({ databaseId, editable }: DatabaseViewProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { spaceSlug } = useParams();
  const { data, isLoading, isError } = useDatabase(databaseId);
  const actions = useDatabaseActions(databaseId);
  const [activeViewId, setActiveViewId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className={classes.empty}>
        <Loader size="xs" />
      </div>
    );
  }

  if (isError || !data) {
    return <div className={classes.empty}>{t("This database is gone or you cannot see it.")}</div>;
  }

  const { database } = data;
  const view = database.views.find((v) => v.id === activeViewId) ?? database.views[0];
  const openRow = (row: DatabaseRow) =>
    navigate(buildPageUrl(spaceSlug, row.slugId, row.title ?? ""));

  return (
    <div className={classes.database}>
      <TextCell
        className={classes.databaseName}
        editable={editable}
        value={database.name}
        placeholder={t("Untitled database")}
        onCommit={(name) => actions.rename(name)}
      />

      <div className={classes.viewTabs} role="tablist">
        {database.views.map((v) => {
          const Icon = VIEW_ICONS[v.type];
          return (
            <UnstyledButton
              key={v.id}
              role="tab"
              aria-selected={v.id === view.id}
              className={classes.viewTab}
              data-active={v.id === view.id || undefined}
              onClick={() => setActiveViewId(v.id)}
            >
              <Icon size={15} stroke={1.6} />
              {v.name}
            </UnstyledButton>
          );
        })}
      </div>

      {view.type === "board" ? (
        <BoardView
          data={data}
          view={view}
          actions={actions}
          editable={editable}
          onOpenRow={openRow}
        />
      ) : (
        <TableView data={data} actions={actions} editable={editable} onOpenRow={openRow} />
      )}
    </div>
  );
}
