"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { MessageSquare, PlusIcon } from "lucide-react";
import DashboardLayout from "@/components/layout/dashboard-layout";
import { DocumentUploadSteps } from "@/components/knowledge-base/document-upload-steps";
import { DocumentList } from "@/components/knowledge-base/document-list";
import { KnowledgeInspector } from "@/components/knowledge-base/knowledge-inspector";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useI18n } from "@/lib/i18n";

export default function KnowledgeBasePage() {
  const { copy } = useI18n();
  const params = useParams();
  const searchParams = useSearchParams();
  const knowledgeBaseId = parseInt(params.id as string);
  const shouldOpenUpload = searchParams.get("upload") === "1";
  const [refreshKey, setRefreshKey] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(shouldOpenUpload);

  const handleUploadComplete = useCallback(() => {
    setRefreshKey((prev) => prev + 1);
    setDialogOpen(false);
  }, []);

  useEffect(() => {
    if (shouldOpenUpload) {
      setDialogOpen(true);
    }
  }, [shouldOpenUpload]);

  return (
    <DashboardLayout>
      <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-3xl font-bold">{copy.knowledge.detailTitle}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {copy.knowledge.detailDescription}
          </p>
        </div>
        <div className="flex gap-3">
          <Button asChild variant="secondary">
            <Link href="/dashboard/chat/new">
              <MessageSquare className="mr-2 h-4 w-4" />
              {copy.knowledge.startChat}
            </Link>
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <PlusIcon className="mr-2 h-4 w-4" />
                {copy.knowledge.addDocuments}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl">
              <DialogHeader>
                <DialogTitle>{copy.knowledge.dialogTitle}</DialogTitle>
                <DialogDescription>
                  {copy.knowledge.dialogDescription}
                </DialogDescription>
              </DialogHeader>
              <DocumentUploadSteps
                knowledgeBaseId={knowledgeBaseId}
                onComplete={handleUploadComplete}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {shouldOpenUpload && (
        <div className="mb-6 rounded-2xl border border-[#10a37f]/20 bg-[#10a37f]/5 p-4 text-sm text-[#166f5c]">
          {copy.knowledge.uploadNudge}
        </div>
      )}

      <div className="mt-8 space-y-6">
        <KnowledgeInspector
          key={`inspector-${refreshKey}`}
          knowledgeBaseId={knowledgeBaseId}
        />
        <DocumentList key={refreshKey} knowledgeBaseId={knowledgeBaseId} />
      </div>
    </DashboardLayout>
  );
}
