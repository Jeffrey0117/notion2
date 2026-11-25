import { mergeAttributes, Node } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";

export interface N2DatabaseOptions {
  HTMLAttributes: Record<string, any>;
  view: any;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    n2Database: {
      insertN2Database: (attributes: { databaseId: string }) => ReturnType;
    };
  }
}

/**
 * notion2 database block. The block only points at a database by id; the
 * columns, rows and views live on the server, so the same database can be
 * shown from more than one page.
 */
export const N2Database = Node.create<N2DatabaseOptions>({
  name: "n2Database",
  group: "block",
  atom: true,
  draggable: true,
  selectable: true,

  addOptions() {
    return {
      HTMLAttributes: {},
      view: null,
    };
  },

  addAttributes() {
    return {
      databaseId: {
        default: null,
        parseHTML: (element: HTMLElement) =>
          element.getAttribute("data-database-id"),
        renderHTML: (attributes) =>
          attributes.databaseId
            ? { "data-database-id": attributes.databaseId }
            : {},
      },
    };
  },

  parseHTML() {
    return [{ tag: `div[data-type="${this.name}"]` }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(
        { "data-type": this.name },
        this.options.HTMLAttributes,
        HTMLAttributes,
      ),
    ];
  },

  addCommands() {
    return {
      insertN2Database:
        (attributes) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs: attributes }),
    };
  },

  addNodeView() {
    if (!this.options.view) return null;
    return ReactNodeViewRenderer(this.options.view);
  },
});
