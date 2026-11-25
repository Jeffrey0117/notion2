import { useState } from "react";
import { Button, Group, Stack, Text, TextInput } from "@mantine/core";
import { IconBrandNotion, IconCheck, IconX } from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import api from "@/lib/api-client";
import { queryClient } from "@/main.tsx";
import { useQueryEmit } from "@/features/websocket/use-query-emit.ts";
import { buildPageUrl } from "@/features/page/page.utils.ts";
import { IPage } from "@/features/page/types/page.types.ts";

interface NotionUrlImportProps {
  spaceId: string;
  onClose: () => void;
}

interface NotionImportResult {
  page: IPage;
  importedPages: number;
}

async function importNotionUrl(url: string, spaceId: string) {
  const req = await api.post<NotionImportResult>("/pages/import-notion-url", {
    url,
    spaceId,
  });
  return req.data;
}

/** Paste a public Notion link; the page and its sub-pages are copied into this space. */
export function NotionUrlImport({ spaceId, onClose }: NotionUrlImportProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { spaceSlug } = useParams();
  const emit = useQueryEmit();
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);

  const handleImport = async () => {
    const trimmed = url.trim();
    if (!trimmed || loading) return;

    setLoading(true);
    try {
      const { page, importedPages } = await importNotionUrl(trimmed, spaceId);

      await queryClient.refetchQueries({
        queryKey: ["root-sidebar-pages", spaceId],
      });
      emit({ operation: "refetchRootTreeNodeEvent", spaceId });

      notifications.show({
        color: "teal",
        icon: <IconCheck size={18} />,
        message: t("Imported {{count}} page(s) from Notion", {
          count: importedPages,
        }),
      });
      setUrl("");
      onClose();
      navigate(buildPageUrl(spaceSlug, page.slugId, page.title));
    } catch (err) {
      notifications.show({
        color: "red",
        icon: <IconX size={18} />,
        message:
          err?.response?.data?.message ?? t("Could not import that Notion link"),
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Stack gap={6} mb="lg">
      <Group gap="xs" align="flex-end" wrap="nowrap">
        <TextInput
          style={{ flex: 1 }}
          leftSection={<IconBrandNotion size={18} />}
          placeholder="https://….notion.site/…"
          aria-label={t("Public Notion link")}
          value={url}
          disabled={loading}
          onChange={(event) => setUrl(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") handleImport();
          }}
        />
        <Button onClick={handleImport} loading={loading} disabled={!url.trim()}>
          {t("Import")}
        </Button>
      </Group>
      <Text size="xs" c="dimmed">
        {t("Paste a public Notion link to copy the page and its sub-pages here.")}
      </Text>
    </Stack>
  );
}
