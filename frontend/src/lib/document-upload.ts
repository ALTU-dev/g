import { api } from "@/lib/api";

export type ComposerUploadStatus =
  | "queued"
  | "uploading"
  | "processing"
  | "completed"
  | "failed";

export interface ComposerUploadItem {
  id: string;
  file: File;
  status: ComposerUploadStatus;
  message?: string;
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

interface ProcessingTask {
  upload_id: number;
  task_id: number;
}

interface TaskStatus {
  document_id: number | null;
  status: "pending" | "processing" | "completed" | "failed";
  error_message?: string | null;
  upload_id: number;
  file_name?: string | null;
}

type StatusUpdater = (
  fileNames: string[],
  status: ComposerUploadStatus,
  message?: string
) => void;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const SUPPORTED_UPLOAD_ACCEPT =
  ".pdf,.docx,.txt,.md,.png,.jpg,.jpeg,.webp,.bmp,.tif,.tiff";

export async function uploadFilesToKnowledgeBase(
  knowledgeBaseId: number,
  files: File[],
  onStatus?: StatusUpdater
) {
  if (files.length === 0) {
    return { failed: 0, completed: 0 };
  }

  const fileNames = files.map((file) => file.name);
  onStatus?.(fileNames, "uploading");

  const formData = new FormData();
  files.forEach((file) => formData.append("files", file));

  const uploadResults = (await api.post(
    `/api/knowledge-base/${knowledgeBaseId}/documents/upload`,
    formData,
    { headers: {} }
  )) as UploadResult[];

  const originalNameByUploadId = new Map<number, string>();
  uploadResults.forEach((result, index) => {
    if (result.upload_id) {
      originalNameByUploadId.set(result.upload_id, files[index]?.name || result.file_name);
    }
  });

  const existing = uploadResults.filter((result) => result.skip_processing);
  const existingNames = uploadResults
    .map((result, index) => (result.skip_processing ? files[index]?.name || result.file_name : ""))
    .filter(Boolean);
  if (existingNames.length > 0) {
    onStatus?.(existingNames, "completed");
  }

  const toProcess = uploadResults.filter(
    (result) => !result.skip_processing && result.upload_id
  );

  if (toProcess.length === 0) {
    return { failed: 0, completed: uploadResults.length };
  }

  onStatus?.(
    toProcess.map((result) =>
      result.upload_id
        ? originalNameByUploadId.get(result.upload_id) || result.file_name
        : result.file_name
    ),
    "processing"
  );

  const processResponse = (await api.post(
    `/api/knowledge-base/${knowledgeBaseId}/documents/process`,
    toProcess
  )) as { tasks: ProcessingTask[] };

  const taskIds = processResponse.tasks.map((task) => task.task_id);
  if (taskIds.length === 0) {
    return { failed: 0, completed: uploadResults.length };
  }

  const startedAt = Date.now();
  const timeoutMs = 2 * 60 * 60 * 1000;
  let lastStatuses: Record<string, TaskStatus> = {};

  while (Date.now() - startedAt < timeoutMs) {
    await sleep(1500);

    lastStatuses = (await api.get(
      `/api/knowledge-base/${knowledgeBaseId}/documents/tasks?task_ids=${taskIds.join(
        ","
      )}`
    )) as Record<string, TaskStatus>;

    const statuses = Object.values(lastStatuses);
    const completed = statuses.filter((task) => task.status === "completed");
    const failed = statuses.filter((task) => task.status === "failed");

  if (completed.length > 0) {
      onStatus?.(
        completed
          .map((task) => originalNameByUploadId.get(task.upload_id) || task.file_name || "")
          .filter(Boolean),
        "completed"
      );
    }

    if (failed.length > 0) {
      failed.forEach((task) => {
        const fileName = originalNameByUploadId.get(task.upload_id) || task.file_name;
        if (fileName) {
          onStatus?.([fileName], "failed", task.error_message || undefined);
        }
      });
    }

    if (completed.length + failed.length === taskIds.length) {
      return { failed: failed.length, completed: completed.length + existing.length };
    }
  }

  const pendingFiles = Object.values(lastStatuses)
    .filter((task) => task.status !== "completed" && task.status !== "failed")
    .map((task) => originalNameByUploadId.get(task.upload_id) || task.file_name || "")
    .filter(Boolean);

  if (pendingFiles.length > 0) {
    onStatus?.(pendingFiles, "failed", "Processing timed out");
  }

  return { failed: pendingFiles.length, completed: existing.length };
}
