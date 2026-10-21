"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, Database, Loader2, Plus } from "lucide-react";
import DashboardLayout from "@/components/layout/dashboard-layout";
import { api, ApiError } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

interface KnowledgeBase {
  id: number;
  name: string;
  description?: string;
  documents: Array<{ id: number }>;
}

interface Chat {
  id: number;
}

const getPromptTitle = (prompt: string, fallback: string) => {
  if (!prompt) return fallback;
  return prompt.length > 72 ? `${prompt.slice(0, 69)}...` : prompt;
};

export default function NewChatPage() {
  const router = useRouter();
  const { copy } = useI18n();
  const hasStarted = useRef(false);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (hasStarted.current) return;
    hasStarted.current = true;

    const openChatWithAllKnowledge = async () => {
      try {
        const pendingPrompt =
          typeof window !== "undefined"
            ? sessionStorage.getItem("altbot.pendingPrompt") || ""
            : "";

        const knowledgeBases: KnowledgeBase[] = await api.get(
          "/api/knowledge-base"
        );
        const knowledgeBasesWithDocuments = knowledgeBases.filter(
          (kb) => kb.documents && kb.documents.length > 0
        );

        if (knowledgeBasesWithDocuments.length === 0) {
          let targetKb = knowledgeBases[0];

          if (!targetKb) {
            targetKb = await api.post("/api/knowledge-base", {
              name: copy.home.defaultKbName,
              description: copy.home.defaultKbDescription,
            });
          }

          router.replace(`/dashboard/knowledge/${targetKb.id}?upload=1`);
          return;
        }

        const chat: Chat = await api.post("/api/chat/", {
          title: getPromptTitle(pendingPrompt.trim(), copy.home.newChat),
          knowledge_base_ids: knowledgeBasesWithDocuments.map((kb) => kb.id),
        });

        if (pendingPrompt && typeof window !== "undefined") {
          sessionStorage.setItem(`altbot.pendingMessage.${chat.id}`, pendingPrompt);
          sessionStorage.removeItem("altbot.pendingPrompt");
        }

        router.replace(`/dashboard/chat/${chat.id}`);
      } catch (err) {
        console.error("Failed to open a new chat:", err);
        setError(err instanceof ApiError ? err.message : copy.chat.failedCreateChat);
      }
    };

    void openChatWithAllKnowledge();
  }, [attempt, copy, router]);

  return (
    <DashboardLayout>
      <div className="mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center px-4 text-center">
        {error ? (
          <div className="chatgpt-enter rounded-3xl border border-destructive/20 bg-destructive/10 p-6 text-left shadow-sm">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-destructive/15 text-destructive">
                <AlertTriangle className="h-5 w-5" />
              </span>
              <div>
                <h1 className="text-lg font-semibold text-foreground">
                  {copy.common.error}
                </h1>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {error}
                </p>
              </div>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link
                href="/dashboard/knowledge"
                className="inline-flex h-10 items-center gap-2 rounded-full border border-border bg-card px-4 text-sm font-medium text-foreground transition hover:bg-accent"
              >
                <Database className="h-4 w-4" />
                {copy.home.knowledgeBase}
              </Link>
              <button
                type="button"
                onClick={() => {
                  hasStarted.current = false;
                  setError("");
                  setAttempt((value) => value + 1);
                }}
                className="inline-flex h-10 items-center gap-2 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:opacity-90"
              >
                <Plus className="h-4 w-4" />
                {copy.chat.startNewChat}
              </button>
            </div>
          </div>
        ) : (
          <div className="chatgpt-enter flex flex-col items-center">
            <div className="chatgpt-float mb-5 flex h-16 w-16 items-center justify-center rounded-3xl bg-card shadow-sm ring-1 ring-border">
              <Loader2 className="h-7 w-7 animate-spin text-[#10a37f]" />
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">
              {copy.chat.openingNewChat}
            </h1>
            <p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground">
              {copy.chat.openingAllKnowledge}
            </p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
