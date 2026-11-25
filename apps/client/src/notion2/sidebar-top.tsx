import { Group, Text, UnstyledButton } from "@mantine/core";
import { IconSearch } from "@tabler/icons-react";
import { useAtom } from "jotai";
import { useTranslation } from "react-i18next";
import TopMenu from "@/components/layouts/global/top-menu.tsx";
import SidebarToggle from "@/components/ui/sidebar-toggle-button.tsx";
import { NotificationPopover } from "@/features/notification/components/notification-popover.tsx";
import { searchSpotlight } from "@/features/search/constants.ts";
import { desktopSidebarAtom } from "@/components/layouts/global/hooks/atoms/sidebar-atom.ts";
import { useToggleSidebar } from "@/components/layouts/global/hooks/hooks/use-toggle-sidebar.ts";
import { platformModifierLabel } from "@/lib";
import classes from "./sidebar-top.module.css";

/**
 * On desktop the global top bar is gone: account menu, sidebar toggle and
 * search sit at the top of the sidebar instead.
 */
export function SidebarTop() {
  const { t } = useTranslation();
  const [desktopOpened] = useAtom(desktopSidebarAtom);
  const toggleDesktop = useToggleSidebar(desktopSidebarAtom);

  return (
    <div className={classes.root}>
      <Group justify="space-between" wrap="nowrap" gap={4} className={classes.row}>
        <div className={classes.account}>
          <TopMenu />
        </div>
        <Group gap={2} wrap="nowrap">
          <NotificationPopover />
          <SidebarToggle
            aria-label={t("Sidebar toggle")}
            opened={desktopOpened}
            onClick={toggleDesktop}
            size="sm"
          />
        </Group>
      </Group>

      <UnstyledButton className={classes.search} onClick={searchSpotlight.open}>
        <IconSearch size={15} stroke={1.8} />
        <Text fz="sm" className={classes.searchLabel}>
          {t("Search")}
        </Text>
        <span className={classes.shortcut}>{platformModifierLabel}+K</span>
      </UnstyledButton>
    </div>
  );
}

/** Shown over the page when the sidebar is collapsed, so it can be reopened. */
export function SidebarReopen() {
  const { t } = useTranslation();
  const [desktopOpened] = useAtom(desktopSidebarAtom);
  const toggleDesktop = useToggleSidebar(desktopSidebarAtom);

  if (desktopOpened) return null;

  return (
    <div className={classes.reopen}>
      <SidebarToggle
        aria-label={t("Sidebar toggle")}
        opened={desktopOpened}
        onClick={toggleDesktop}
        size="sm"
      />
    </div>
  );
}
