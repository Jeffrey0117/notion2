import { useEffect, useState } from "react";
import { Checkbox, Menu, TextInput, UnstyledButton } from "@mantine/core";
import { useTranslation } from "react-i18next";
import {
  DatabaseColumn,
  newId,
  nextOptionColor,
  RowValue,
  SelectOption,
} from "./database-types";
import classes from "./database.module.css";

export function OptionBadge({ option }: { option: SelectOption }) {
  return (
    <span className={classes.badge} data-color={option.color}>
      {option.name}
    </span>
  );
}

interface TextCellProps {
  value: string;
  editable: boolean;
  numeric?: boolean;
  placeholder?: string;
  className?: string;
  onCommit: (value: string) => void;
}

/** Plain input that saves when you leave it or press Enter; Escape puts the old value back. */
export function TextCell({
  value,
  editable,
  numeric,
  placeholder,
  className,
  onCommit,
}: TextCellProps) {
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  const commit = () => {
    if (draft !== value) onCommit(draft);
  };

  return (
    <input
      className={className ?? classes.cellInput}
      value={draft}
      readOnly={!editable}
      placeholder={editable ? placeholder : undefined}
      inputMode={numeric ? "decimal" : undefined}
      data-numeric={numeric || undefined}
      onChange={(event) => setDraft(event.currentTarget.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
        if (event.key === "Escape") {
          setDraft(value);
          event.currentTarget.blur();
        }
      }}
    />
  );
}

interface SelectCellProps {
  column: DatabaseColumn;
  value: RowValue;
  editable: boolean;
  onChange: (optionId: string | null) => void;
  /** adds the option to the column, then the caller selects it */
  onAddOption: (option: SelectOption) => void;
}

export function SelectCell({
  column,
  value,
  editable,
  onChange,
  onAddOption,
}: SelectCellProps) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState("");
  const options = column.options ?? [];
  const current = options.find((option) => option.id === value);

  const addOption = () => {
    const name = draft.trim();
    if (!name) return;
    const existing = options.find((option) => option.name === name);
    if (existing) {
      onChange(existing.id);
    } else {
      onAddOption({ id: newId(), name, color: nextOptionColor(options) });
    }
    setDraft("");
  };

  if (!editable) {
    return (
      <div className={classes.selectCell}>
        {current && <OptionBadge option={current} />}
      </div>
    );
  }

  return (
    <Menu position="bottom-start" withinPortal shadow="md" width={220}>
      <Menu.Target>
        <UnstyledButton className={classes.selectCell}>
          {current && <OptionBadge option={current} />}
        </UnstyledButton>
      </Menu.Target>
      <Menu.Dropdown>
        <TextInput
          size="xs"
          mb={4}
          value={draft}
          placeholder={t("Type to add an option")}
          onChange={(event) => setDraft(event.currentTarget.value)}
          onKeyDown={(event) => {
            event.stopPropagation();
            if (event.key === "Enter") addOption();
          }}
        />
        {options.map((option) => (
          <Menu.Item key={option.id} onClick={() => onChange(option.id)}>
            <OptionBadge option={option} />
          </Menu.Item>
        ))}
        {current && (
          <>
            <Menu.Divider />
            <Menu.Item onClick={() => onChange(null)}>{t("Clear")}</Menu.Item>
          </>
        )}
      </Menu.Dropdown>
    </Menu>
  );
}

interface CellProps {
  column: DatabaseColumn;
  value: RowValue;
  editable: boolean;
  onChange: (value: RowValue) => void;
  onAddOption: (option: SelectOption) => void;
}

export function Cell({ column, value, editable, onChange, onAddOption }: CellProps) {
  switch (column.type) {
    case "checkbox":
      return (
        <div className={classes.checkboxCell}>
          <Checkbox
            size="xs"
            checked={value === true}
            disabled={!editable}
            aria-label={column.name}
            onChange={(event) => onChange(event.currentTarget.checked)}
          />
        </div>
      );
    case "date":
      return (
        <input
          type="date"
          className={classes.cellInput}
          value={typeof value === "string" ? value : ""}
          readOnly={!editable}
          aria-label={column.name}
          onChange={(event) => onChange(event.currentTarget.value || null)}
        />
      );
    case "select":
      return (
        <SelectCell
          column={column}
          value={value}
          editable={editable}
          onChange={onChange}
          onAddOption={onAddOption}
        />
      );
    case "number":
      return (
        <TextCell
          numeric
          editable={editable}
          value={typeof value === "number" ? String(value) : ""}
          onCommit={(text) => {
            const number = Number(text);
            onChange(text.trim() === "" || !Number.isFinite(number) ? null : number);
          }}
        />
      );
    default:
      return (
        <TextCell
          editable={editable}
          value={typeof value === "string" ? value : ""}
          onCommit={(text) => onChange(text)}
        />
      );
  }
}
