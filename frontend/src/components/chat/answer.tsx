import React, {
  FC,
  useMemo,
  useEffect,
  useState,
  ClassAttributes,
} from "react";
import { AnchorHTMLAttributes } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { Divider } from "@/components/ui/divider";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { FileIcon } from "react-file-icon";
import { Button } from "@/components/ui/button";
import { Download, FileSpreadsheet, FileText, Loader2 } from "lucide-react";

type ExportFormat = "docx" | "xlsx" | "txt" | "md" | "csv";

// Debounce hook to prevent rapid state updates during streaming
const useDebouncedValue = <T,>(value: T, delay: number): T => {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

interface Citation {
  id: number;
  text: string;
  metadata: Record<string, any>;
}

interface KnowledgeBaseInfo {
  name: string;
}

interface DocumentInfo {
  file_name: string;
  knowledge_base: KnowledgeBaseInfo;
}

interface CitationInfo {
  knowledge_base: KnowledgeBaseInfo;
  document: DocumentInfo;
}

export const Answer: FC<{
  markdown: string;
  citations?: Citation[];
}> = ({ markdown, citations = [] }) => {
  const { copy } = useI18n();
  const [exportingFormat, setExportingFormat] = useState<ExportFormat | null>(
    null
  );
  const [citationInfoMap, setCitationInfoMap] = useState<
    Record<string, CitationInfo>
  >({});
  const [showFragments, setShowFragments] = useState(false);

  // Debounce citations to prevent rapid API calls during streaming
  const debouncedCitations = useDebouncedValue(citations, 300);

  const processedMarkdown = useMemo(() => {
    return markdown
      .replace(/<think>/g, "## 💭 深度思考\n```think")
      .replace(/<\/think>/g, "```");
  }, [markdown]);

  const answerTitle = useMemo(() => {
    const firstHeading = markdown
      .split("\n")
      .find((line) => /^#{1,3}\s+/.test(line.trim()));
    if (firstHeading) {
      return firstHeading.replace(/^#{1,3}\s+/, "").trim();
    }
    return "ALTBot answer";
  }, [markdown]);

  const getDownloadFilename = (
    contentDisposition: string | null,
    fallback: string
  ) => {
    if (!contentDisposition) return fallback;

    const encodedFilename = contentDisposition.match(/filename\*=UTF-8''([^;]+)/);
    if (encodedFilename?.[1]) {
      return decodeURIComponent(encodedFilename[1]);
    }

    const plainFilename = contentDisposition.match(/filename="([^"]+)"/);
    return plainFilename?.[1] || fallback;
  };

  const exportAnswer = async (format: ExportFormat) => {
    setExportingFormat(format);
    try {
      const response = await fetch(`/api/export/${format}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: answerTitle,
          content: markdown,
        }),
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = getDownloadFilename(
        response.headers.get("Content-Disposition"),
        `ALTBot-answer.${format}`
      );
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Failed to export answer:", error);
      window.alert(copy.common.error);
    } finally {
      setExportingFormat(null);
    }
  };

  useEffect(() => {
    const fetchCitationInfo = async () => {
      const infoMap: Record<string, CitationInfo> = {};

      for (const citation of debouncedCitations) {
        const { kb_id, document_id } = citation.metadata;
        if (!kb_id || !document_id) continue;

        const key = `${kb_id}-${document_id}`;
        if (infoMap[key]) continue;

        try {
          const [kb, doc] = await Promise.all([
            api.get(`/api/knowledge-base/${kb_id}`),
            api.get(`/api/knowledge-base/${kb_id}/documents/${document_id}`),
          ]);

          infoMap[key] = {
            knowledge_base: {
              name: kb.name,
            },
            document: {
              file_name: doc.file_name,
              knowledge_base: {
                name: kb.name,
              },
            },
          };
        } catch (error) {
          console.error("Failed to fetch citation info:", error);
        }
      }

      setCitationInfoMap(infoMap);
    };

    if (debouncedCitations.length > 0) {
      fetchCitationInfo();
    }
  }, [debouncedCitations]);

  const CitationLink = useMemo(
    () =>
      (
        props: ClassAttributes<HTMLAnchorElement> &
          AnchorHTMLAttributes<HTMLAnchorElement>
      ) => {
        const citationId = props.href?.match(/^(\d+)$/)?.[1];
        const citation = citationId
          ? debouncedCitations[parseInt(citationId) - 1]
          : null;

        if (!citation) {
          return <a>[{props.href}]</a>;
        }

        const citationInfo =
          citationInfoMap[
            `${citation.metadata.kb_id}-${citation.metadata.document_id}`
          ];
        const downloadHref =
          citation.metadata.kb_id && citation.metadata.document_id
            ? `/api/knowledge-base/${citation.metadata.kb_id}/documents/${citation.metadata.document_id}/download`
            : null;

        return (
          <Popover>
            <PopoverTrigger asChild>
              <a
                {...props}
                href="#"
                role="button"
                className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium text-blue-600 bg-blue-50 rounded hover:bg-blue-100 transition-colors relative"
              >
                <span className="absolute -top-3 -right-1">[{props.href}]</span>
              </a>
            </PopoverTrigger>
            <PopoverContent
              side="top"
              align="start"
              className="max-w-2xl w-[calc(100vw-100px)] p-4 rounded-lg shadow-lg"
            >
              <div className="text-sm space-y-3">
                {citationInfo && (
                  <div className="flex items-center gap-2 rounded bg-muted p-2 text-xs font-medium text-foreground">
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      <div className="w-5 h-5 flex shrink-0 items-center justify-center">
                        <FileIcon
                          extension={
                            citationInfo.document.file_name.split(".").pop() ||
                            ""
                          }
                          color="#E2E8F0"
                          labelColor="#94A3B8"
                        />
                      </div>
                      <span className="truncate">
                        {citationInfo.knowledge_base.name} /{" "}
                        {citationInfo.document.file_name}
                      </span>
                    </div>
                    {downloadHref && (
                      <a
                        href={downloadHref}
                        download
                        title={copy.answer.downloadDocument}
                        aria-label={`${copy.answer.downloadDocument} ${citationInfo.document.file_name}`}
                        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition hover:border-[#10a37f]/40 hover:bg-[#10a37f]/10 hover:text-[#0f8f71]"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <Download className="h-4 w-4" />
                      </a>
                    )}
                  </div>
                )}
                <Divider />
                <p className="leading-relaxed text-foreground">{citation.text}</p>
                <Divider />
                {Object.keys(citation.metadata).length > 0 && (
                  <div className="rounded bg-muted p-2 text-xs text-muted-foreground">
                    <div className="font-medium mb-2">
                      {copy.answer.debugInfo}
                    </div>
                    <div className="space-y-1">
                      {Object.entries(citation.metadata).map(([key, value]) => (
                        <div key={key} className="flex">
                          <span className="font-medium min-w-[100px]">
                            {key}:
                          </span>
                          <span className="text-muted-foreground">{String(value)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </PopoverContent>
          </Popover>
        );
      },
    [copy.answer.debugInfo, copy.answer.downloadDocument, debouncedCitations, citationInfoMap]
  );

  if (!markdown) {
    return (
      <div className="flex flex-col gap-2">
        <Skeleton className="max-w-sm h-4 bg-zinc-200" />
        <Skeleton className="max-w-lg h-4 bg-zinc-200" />
        <Skeleton className="max-w-2xl h-4 bg-zinc-200" />
        <Skeleton className="max-w-lg h-4 bg-zinc-200" />
        <Skeleton className="max-w-xl h-4 bg-zinc-200" />
      </div>
    );
  }

  return (
    <div className="prose prose-sm max-w-full">
      <div className="not-prose mb-3 flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 gap-2 rounded-full px-3 text-xs"
          disabled={Boolean(exportingFormat)}
          onClick={() => exportAnswer("docx")}
        >
          {exportingFormat === "docx" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <FileText className="h-3.5 w-3.5" />
          )}
          Word (.docx)
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 gap-2 rounded-full px-3 text-xs"
          disabled={Boolean(exportingFormat)}
          onClick={() => exportAnswer("xlsx")}
        >
          {exportingFormat === "xlsx" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <FileSpreadsheet className="h-3.5 w-3.5" />
          )}
          Excel
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 gap-2 rounded-full px-3 text-xs"
          disabled={Boolean(exportingFormat)}
          onClick={() => exportAnswer("txt")}
        >
          {exportingFormat === "txt" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Download className="h-3.5 w-3.5" />
          )}
          TXT
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 gap-2 rounded-full px-3 text-xs"
          disabled={Boolean(exportingFormat)}
          onClick={() => exportAnswer("md")}
        >
          {exportingFormat === "md" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <FileText className="h-3.5 w-3.5" />
          )}
          MD
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 gap-2 rounded-full px-3 text-xs"
          disabled={Boolean(exportingFormat)}
          onClick={() => exportAnswer("csv")}
        >
          {exportingFormat === "csv" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <FileSpreadsheet className="h-3.5 w-3.5" />
          )}
          CSV
        </Button>
      </div>
      <Markdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{
          a: CitationLink,
        }}
      >
        {processedMarkdown}
      </Markdown>
      {debouncedCitations.length > 0 && (
        <div className="not-prose mt-5 rounded-2xl border border-border bg-card/70 p-4">
          <button
            type="button"
            onClick={() => setShowFragments((value) => !value)}
            className="flex w-full items-center justify-between gap-3 text-left text-sm font-medium text-foreground"
          >
            <span>
              {showFragments
                ? copy.answer.hideFoundFragments
                : copy.answer.showFoundFragments}
            </span>
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              {debouncedCitations.length}
            </span>
          </button>
          {showFragments && (
            <div className="mt-4 space-y-3">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                {copy.answer.foundFragments}
              </p>
              {debouncedCitations.map((citation, index) => {
                const citationInfo =
                  citationInfoMap[
                    `${citation.metadata.kb_id}-${citation.metadata.document_id}`
                  ];
                const source =
                  citationInfo?.document.file_name ||
                  citation.metadata.source ||
                  citation.metadata.file_name ||
                  "Knowledge Base";

                return (
                  <div
                    key={`${citation.metadata.chunk_id || index}`}
                    className="rounded-xl border border-border bg-background/60 p-3 text-sm"
                  >
                    <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span className="rounded-full bg-muted px-2 py-0.5">
                        [{index + 1}]
                      </span>
                      <span className="truncate">{String(source)}</span>
                    </div>
                    <p className="whitespace-pre-wrap leading-6 text-foreground">
                      {citation.text}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
