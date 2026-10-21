"use client";

import { ChangeEvent, DragEvent, FormEvent, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowUp,
  AlertTriangle,
  CheckCircle2,
  Database,
  FileText,
  Loader2,
  MessageSquare,
  Paperclip,
  ShieldCheck,
  Sparkles,
  UploadCloud,
  X,
} from "lucide-react";
import { LanguageSelector } from "@/components/language-selector";
import { ThemeToggle } from "@/components/theme-toggle";
import { api } from "@/lib/api";
import {
  ComposerUploadItem,
  ComposerUploadStatus,
  SUPPORTED_UPLOAD_ACCEPT,
  uploadFilesToKnowledgeBase,
} from "@/lib/document-upload";
import { useI18n } from "@/lib/i18n";

interface Document {
  id: number;
}

interface KnowledgeBase {
  id: number;
  name: string;
  description?: string;
  documents: Document[];
}

interface Chat {
  id: number;
}

const getPromptTitle = (prompt: string) =>
  prompt.length > 72 ? `${prompt.slice(0, 69)}...` : prompt;

const createUploadItemId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`;

export default function Home() {
  const router = useRouter();
  const { copy } = useI18n();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [prompt, setPrompt] = useState("");
  const [error, setError] = useState("");
  const [isStarting, setIsStarting] = useState(false);
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const [uploadItems, setUploadItems] = useState<ComposerUploadItem[]>([]);

  const isUploadingFiles = uploadItems.some((item) =>
    ["queued", "uploading", "processing"].includes(item.status)
  );

  const uploadStatusLabel = (status: ComposerUploadStatus) => {
    if (status === "uploading") return copy.uploads.uploading;
    if (status === "processing") return copy.uploads.processing;
    if (status === "completed") return copy.uploads.completed;
    if (status === "failed") return copy.uploads.failed;
    return copy.common.loading;
  };

  const updateUploadStatus = (
    fileNames: string[],
    status: ComposerUploadStatus,
    message?: string
  ) => {
    setUploadItems((items) =>
      items.map((item) =>
        fileNames.includes(item.file.name) ? { ...item, status, message } : item
      )
    );
  };

  const openKnowledgeBaseUpload = async (knowledgeBases: KnowledgeBase[]) => {
    let targetKb = knowledgeBases[0];

    if (!targetKb) {
      targetKb = await api.post("/api/knowledge-base", {
        name: copy.home.defaultKbName,
        description: copy.home.defaultKbDescription,
      });
    }

    router.push(`/dashboard/knowledge/${targetKb.id}?upload=1`);
  };

  const getUploadKnowledgeBase = async () => {
    const knowledgeBases: KnowledgeBase[] = await api.get("/api/knowledge-base");
    let targetKb = knowledgeBases[0];

    if (!targetKb) {
      targetKb = await api.post("/api/knowledge-base", {
        name: copy.home.defaultKbName,
        description: copy.home.defaultKbDescription,
      });
    }

    return targetKb;
  };

  const handleComposerFiles = async (fileList: FileList | File[]) => {
    const files = Array.from(fileList);
    if (files.length === 0) return;

    setError("");
    const nextItems: ComposerUploadItem[] = files.map((file) => ({
      id: createUploadItemId(),
      file,
      status: "queued",
    }));
    setUploadItems((items) => [...items, ...nextItems]);

    try {
      const targetKb = await getUploadKnowledgeBase();
      const result = await uploadFilesToKnowledgeBase(
        targetKb.id,
        files,
        updateUploadStatus
      );

      if (result.failed > 0) {
        setError(copy.uploads.uploadFailed);
      }
    } catch (err) {
      updateUploadStatus(
        files.map((file) => file.name),
        "failed",
        err instanceof Error ? err.message : copy.uploads.uploadFailed
      );
      setError(copy.uploads.uploadFailed);
    }
  };

  const handleFileInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      void handleComposerFiles(event.target.files);
      event.target.value = "";
    }
  };

  const handleComposerDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (Array.from(event.dataTransfer.types).includes("Files")) {
      setIsDraggingFiles(true);
    }
  };

  const handleComposerDragLeave = (event: DragEvent<HTMLDivElement>) => {
    const nextTarget = event.relatedTarget as Node | null;
    if (!nextTarget || !event.currentTarget.contains(nextTarget)) {
      setIsDraggingFiles(false);
    }
  };

  const handleComposerDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDraggingFiles(false);
    void handleComposerFiles(event.dataTransfer.files);
  };

  const removeUploadItem = (id: string) => {
    setUploadItems((items) => items.filter((item) => item.id !== id));
  };

  const startChat = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const cleanPrompt = prompt.trim();
    if (!cleanPrompt || isStarting || isUploadingFiles) return;

    setError("");
    setIsStarting(true);

    if (typeof window !== "undefined") {
      sessionStorage.setItem("altbot.pendingPrompt", cleanPrompt);
    }

    try {
      const knowledgeBases: KnowledgeBase[] = await api.get(
        "/api/knowledge-base"
      );
      const knowledgeBasesWithDocuments = knowledgeBases.filter(
        (kb) => kb.documents && kb.documents.length > 0
      );

      if (knowledgeBasesWithDocuments.length === 0) {
        await openKnowledgeBaseUpload(knowledgeBases);
        return;
      }

      const chat: Chat = await api.post("/api/chat/", {
        title: getPromptTitle(cleanPrompt) || copy.home.newChat,
        knowledge_base_ids: knowledgeBasesWithDocuments.map((kb) => kb.id),
      });

      if (typeof window !== "undefined") {
        sessionStorage.setItem(`altbot.pendingMessage.${chat.id}`, cleanPrompt);
        sessionStorage.removeItem("altbot.pendingPrompt");
      }

      router.push(`/dashboard/chat/${chat.id}`);
    } catch (err) {
      setError(copy.home.errorOpenChat);
    } finally {
      setIsStarting(false);
    }
  };

  return (
    <main className="chatgpt-surface relative min-h-screen overflow-hidden text-foreground">
      <div className="pointer-events-none absolute left-1/2 top-0 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-[#10a37f]/10 blur-3xl" />
      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-5">
        <Link
          href="/"
          className="chatgpt-enter flex items-center gap-3 rounded-full px-2 py-1.5 transition hover:bg-card/70"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-card shadow-sm ring-1 ring-border">
            <img src="/logo.svg" alt="ALTBot" className="h-7 w-7 rounded-lg" />
          </span>
          <span className="text-lg font-semibold tracking-tight">ALTBot</span>
        </Link>
        <div className="chatgpt-enter flex flex-wrap items-center justify-end gap-2 text-sm">
          <LanguageSelector compact />
          <ThemeToggle compact />
          <Link
            href="/dashboard/knowledge"
            className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-muted-foreground transition hover:bg-card hover:text-foreground"
          >
            <Database className="h-4 w-4" />
            {copy.home.knowledgeBase}
          </Link>
          <Link
            href="/dashboard/chat/new"
            className="rounded-full bg-primary px-4 py-2 font-medium text-primary-foreground shadow-sm transition hover:-translate-y-0.5 hover:opacity-90"
          >
            {copy.home.newChat}
          </Link>
        </div>
      </header>

      <section className="relative z-10 mx-auto flex min-h-[calc(100vh-5rem)] max-w-5xl flex-col items-center justify-center px-5 pb-12">
        <div className="chatgpt-enter-slow chatgpt-float mb-8 flex h-16 w-16 items-center justify-center rounded-3xl bg-card shadow-sm ring-1 ring-border">
          <Sparkles className="h-8 w-8 text-[#10a37f]" />
        </div>

        <div className="chatgpt-enter-slow w-full max-w-3xl text-center">
          <p className="mb-4 text-sm font-medium uppercase tracking-[0.24em] text-muted-foreground">
            {copy.home.eyebrow}
          </p>
          <h1 className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
            {copy.home.title}
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
            {copy.home.subtitle}
          </p>
        </div>

        <form onSubmit={startChat} className="chatgpt-enter mt-10 w-full max-w-3xl">
          <div
            onDragOver={handleComposerDragOver}
            onDragLeave={handleComposerDragLeave}
            onDrop={handleComposerDrop}
            className={`chatgpt-composer relative rounded-[2rem] border bg-card/95 p-3 backdrop-blur ${
              isDraggingFiles
                ? "border-[#10a37f] ring-4 ring-[#10a37f]/10"
                : "border-border"
            }`}
          >
            {isDraggingFiles && (
              <div className="pointer-events-none absolute inset-2 z-10 flex items-center justify-center rounded-[1.5rem] border border-dashed border-[#10a37f] bg-card/90 text-sm font-medium text-[#0f8f71]">
                {copy.uploads.dropToUpload}
              </div>
            )}
            <label htmlFor="prompt" className="sr-only">
              {copy.home.promptLabel}
            </label>
            <textarea
              id="prompt"
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder={copy.home.promptPlaceholder}
              rows={3}
              className="max-h-48 min-h-24 w-full resize-none bg-transparent px-4 py-3 text-base leading-7 text-foreground outline-none placeholder:text-muted-foreground"
            />
            {uploadItems.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-2 px-2">
                {uploadItems.map((item) => (
                  <div
                    key={item.id}
                    className={`flex max-w-full items-center gap-2 rounded-full border px-3 py-1.5 text-xs ${
                      item.status === "failed"
                        ? "border-red-200 bg-red-50 text-red-700"
                        : item.status === "completed"
                        ? "border-[#10a37f]/20 bg-[#10a37f]/10 text-[#0f8f71]"
                        : "border-border bg-muted text-muted-foreground"
                    }`}
                    title={item.message || item.file.name}
                  >
                    {item.status === "completed" ? (
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                    ) : item.status === "failed" ? (
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    ) : (
                      <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
                    )}
                    <span className="max-w-[14rem] truncate">{item.file.name}</span>
                    <span className="shrink-0 opacity-80">
                      {uploadStatusLabel(item.status)}
                    </span>
                    {["completed", "failed"].includes(item.status) && (
                      <button
                        type="button"
                        onClick={() => removeUploadItem(item.id)}
                        className="rounded-full p-0.5 hover:bg-black/5"
                        aria-label={copy.common.delete}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
            <div className="flex items-center justify-between gap-3 border-t border-border px-2 pt-3">
              <div className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept={SUPPORTED_UPLOAD_ACCEPT}
                  onChange={handleFileInputChange}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition hover:bg-accent hover:text-foreground"
                  title={`${copy.uploads.attach} · ${copy.uploads.supported}`}
                  aria-label={copy.uploads.attach}
                >
                  <Paperclip className="h-4 w-4" />
                </button>
                <span className="hidden truncate sm:inline">
                  {isUploadingFiles
                    ? copy.uploads.waitForProcessing
                    : copy.home.noDocsHint}
                </span>
              </div>
              <button
                type="submit"
                disabled={!prompt.trim() || isStarting || isUploadingFiles}
                className="chatgpt-send ml-auto inline-flex h-11 w-11 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
                aria-label={copy.home.promptLabel}
              >
                {isStarting || isUploadingFiles ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <ArrowUp className="h-5 w-5" />
                )}
              </button>
            </div>
          </div>
          {error && (
            <p className="chatgpt-message mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </p>
          )}
        </form>

        <div className="mt-6 grid w-full max-w-3xl gap-3 sm:grid-cols-3">
          {copy.home.examples.map((example, index) => (
            <button
              key={example}
              type="button"
              onClick={() => setPrompt(example)}
              className="chatgpt-card-hover chatgpt-enter rounded-2xl border border-border bg-card/70 px-4 py-3 text-left text-sm text-muted-foreground backdrop-blur hover:bg-card hover:text-foreground"
              style={{ animationDelay: `${120 + index * 80}ms` }}
            >
              {example}
            </button>
          ))}
        </div>

        <div className="chatgpt-enter mt-10 grid w-full max-w-3xl gap-3 text-sm text-muted-foreground sm:grid-cols-3">
          <div className="flex items-center gap-2 rounded-2xl bg-card/70 px-4 py-3 ring-1 ring-border">
            <UploadCloud className="h-4 w-4 text-[#10a37f]" />
            {copy.home.features.upload}
          </div>
          <div className="flex items-center gap-2 rounded-2xl bg-card/70 px-4 py-3 ring-1 ring-border">
            <FileText className="h-4 w-4 text-[#10a37f]" />
            {copy.home.features.answers}
          </div>
          <div className="flex items-center gap-2 rounded-2xl bg-card/70 px-4 py-3 ring-1 ring-border">
            <ShieldCheck className="h-4 w-4 text-[#10a37f]" />
            {copy.home.features.noLogin}
          </div>
        </div>
      </section>
    </main>
  );
}
