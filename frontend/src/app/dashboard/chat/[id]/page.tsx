"use client";

import {
  ChangeEvent,
  DragEvent,
  FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { useChat } from "ai/react";
import {
  AlertTriangle,
  ArrowUp,
  CheckCircle2,
  FileText,
  Loader2,
  Paperclip,
  ShieldCheck,
  Sparkles,
  User,
  Wand2,
  X,
} from "lucide-react";
import DashboardLayout from "@/components/layout/dashboard-layout";
import { api, ApiError } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import { Answer } from "@/components/chat/answer";
import { Switch } from "@/components/ui/switch";
import {
  ComposerUploadItem,
  ComposerUploadStatus,
  SUPPORTED_UPLOAD_ACCEPT,
  uploadFilesToKnowledgeBase,
} from "@/lib/document-upload";
import { useI18n } from "@/lib/i18n";

interface Message {
  id: string;
  role: "assistant" | "user" | "system" | "data";
  content: string;
  citations?: Citation[];
}

interface ChatMessage {
  id: number;
  content: string;
  role: "assistant" | "user";
  created_at: string;
}

interface Chat {
  id: number;
  title: string;
  messages: ChatMessage[];
  knowledge_base_ids: number[];
}

interface Citation {
  id: number;
  text: string;
  metadata: Record<string, any>;
}

type DocumentTemplate = "auto" | "di" | "pp" | "ri";

declare module "ai/react" {
  interface Message {
    citations?: Citation[];
  }
}

const createUploadItemId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`;

export default function ChatPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { copy } = useI18n();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const hasSentPendingPrompt = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const [isChatLoaded, setIsChatLoaded] = useState(false);
  const [knowledgeBaseIds, setKnowledgeBaseIds] = useState<number[]>([]);
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const [uploadItems, setUploadItems] = useState<ComposerUploadItem[]>([]);
  const [strictSources, setStrictSources] = useState(true);
  const [documentWizard, setDocumentWizard] = useState(false);
  const [documentTemplate, setDocumentTemplate] =
    useState<DocumentTemplate>("auto");

  const isUploadingFiles = uploadItems.some((item) =>
    ["queued", "uploading", "processing"].includes(item.status)
  );

  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    setMessages,
    append,
  } = useChat({
    api: `/api/chat/${params.id}/messages`,
    body: {
      strict_sources: strictSources,
      document_wizard: documentWizard,
      document_template: documentTemplate,
    },
  });

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

  useEffect(() => {
    fetchChat();
  }, []);

  useEffect(() => {
    if (isChatLoaded) {
      scrollToBottom();
    }
  }, [messages, isChatLoaded]);

  useEffect(() => {
    if (
      !isChatLoaded ||
      hasSentPendingPrompt.current ||
      typeof window === "undefined"
    ) {
      return;
    }

    const storageKey = `altbot.pendingMessage.${params.id}`;
    const pendingPrompt =
      sessionStorage.getItem(storageKey) ||
      sessionStorage.getItem("altbot.pendingPrompt");

    if (!pendingPrompt) return;

    hasSentPendingPrompt.current = true;
    sessionStorage.removeItem(storageKey);
    sessionStorage.removeItem("altbot.pendingPrompt");

    void append({
      role: "user",
      content: pendingPrompt,
    });
  }, [append, isChatLoaded, params.id]);

  const fetchChat = async () => {
    try {
      const data: Chat = await api.get(`/api/chat/${params.id}`);
      setKnowledgeBaseIds(data.knowledge_base_ids || []);
      const formattedMessages = data.messages.map((msg) => {
        if (msg.role !== "assistant" || !msg.content) {
          return {
            id: msg.id.toString(),
            role: msg.role,
            content: msg.content,
          };
        }

        try {
          if (!msg.content.includes("__LLM_RESPONSE__")) {
            return {
              id: msg.id.toString(),
              role: msg.role,
              content: msg.content,
            };
          }

          const [base64Part, responseText] =
            msg.content.split("__LLM_RESPONSE__");

          const contextData = base64Part
            ? (JSON.parse(atob(base64Part.trim())) as {
                context: Array<{
                  page_content: string;
                  metadata: Record<string, any>;
                }>;
              })
            : null;

          const citations: Citation[] =
            contextData?.context.map((citation, index) => ({
              id: index + 1,
              text: citation.page_content,
              metadata: citation.metadata,
            })) || [];

          return {
            id: msg.id.toString(),
            role: msg.role,
            content: responseText || "",
            citations,
          };
        } catch (e) {
          console.error("Failed to process message:", e);
          return {
            id: msg.id.toString(),
            role: msg.role,
            content: msg.content,
          };
        }
      });
      setMessages(formattedMessages);
    } catch (error) {
      console.error("Failed to fetch chat:", error);
      if (error instanceof ApiError) {
        toast({
          title: copy.common.error,
          description: error.message,
          variant: "destructive",
        });
      }
      router.push("/dashboard/chat");
    } finally {
      setIsChatLoaded(true);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleComposerFiles = async (fileList: FileList | File[]) => {
    const files = Array.from(fileList);
    if (files.length === 0) return;

    if (!knowledgeBaseIds[0]) {
      toast({
        title: copy.common.error,
        description: copy.chat.selectKbError,
        variant: "destructive",
      });
      return;
    }

    const nextItems: ComposerUploadItem[] = files.map((file) => ({
      id: createUploadItemId(),
      file,
      status: "queued",
    }));
    setUploadItems((items) => [...items, ...nextItems]);

    try {
      const result = await uploadFilesToKnowledgeBase(
        knowledgeBaseIds[0],
        files,
        updateUploadStatus
      );

      if (result.failed > 0) {
        toast({
          title: copy.common.error,
          description: copy.uploads.uploadFailed,
          variant: "destructive",
        });
      }
    } catch (err) {
      updateUploadStatus(
        files.map((file) => file.name),
        "failed",
        err instanceof Error ? err.message : copy.uploads.uploadFailed
      );
      toast({
        title: copy.common.error,
        description: copy.uploads.uploadFailed,
        variant: "destructive",
      });
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

  const submitChat = (event: FormEvent<HTMLFormElement>) => {
    if (isUploadingFiles) {
      event.preventDefault();
      return;
    }
    handleSubmit(event);
  };

  const markdownParse = (text: string) => {
    return text
      .replace(/\[\[([cC])itation/g, "[citation")
      .replace(/[cC]itation:(\d+)]]/g, "citation:$1]")
      .replace(/\[\[([cC]itation:\d+)]](?!])/g, `[$1]`)
      .replace(/\[[cC]itation:(\d+)]/g, "[citation]($1)");
  };

  const processedMessages = useMemo(() => {
    return messages.map((message) => {
      if (message.role !== "assistant" || !message.content) return message;

      try {
        if (!message.content.includes("__LLM_RESPONSE__")) {
          return {
            ...message,
            content: markdownParse(message.content),
          };
        }

        const [base64Part, responseText] =
          message.content.split("__LLM_RESPONSE__");

        const contextData = base64Part
          ? (JSON.parse(atob(base64Part.trim())) as {
              context: Array<{
                page_content: string;
                metadata: Record<string, any>;
              }>;
            })
          : null;

        const citations: Citation[] =
          contextData?.context.map((citation, index) => ({
            id: index + 1,
            text: citation.page_content,
            metadata: citation.metadata,
          })) || [];

        return {
          ...message,
          content: markdownParse(responseText || ""),
          citations,
        };
      } catch (e) {
        console.error("Failed to process message:", e);
        return message;
      }
    });
  }, [messages]);

  const documentTemplateOptions: Array<{
    value: DocumentTemplate;
    label: string;
  }> = [
    { value: "auto", label: copy.chat.templateAuto },
    { value: "di", label: copy.chat.templateDi },
    { value: "pp", label: copy.chat.templatePp },
    { value: "ri", label: copy.chat.templateRi },
  ];

  return (
    <DashboardLayout>
      <div className="mx-auto flex h-[calc(100vh-1.5rem)] max-w-5xl flex-col overflow-hidden rounded-[1.75rem] bg-background">
        <div className="flex-1 overflow-y-auto scroll-smooth px-2 pb-32 pt-4 sm:px-6">
          {processedMessages.length === 0 ? (
            <div className="chatgpt-enter-slow flex min-h-full flex-col items-center justify-center text-center">
              <div className="chatgpt-float mb-5 flex h-16 w-16 items-center justify-center rounded-3xl bg-card ring-1 ring-border">
                <Sparkles className="h-8 w-8 text-[#10a37f]" />
              </div>
              <h1 className="text-3xl font-semibold tracking-tight text-foreground">
                {copy.chat.emptyTitle}
              </h1>
              <p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground">
                {copy.chat.emptyDescription}
              </p>
            </div>
          ) : (
            <div className="mx-auto max-w-3xl space-y-8">
              {processedMessages.map((message) =>
                message.role === "assistant" ? (
                  <div
                    key={message.id}
                    className="chatgpt-message flex items-start gap-4"
                  >
                    <div className="chatgpt-shimmer flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-card ring-1 ring-border">
                      <img
                        src="/logo.png"
                        className="h-7 w-7 rounded-full"
                        alt="ALTBot"
                      />
                    </div>
                    <div className="min-w-0 flex-1 px-1 py-1 text-[15px] leading-7 text-foreground">
                      <Answer
                        key={message.id}
                        markdown={message.content}
                        citations={message.citations}
                      />
                    </div>
                  </div>
                ) : (
                  <div key={message.id} className="chatgpt-message flex justify-end">
                    <div className="flex max-w-[82%] items-start gap-3">
                      <div className="rounded-[1.35rem] bg-muted px-5 py-3 text-sm leading-6 text-foreground shadow-sm">
                        {message.content}
                      </div>
                      <div className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary sm:flex">
                        <User className="h-4 w-4 text-primary-foreground" />
                      </div>
                    </div>
                  </div>
                )
              )}
            </div>
          )}

          {isLoading &&
            processedMessages[processedMessages.length - 1]?.role !==
              "assistant" && (
              <div className="chatgpt-message mx-auto mt-8 flex max-w-3xl items-start gap-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-card ring-1 ring-border">
                  <img
                    src="/logo.png"
                    className="h-7 w-7 rounded-full"
                    alt="ALTBot"
                  />
                </div>
                <div className="rounded-2xl bg-muted px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <span className="chatgpt-dot h-2 w-2 rounded-full bg-[#10a37f]" />
                    <span className="chatgpt-dot h-2 w-2 rounded-full bg-[#10a37f] [animation-delay:0.16s]" />
                    <span className="chatgpt-dot h-2 w-2 rounded-full bg-[#10a37f] [animation-delay:0.32s]" />
                  </div>
                </div>
              </div>
            )}
          <div ref={messagesEndRef} />
        </div>

        <form
          onSubmit={submitChat}
          className="sticky bottom-0 bg-gradient-to-t from-background via-background/95 to-background/0 px-2 pb-4 pt-8 sm:px-6"
        >
          <div className="mx-auto mb-3 flex max-w-3xl flex-col gap-2 rounded-3xl border border-border bg-card/80 p-3 text-sm shadow-sm backdrop-blur md:flex-row md:items-start md:justify-between">
            <label className="flex flex-1 cursor-pointer items-start gap-3 rounded-2xl px-2 py-1.5 transition hover:bg-accent/60">
              <Switch
                checked={strictSources}
                onCheckedChange={setStrictSources}
                className="mt-0.5"
              />
              <span>
                <span className="flex items-center gap-2 font-medium text-foreground">
                  <ShieldCheck className="h-4 w-4 text-[#10a37f]" />
                  {copy.chat.strictSources}
                </span>
                <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                  {copy.chat.strictSourcesHint}
                </span>
              </span>
            </label>

            <div className="flex flex-1 flex-col gap-2 rounded-2xl px-2 py-1.5">
              <label className="flex cursor-pointer items-start gap-3">
                <Switch
                  checked={documentWizard}
                  onCheckedChange={setDocumentWizard}
                  className="mt-0.5"
                />
                <span>
                  <span className="flex items-center gap-2 font-medium text-foreground">
                    <Wand2 className="h-4 w-4 text-[#10a37f]" />
                    {copy.chat.documentWizard}
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                    {copy.chat.documentWizardHint}
                  </span>
                </span>
              </label>

              {documentWizard && (
                <div className="flex flex-wrap gap-1.5 pl-14">
                  {documentTemplateOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setDocumentTemplate(option.value)}
                      className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition ${
                        documentTemplate === option.value
                          ? "border-[#10a37f]/40 bg-[#10a37f]/10 text-[#0f8f71]"
                          : "border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground"
                      }`}
                    >
                      <FileText className="h-3.5 w-3.5" />
                      {option.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div
            onDragOver={handleComposerDragOver}
            onDragLeave={handleComposerDragLeave}
            onDrop={handleComposerDrop}
            className={`chatgpt-composer relative mx-auto max-w-3xl rounded-[1.75rem] border bg-card px-4 py-3 ${
              isDraggingFiles
                ? "border-[#10a37f] ring-4 ring-[#10a37f]/10"
                : "border-border"
            }`}
          >
            {isDraggingFiles && (
              <div className="pointer-events-none absolute inset-2 z-10 flex items-center justify-center rounded-[1.25rem] border border-dashed border-[#10a37f] bg-card/90 text-sm font-medium text-[#0f8f71]">
                {copy.uploads.dropToUpload}
              </div>
            )}
            {uploadItems.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-2">
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
            <div className="flex items-center gap-3">
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
              <input
                value={input}
                onChange={handleInputChange}
                placeholder={
                  isUploadingFiles
                    ? copy.uploads.waitForProcessing
                    : copy.chat.placeholder
                }
                className="min-w-0 flex-1 bg-transparent text-[15px] text-foreground outline-none placeholder:text-muted-foreground"
              />
              <button
                type="submit"
                disabled={isLoading || !input.trim() || isUploadingFiles}
                className="chatgpt-send inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
                aria-label={copy.chat.sendMessage}
              >
                {isLoading || isUploadingFiles ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ArrowUp className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>
          <p className="mt-2 text-center text-xs text-muted-foreground">
            {copy.chat.disclaimer}
          </p>
        </form>
      </div>
    </DashboardLayout>
  );
}
