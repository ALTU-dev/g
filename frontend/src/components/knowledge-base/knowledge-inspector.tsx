"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  FileSearch,
  Loader2,
  RefreshCw,
  Search,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { api, ApiError } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

interface InspectorDocument {
  id: number;
  file_name: string;
  file_size: number;
  content_type: string;
  created_at: string;
  status: string;
  chunks_count: number;
  indexed: boolean;
  error_message?: string | null;
}

interface FailedUpload {
  id: number;
  file_name: string;
  file_size: number;
  content_type: string;
  created_at: string;
  status: string;
  error_message?: string | null;
}

interface InspectorData {
  knowledge_base_id: number;
  knowledge_base_name: string;
  documents_count: number;
  chunks_count: number;
  vector_count: number | null;
  vector_error?: string | null;
  failed_count: number;
  documents: InspectorDocument[];
  failed_documents: InspectorDocument[];
  failed_uploads: FailedUpload[];
  pending_uploads: FailedUpload[];
}

interface RetrievalResult {
  content: string;
  metadata: Record<string, any>;
  score: number;
}

export function KnowledgeInspector({
  knowledgeBaseId,
}: {
  knowledgeBaseId: number;
}) {
  const { copy } = useI18n();
  const { toast } = useToast();
  const [data, setData] = useState<InspectorData | null>(null);
  const [loading, setLoading] = useState(true);
  const [reindexing, setReindexing] = useState(false);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<RetrievalResult[]>([]);
  const [expandedResults, setExpandedResults] = useState<Set<number>>(
    () => new Set()
  );

  const fetchInspector = useCallback(async () => {
    setLoading(true);
    try {
      const inspectorData = await api.get(
        `/api/knowledge-base/${knowledgeBaseId}/inspector`
      );
      setData(inspectorData);
    } catch (error) {
      toast({
        title: copy.common.error,
        description:
          error instanceof ApiError ? error.message : copy.documents.failedFetch,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [copy.common.error, copy.documents.failedFetch, knowledgeBaseId, toast]);

  useEffect(() => {
    void fetchInspector();
  }, [fetchInspector]);

  const problematicDocuments = useMemo(
    () => [
      ...(data?.failed_documents || []),
      ...(data?.failed_uploads || []),
      ...(data?.pending_uploads || []),
    ],
    [data]
  );

  const handleReindex = async () => {
    setReindexing(true);
    try {
      await api.post(`/api/knowledge-base/${knowledgeBaseId}/reindex`);
      toast({
        title: copy.common.success,
        description: copy.knowledge.reindexStarted,
      });
      await fetchInspector();
    } catch (error) {
      toast({
        title: copy.common.error,
        description:
          error instanceof ApiError
            ? error.message
            : copy.documents.somethingWentWrong,
        variant: "destructive",
      });
    } finally {
      setReindexing(false);
    }
  };

  const handleSearch = async () => {
    const cleanQuery = query.trim();
    if (!cleanQuery) return;

    setSearching(true);
    setExpandedResults(new Set());
    try {
      const response = await api.post("/api/knowledge-base/test-retrieval", {
        query: cleanQuery,
        kb_id: knowledgeBaseId,
        top_k: 5,
      });
      setResults(response.results || []);
    } catch (error) {
      toast({
        title: copy.common.error,
        description:
          error instanceof ApiError
            ? error.message
            : copy.documents.somethingWentWrong,
        variant: "destructive",
      });
    } finally {
      setSearching(false);
    }
  };

  const toggleResult = (index: number) => {
    setExpandedResults((current) => {
      const next = new Set(current);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  if (loading && !data) {
    return (
      <Card className="rounded-3xl">
        <CardContent className="flex items-center justify-center gap-3 p-8 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {copy.common.loading}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden rounded-3xl border-border/80 bg-card/80 shadow-sm backdrop-blur">
      <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-xl">
            <Database className="h-5 w-5 text-[#10a37f]" />
            {copy.knowledge.inspectorTitle}
          </CardTitle>
          <CardDescription className="mt-2">
            {copy.knowledge.inspectorDescription}
          </CardDescription>
        </div>
        <Button
          type="button"
          variant="outline"
          className="rounded-full"
          disabled={reindexing || !data?.documents_count}
          onClick={handleReindex}
        >
          {reindexing ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          {copy.common.reindex}
        </Button>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-3 md:grid-cols-4">
          <MetricCard
            label={copy.knowledge.documentsLoaded}
            value={data?.documents_count ?? 0}
          />
          <MetricCard
            label={copy.knowledge.chunksCreated}
            value={data?.chunks_count ?? 0}
          />
          <MetricCard
            label={copy.knowledge.vectorRecords}
            value={data?.vector_count ?? "—"}
            warning={Boolean(data?.vector_error)}
          />
          <MetricCard
            label={copy.knowledge.failedIndexing}
            value={data?.failed_count ?? 0}
            warning={(data?.failed_count ?? 0) > 0}
          />
        </div>

        <div className="rounded-2xl border border-border bg-background/60 p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              {(data?.failed_count ?? 0) > 0 ? (
                <AlertTriangle className="h-4 w-4 text-destructive" />
              ) : (
                <CheckCircle2 className="h-4 w-4 text-[#10a37f]" />
              )}
              {copy.knowledge.notIndexedTitle}
            </h3>
            <Badge variant={(data?.failed_count ?? 0) > 0 ? "destructive" : "secondary"}>
              {data?.failed_count ?? 0}
            </Badge>
          </div>
          {problematicDocuments.length > 0 ? (
            <div className="space-y-2">
              {problematicDocuments.map((document) => (
                <ProblematicDocumentItem
                  key={`${document.status}-${document.id}-${document.file_name}`}
                  document={document}
                />
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {copy.knowledge.allIndexed}
            </p>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-background/60 p-4">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <FileSearch className="h-4 w-4 text-[#10a37f]" />
            {copy.knowledge.testSearch}
          </h3>
          <div className="flex gap-2">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && void handleSearch()}
              placeholder={copy.knowledge.testSearchPlaceholder}
              disabled={searching}
            />
            <Button
              type="button"
              className="shrink-0 rounded-full"
              disabled={searching || !query.trim()}
              onClick={handleSearch}
            >
              {searching ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              <span className="ml-2 hidden sm:inline">{copy.common.search}</span>
            </Button>
          </div>

          {results.length > 0 && (
            <div className="mt-4 space-y-3">
              <h4 className="text-sm font-semibold">
                {copy.knowledge.searchResults}
              </h4>
              {results.map((result, index) => {
                const isExpanded = expandedResults.has(index);
                const content =
                  !isExpanded && result.content.length > 420
                    ? `${result.content.slice(0, 420)}...`
                    : result.content;

                return (
                  <div
                    key={`${result.metadata?.chunk_id || index}`}
                    className="rounded-2xl border border-border bg-card p-4 text-sm"
                  >
                    <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant="secondary">
                        #{index + 1}
                      </Badge>
                      <span>
                        {copy.knowledge.score}: {Number(result.score).toFixed(4)}
                      </span>
                      <span>
                        {copy.knowledge.source}:{" "}
                        {result.metadata?.source || result.metadata?.file_name || "—"}
                      </span>
                    </div>
                    <p className="whitespace-pre-wrap leading-6 text-foreground">
                      {content}
                    </p>
                    {result.content.length > 420 && (
                      <button
                        type="button"
                        onClick={() => toggleResult(index)}
                        className="mt-3 text-xs font-medium text-[#10a37f] hover:underline"
                      >
                        {isExpanded
                          ? copy.answer.hideFoundFragments
                          : copy.answer.showFoundFragments}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function MetricCard({
  label,
  value,
  warning = false,
}: {
  label: string;
  value: number | string;
  warning?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-4 ${
        warning
          ? "border-destructive/20 bg-destructive/10"
          : "border-border bg-card"
      }`}
    >
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
    </div>
  );
}

function ProblematicDocumentItem({
  document,
}: {
  document: InspectorDocument | FailedUpload;
}) {
  const chunksCount =
    "chunks_count" in document
      ? (document as InspectorDocument).chunks_count
      : null;

  return (
    <div className="rounded-xl border border-border bg-card px-3 py-2 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-medium">{document.file_name}</span>
        <Badge variant="outline">{document.status}</Badge>
      </div>
      {chunksCount !== null && (
        <p className="mt-1 text-xs text-muted-foreground">
          chunks: {chunksCount}
        </p>
      )}
      {document.error_message && (
        <p className="mt-1 text-xs text-destructive">
          {document.error_message}
        </p>
      )}
    </div>
  );
}
