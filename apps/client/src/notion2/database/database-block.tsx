import { useContext, useEffect, useRef, useState } from "react";
import { NodeViewProps, NodeViewWrapper } from "@tiptap/react";
import { Loader } from "@mantine/core";
import { useTranslation } from "react-i18next";
import { EditorSpaceContext } from "@/features/editor/components/recently-updated/editor-space-context";
import { createDatabase } from "./database-api";
import { DatabaseColumn, DatabaseView as View, newId } from "./database-types";
import { DatabaseView } from "./database-view";
import classes from "./database.module.css";

/**
 * The editor block. A block inserted from the slash menu has no database yet:
 * it creates one here, where the space is known, and then points at it.
 */
export default function DatabaseBlock({ node, editor, updateAttributes }: NodeViewProps) {
  const { t } = useTranslation();
  const spaceId = useContext(EditorSpaceContext);
  const databaseId: string | null = node.attrs.databaseId;
  const creating = useRef(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (databaseId || !spaceId || !editor.isEditable || creating.current) return;
    creating.current = true;

    const status: DatabaseColumn = {
      id: newId(),
      name: t("Status"),
      type: "select",
      options: [
        { id: newId(), name: t("Not started"), color: "gray" },
        { id: newId(), name: t("In progress"), color: "blue" },
        { id: newId(), name: t("Done"), color: "green" },
      ],
    };
    const views: View[] = [
      { id: newId(), name: t("Table"), type: "table" },
      { id: newId(), name: t("Board"), type: "board", groupBy: status.id },
    ];

    createDatabase({ spaceId, name: "", schema: [status], views })
      .then((database) => updateAttributes({ databaseId: database.id }))
      .catch(() => setFailed(true));
  }, [databaseId, spaceId, editor.isEditable]);

  return (
    <NodeViewWrapper className={classes.block} contentEditable={false} data-drag-handle>
      {databaseId ? (
        <DatabaseView databaseId={databaseId} editable={editor.isEditable} />
      ) : (
        <div className={classes.empty}>
          {failed ? t("Could not create the database.") : <Loader size="xs" />}
        </div>
      )}
    </NodeViewWrapper>
  );
}
