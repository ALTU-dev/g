"use client";

import { useState, useCallback } from "react";
import { FileIcon, defaultStyles } from "react-file-icon";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Upload, X, Settings, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { api, ApiError } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { useDropzone } from "react-dropzone";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

interface DocumentUploadStepsProps {
  knowledgeBaseId: number;
  onComplete?: () => void;
}

interface FileStatus {
  file: File;
  status:
    | "pending"
    | "uploading"
    | "uploaded"
    | "processing"
    | "completed"
    | "error";
  uploadId?: number;
  documentId?: number;
  tempPath?: string;
  error?: string;
}

interface UploadResult {
  upload_id?: number;
  document_id?: number;
  file_name: string;
  status: "exists" | "pending";
  message?: string;
  skip_processing: boolean;
  temp_path?: string;
}

interface PreviewChunk {
  content: string;
  metadata: Record<string, any>;
}

interface PreviewResponse {
  chunks: PreviewChunk[];
  total_chunks: number;
}

interface TaskResponse {
  tasks: Array<{
    upload_id: number;
    task_id: number;
  }>;
}

interface TaskStatus {
  document_id: number | null;
  upload_id?: number;
  status: "pending" | "processing" | "completed" | "failed";
  error_message?: string;
}

interface TaskStatusMap {
  [key: number]: TaskStatus;
}

interface TaskStatusResponse {
  [key: string]: TaskStatus;
}

export function DocumentUploadSteps({
  knowledgeBaseId,
  onComplete,
}: DocumentUploadStepsProps) {
  const { copy } = useI18n();
  const [currentStep, setCurrentStep] = useState(1);
  const [files, setFiles] = useState<FileStatus[]>([]);
  const [uploadedDocuments, setUploadedDocuments] = useState<{
    [key: number]: PreviewResponse;
  }>({});
  const [selectedDocumentId, setSelectedDocumentId] = useState<number | null>(
    null
  );
  const [taskStatuses, setTaskStatuses] = useState<{
    [key: number]: TaskStatus;
  }>({});
  const [isLoading, setIsLoading] = useState(false);
  const [chunkSize, setChunkSize] = useState(1000);
  const [chunkOverlap, setChunkOverlap] = useState(200);
  const { toast } = useToast();

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setFiles((prev) => [
      ...prev,
      ...acceptedFiles.map((file) => ({
        file,
        status: "pending" as const,
      })),
    ]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        [".docx"],
      "text/plain": [".txt"],
      "text/markdown": [".md"],
      "image/png": [".png"],
      "image/jpeg": [".jpg", ".jpeg"],
      "image/webp": [".webp"],
      "image/bmp": [".bmp"],
      "image/tiff": [".tif", ".tiff"],
    },
  });

  const removeFile = (file: File) => {
    setFiles((prev) => prev.filter((f) => f.file !== file));
  };

  // Step 1: Upload files
  const handleFileUpload = async () => {
    const pendingFiles = files.filter((f) => f.status === "pending");
    if (pendingFiles.length === 0) return;

    setIsLoading(true);
    try {
      const formData = new FormData();
      pendingFiles.forEach((fileStatus) => {
        formData.append("files", fileStatus.file);
      });

      const data = (await api.post(
        `/api/knowledge-base/${knowledgeBaseId}/documents/upload`,
        formData,
        {
          headers: {},
        }
      )) as UploadResult[];

      // Update file statuses
      setFiles((prev) =>
        prev.map((f) => {
          const uploadResult = data.find((d) => d.file_name === f.file.name);
          if (uploadResult) {
            if (uploadResult.status === "exists") {
              return {
                ...f,
                status: "completed",
                documentId: uploadResult.document_id,
                error: uploadResult.message,
              };
            } else {
              return {
                ...f,
                status: "uploaded",
                uploadId: uploadResult.upload_id,
                tempPath: uploadResult.temp_path,
              };
            }
          }
          return f;
        })
      );

      // 移除自动处理的逻辑，只更新步骤
      setCurrentStep(2);
      toast({
        title: copy.documents.uploadSuccessful,
        description: `${data.length} ${copy.documents.uploadSuccessfulDescription}`,
      });
    } catch (error) {
      toast({
        title: copy.documents.uploadFailed,
        description:
          error instanceof ApiError
            ? error.message
            : copy.documents.somethingWentWrong,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2: Preview chunks
  const handlePreview = async () => {
    const selectedFile = files.find(
      (f) =>
        f.documentId === selectedDocumentId || f.uploadId === selectedDocumentId
    );
    if (!selectedFile) return;

    setIsLoading(true);
    try {
      const data = await api.post(
        `/api/knowledge-base/${knowledgeBaseId}/documents/preview`,
        {
          document_ids: [selectedDocumentId],
          chunk_size: chunkSize,
          chunk_overlap: chunkOverlap,
        }
      );

      setUploadedDocuments(data);

      toast({
        title: copy.documents.previewGenerated,
        description: copy.documents.previewGeneratedDescription,
      });
    } catch (error) {
      toast({
        title: copy.documents.previewFailed,
        description:
          error instanceof ApiError
            ? error.message
            : copy.documents.somethingWentWrong,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Step 3: Process documents
  const handleProcess = async (uploadResults?: UploadResult[]) => {
    const resultsToProcess =
      uploadResults ||
      files
        .filter((f) => f.status === "uploaded")
        .map((f) => ({
          upload_id: f.uploadId!,
          file_name: f.file.name,
          status: "pending" as const,
          skip_processing: false,
          temp_path: f.tempPath!,
        }));

    if (resultsToProcess.length === 0) return;

    setIsLoading(true);
    try {
      const data = (await api.post(
        `/api/knowledge-base/${knowledgeBaseId}/documents/process`,
        resultsToProcess
      )) as TaskResponse;

      // Initialize task statuses
      const initialStatuses = data.tasks.reduce<TaskStatusMap>(
        (acc, task) => ({
          ...acc,
          [task.task_id]: {
            document_id: null,
            upload_id: task.upload_id,
            status: "pending" as const,
          },
        }),
        {}
      );
      setTaskStatuses(initialStatuses);

      // Start polling for task status
      pollTaskStatus(data.tasks.map((t) => t.task_id));
    } catch (error) {
      setIsLoading(false);
      toast({
        title: copy.documents.processingFailed,
        description:
          error instanceof ApiError
            ? error.message
            : copy.documents.somethingWentWrong,
        variant: "destructive",
      });
    }
  };

  // Poll task status
  const pollTaskStatus = async (taskIds: number[]) => {
    const poll = async () => {
      try {
        const response = (await api.get(
          `/api/knowledge-base/${knowledgeBaseId}/documents/tasks?task_ids=${taskIds.join(
            ","
          )}`
        )) as TaskStatusResponse;

        // Convert string keys to numbers
        const data = Object.entries(response).reduce<TaskStatusMap>(
          (acc, [key, value]) => ({
            ...acc,
            [parseInt(key)]: value,
          }),
          {}
        );

        setTaskStatuses(data);

        // Check if all tasks are completed or failed
        const allDone = Object.values(data).every(
          (task) => task.status === "completed" || task.status === "failed"
        );

        if (allDone) {
          setIsLoading(false);
          const hasErrors = Object.values(data).some(
            (task) => task.status === "failed"
          );
          if (!hasErrors) {
            toast({
              title: copy.documents.processingCompleted,
              description: copy.documents.processingCompletedDescription,
            });
            onComplete?.();
          } else {
            toast({
              title: copy.documents.processingCompletedWithErrors,
              description:
                copy.documents.processingCompletedWithErrorsDescription,
              variant: "destructive",
            });
          }
        } else {
          // Continue polling
          setTimeout(poll, 2000);
        }
      } catch (error) {
        setIsLoading(false);
        toast({
          title: copy.documents.statusCheckFailed,
          description:
            error instanceof ApiError
              ? error.message
              : copy.documents.somethingWentWrong,
          variant: "destructive",
        });
      }
    };

    poll();
  };

  const handleProcessClick = (e: React.MouseEvent) => {
    e.preventDefault();
    handleProcess();
  };

  const getStatusLabel = (status?: string) => {
    if (status === "pending") return copy.documents.pending;
    if (status === "processing") return copy.documents.processing;
    if (status === "completed") return copy.documents.completed;
    if (status === "failed") return copy.documents.failed;
    return copy.documents.pending;
  };

  return (
    <div className="w-full max-w-4xl mx-auto">
      <div className="mb-8">
        <div className="flex justify-between mb-2">
          {[
            { step: 1, icon: Upload, label: copy.documents.uploadLabel },
            { step: 2, icon: FileText, label: copy.documents.previewLabel },
            { step: 3, icon: Settings, label: copy.documents.processLabel },
          ].map(({ step, icon: Icon, label }, index, array) => (
            <div
              key={step}
              className="flex flex-col items-center space-y-2 flex-1"
            >
              <div
                className={cn(
                  "w-12 h-12 rounded-full flex items-center justify-center border-2 transition-colors",
                  currentStep === step
                    ? "bg-primary text-primary-foreground border-primary"
                    : currentStep > step
                    ? "bg-primary/20 border-primary/20"
                    : "bg-background border-input"
                )}
              >
                <Icon className="w-6 h-6" />
              </div>
              <span className="text-sm font-medium">
                {step}. {label}
              </span>
              {index < array.length - 1 && (
                <div
                  className={cn(
                    "h-0.5 w-full mt-2",
                    currentStep > step ? "bg-primary/20" : "bg-input"
                  )}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      <Tabs value={String(currentStep)} className="w-full">
        <TabsContent value="1" className="mt-6">
          <Card className="p-6">
            <div className="space-y-4">
              <div
                {...getRootProps()}
                className={cn(
                  "border-2 border-dashed rounded-lg p-8 text-center transition-colors",
                  isDragActive
                    ? "border-primary bg-primary/5"
                    : "hover:border-primary/50"
                )}
              >
                <input {...getInputProps()} />
                <Upload className="w-12 h-12 mx-auto text-muted-foreground" />
                <p className="mt-2 text-sm font-medium">
                  {copy.documents.dropzone}
                </p>
                <p className="text-xs text-muted-foreground">
                  {copy.documents.supports}
                </p>
              </div>
              {files.length > 0 && (
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {files.map((fileStatus) => (
                    <div
                      key={fileStatus.file.name}
                      className="flex items-center justify-between p-4 rounded-lg border"
                    >
                      <div className="flex items-center space-x-4">
                        <div className="w-8 h-8">
                          <FileIcon
                            extension={fileStatus.file.name.split(".").pop()}
                            {...defaultStyles[
                              fileStatus.file.name
                                .split(".")
                                .pop() as keyof typeof defaultStyles
                            ]}
                          />
                        </div>
                        <div>
                          <p className="text-sm font-medium">
                            {fileStatus.file.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {(fileStatus.file.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        {fileStatus.status === "uploaded" && (
                          <span className="text-green-500 text-sm">
                            {copy.documents.uploaded}
                          </span>
                        )}
                        {fileStatus.status === "error" && (
                          <span className="text-red-500 text-sm">
                            {fileStatus.error}
                          </span>
                        )}
                        <button
                          onClick={() => removeFile(fileStatus.file)}
                          className="p-1 hover:bg-accent rounded-full"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <Button
                onClick={handleFileUpload}
                disabled={
                  !files.some((f) => f.status === "pending") || isLoading
                }
                className="w-full"
              >
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {copy.documents.uploadFiles}
              </Button>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="2" className="mt-6">
          <Card className="p-6">
            <div className="space-y-6">
              <h3 className="text-lg font-medium">
                {copy.documents.selectDocumentToPreview}
              </h3>
              <div className="flex items-center space-x-4">
                <Select
                  value={selectedDocumentId?.toString()}
                  onValueChange={(value: string) =>
                    setSelectedDocumentId(parseInt(value))
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue
                      placeholder={copy.documents.selectDocumentPlaceholder}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {files
                      .filter((f) => f.status === "uploaded")
                      .map((f) => (
                        <SelectItem
                          key={f.uploadId}
                          value={f.uploadId!.toString()}
                        >
                          {f.file.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="settings">
                  <AccordionTrigger>
                    {copy.documents.advancedSettings}
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="grid gap-4 md:grid-cols-2 pt-4">
                      <div className="space-y-2">
                        <Label htmlFor="chunk-size">
                          {copy.documents.chunkSize}
                        </Label>
                        <Input
                          id="chunk-size"
                          type="number"
                          value={chunkSize}
                          onChange={(e) =>
                            setChunkSize(parseInt(e.target.value))
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="chunk-overlap">
                          {copy.documents.chunkOverlap}
                        </Label>
                        <Input
                          id="chunk-overlap"
                          type="number"
                          value={chunkOverlap}
                          onChange={(e) =>
                            setChunkOverlap(parseInt(e.target.value))
                          }
                        />
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>

              <div className="flex space-x-4">
                <Button
                  onClick={handlePreview}
                  disabled={isLoading || !selectedDocumentId}
                  className="flex-1"
                >
                  {isLoading && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {copy.documents.previewChunks}
                </Button>
                <Button
                  onClick={() => setCurrentStep(3)}
                  variant="secondary"
                  className="flex-1"
                >
                  {copy.documents.continue}
                </Button>
              </div>

              {selectedDocumentId && uploadedDocuments[selectedDocumentId] && (
                <div className="space-y-4">
                  <div className="mt-4">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-medium">
                        {
                          files.find((f) => f.uploadId === selectedDocumentId)
                            ?.file.name
                        }
                      </h3>
                      <span className="text-sm text-muted-foreground">
                        {uploadedDocuments[selectedDocumentId].total_chunks}{" "}
                        {copy.documents.chunks}
                      </span>
                    </div>
                    <div className="h-[400px] overflow-y-auto space-y-2 rounded-lg border p-4">
                      {uploadedDocuments[selectedDocumentId].chunks.map(
                        (chunk: PreviewChunk, index: number) => (
                          <div
                            key={index}
                            className="p-4 bg-muted rounded-lg space-y-2"
                          >
                            <div className="text-sm text-muted-foreground">
                              {copy.documents.chunk} {index + 1}
                            </div>
                            <pre className="whitespace-pre-wrap text-sm">
                              {chunk.content}
                            </pre>
                          </div>
                        )
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </Card>
        </TabsContent>
        <TabsContent value="3" className="mt-6">
          <Card className="p-6">
            <div className="space-y-4">
              <div className="max-h-[300px] overflow-y-auto space-y-2 rounded-lg border p-4">
                {files
                  .filter((f) => f.status === "uploaded")
                  .map((file) => {
                    const task = Object.values(taskStatuses).find(
                      (t) =>
                        t.upload_id === file.uploadId ||
                        (t.document_id != null &&
                          t.document_id === file.documentId)
                    );
                    return (
                      <div
                        key={file.uploadId}
                        className="p-4 border rounded-lg space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-4">
                            <div className="w-8 h-8">
                              <FileIcon
                                extension={file.file.name.split(".").pop()}
                                {...defaultStyles[
                                  file.file.name
                                    .split(".")
                                    .pop() as keyof typeof defaultStyles
                                ]}
                              />
                            </div>
                            <div>
                              <p className="text-sm font-medium">
                                {file.file.name}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {(file.file.size / 1024 / 1024).toFixed(2)} MB
                              </p>
                              {task && (
                                <p className="text-xs text-muted-foreground">
                                  {copy.documents.status}:{" "}
                                  {getStatusLabel(task.status)}
                                </p>
                              )}
                            </div>
                          </div>
                          {task?.status === "failed" && (
                            <p className="text-sm text-destructive">
                              {task.error_message}
                            </p>
                          )}
                        </div>
                        {task &&
                          (task.status === "pending" ||
                            task.status === "processing") && (
                            <Progress
                              value={task.status === "processing" ? 50 : 25}
                              className="w-full"
                            />
                          )}
                      </div>
                    );
                  })}
              </div>

              <Button
                onClick={handleProcessClick}
                disabled={
                  isLoading ||
                  files.filter((f) => f.status === "uploaded").length === 0
                }
                className="w-full"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {copy.documents.processingLabel}
                  </>
                ) : (
                  <>
                    <Settings className="mr-2 h-4 w-4" />
                    {copy.documents.process}
                  </>
                )}
              </Button>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
