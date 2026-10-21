"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";
import { api, ApiError } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { useToast } from "@/components/ui/use-toast";
import { FileIcon, defaultStyles } from "react-file-icon";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Download, FileText, Loader2, Trash2 } from "lucide-react";

interface Document {
  id: number;
  file_name: string;
  file_path: string;
  file_size: number;
  content_type: string;
  created_at: string;
  processing_tasks: Array<{
    id: number;
    status: string;
    error_message: string | null;
  }>;
}

interface KnowledgeBase {
  id: number;
  name: string;
  description: string;
  documents: Document[];
}

interface DocumentListProps {
  knowledgeBaseId: number;
}

export function DocumentList({ knowledgeBaseId }: DocumentListProps) {
  const { copy } = useI18n();
  const { toast } = useToast();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [deletingDocumentId, setDeletingDocumentId] = useState<number | null>(
    null
  );

  useEffect(() => {
    const fetchDocuments = async () => {
      try {
        const data = await api.get(`/api/knowledge-base/${knowledgeBaseId}`);
        setDocuments(data.documents);
      } catch (error) {
        if (error instanceof ApiError) {
          setError(error.message);
        } else {
          setError(copy.documents.failedFetch);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchDocuments();
  }, [knowledgeBaseId, copy.documents.failedFetch]);

  const getDownloadHref = (doc: Document) =>
    `/api/knowledge-base/${knowledgeBaseId}/documents/${doc.id}/download`;

  const handleDeleteDocument = async (doc: Document) => {
    const confirmed = window.confirm(`${copy.common.delete}: ${doc.file_name}?`);
    if (!confirmed) return;

    setDeletingDocumentId(doc.id);
    try {
      await api.delete(`/api/knowledge-base/${knowledgeBaseId}/documents/${doc.id}`);
      setDocuments((currentDocuments) =>
        currentDocuments.filter((currentDoc) => currentDoc.id !== doc.id)
      );
      toast({
        title: copy.common.success,
        description: doc.file_name,
      });
    } catch (error) {
      const message =
        error instanceof ApiError ? error.message : copy.documents.somethingWentWrong;
      toast({
        title: copy.common.error,
        description: message,
        variant: "destructive",
      });
    } finally {
      setDeletingDocumentId(null);
    }
  };

  const getStatusLabel = (status: string) => {
    if (status === "pending") return copy.documents.pending;
    if (status === "processing") return copy.documents.processing;
    if (status === "completed") return copy.documents.completed;
    if (status === "failed") return copy.documents.failed;
    return status;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <div className="space-y-4">
          <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto"></div>
          <p className="text-muted-foreground animate-pulse">
            {copy.documents.loading}
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center p-8">
        <p className="text-destructive">{error}</p>
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] p-8">
        <div className="flex flex-col items-center max-w-[420px] text-center space-y-6">
          <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center">
            <FileText className="w-10 h-10 text-muted-foreground" />
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-semibold">
              {copy.documents.emptyTitle}
            </h3>
            <p className="text-muted-foreground">
              {copy.documents.emptyDescription}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{copy.common.name}</TableHead>
          <TableHead>{copy.common.size}</TableHead>
          <TableHead>{copy.common.created}</TableHead>
          <TableHead>{copy.common.status}</TableHead>
          <TableHead className="text-right">
            <span className="sr-only">{copy.common.delete}</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {documents.map((doc) => (
          <TableRow key={doc.id}>
            <TableCell className="font-medium">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6">
                  {doc.content_type.toLowerCase().includes("pdf") ? (
                    <FileIcon extension="pdf" {...defaultStyles.pdf} />
                  ) : doc.content_type.toLowerCase().includes("doc") ? (
                    <FileIcon extension="doc" {...defaultStyles.docx} />
                  ) : doc.content_type.toLowerCase().includes("txt") ? (
                    <FileIcon extension="txt" {...defaultStyles.txt} />
                  ) : doc.content_type.toLowerCase().includes("md") ? (
                    <FileIcon extension="md" {...defaultStyles.md} />
                  ) : (
                    <FileIcon
                      extension={doc.file_name.split(".").pop() || ""}
                      color="#E2E8F0"
                      labelColor="#94A3B8"
                    />
                  )}
                </div>
                {doc.file_name}
              </div>
            </TableCell>
            <TableCell>{(doc.file_size / 1024 / 1024).toFixed(2)} MB</TableCell>
            <TableCell>
              {formatDistanceToNow(new Date(doc.created_at), {
                addSuffix: true,
              })}
            </TableCell>
            <TableCell>
              {doc.processing_tasks.length > 0 && (
                <Badge
                  variant={
                    doc.processing_tasks[0].status === "completed"
                      ? "secondary" // Green for completed
                      : doc.processing_tasks[0].status === "failed"
                      ? "destructive" // Red for failed
                      : "default" // Default for pending/processing
                  }
                >
                  {getStatusLabel(doc.processing_tasks[0].status)}
                </Badge>
              )}
            </TableCell>
            <TableCell>
              <div className="flex justify-end gap-1">
                <Button asChild variant="ghost" size="icon">
                  <a
                    href={getDownloadHref(doc)}
                    download
                    title={copy.answer.downloadDocument}
                    aria-label={`${copy.answer.downloadDocument} ${doc.file_name}`}
                  >
                    <Download className="h-4 w-4" />
                  </a>
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  title={copy.common.delete}
                  aria-label={`${copy.common.delete} ${doc.file_name}`}
                  disabled={deletingDocumentId === doc.id}
                  onClick={() => handleDeleteDocument(doc)}
                >
                  {deletingDocumentId === doc.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
