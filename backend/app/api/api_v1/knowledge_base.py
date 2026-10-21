import hashlib
from typing import List, Any, Dict
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from langchain_chroma import Chroma
from sqlalchemy import func, text
import logging
from datetime import datetime, timedelta
from pydantic import BaseModel
from sqlalchemy.orm import selectinload
import time
from urllib.parse import quote
from io import BytesIO

from app.db.session import get_db
from app.models.user import User
from app.core.security import get_current_user
from app.models.knowledge import KnowledgeBase, Document, ProcessingTask, DocumentChunk, DocumentUpload
from app.schemas.knowledge import (
    KnowledgeBaseCreate,
    KnowledgeBaseResponse,
    KnowledgeBaseUpdate,
    DocumentResponse,
    PreviewRequest
)
from app.services.document_processor import (
    process_document_background,
    upload_document,
    preview_document,
    PreviewResult,
    build_temp_object_path,
    ensure_supported_file,
    get_supported_content_type,
    normalize_filename,
    reindex_knowledge_base_background,
)
from app.core.config import settings
from app.core.minio import get_minio_client
from minio.error import MinioException
from app.services.vector_store import VectorStoreFactory
from app.services.embedding.embedding_factory import EmbeddingsFactory

router = APIRouter()

logger = logging.getLogger(__name__)

class TestRetrievalRequest(BaseModel):
    query: str
    kb_id: int
    top_k: int

@router.post("", response_model=KnowledgeBaseResponse)
def create_knowledge_base(
    *,
    db: Session = Depends(get_db),
    kb_in: KnowledgeBaseCreate,
    current_user: User = Depends(get_current_user)
) -> Any:
    """
    Create new knowledge base.
    """
    kb = KnowledgeBase(
        name=kb_in.name,
        description=kb_in.description,
        user_id=current_user.id
    )
    db.add(kb)
    db.commit()
    db.refresh(kb)
    logger.info(f"Knowledge base created: {kb.name} for user {current_user.id}")
    return kb

@router.get("", response_model=List[KnowledgeBaseResponse])
def get_knowledge_bases(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    skip: int = 0,
    limit: int = 100
) -> Any:
    """
    Retrieve knowledge bases.
    """
    knowledge_bases = (
        db.query(KnowledgeBase)
        .filter(KnowledgeBase.user_id == current_user.id)
        .offset(skip)
        .limit(limit)
        .all()
    )
    return knowledge_bases

@router.get("/{kb_id}", response_model=KnowledgeBaseResponse)
def get_knowledge_base(
    *,
    db: Session = Depends(get_db),
    kb_id: int,
    current_user: User = Depends(get_current_user)
) -> Any:
    """
    Get knowledge base by ID.
    """
    from sqlalchemy.orm import joinedload
    
    kb = (
        db.query(KnowledgeBase)
        .options(
            joinedload(KnowledgeBase.documents)
            .joinedload(Document.processing_tasks)
        )
        .filter(
            KnowledgeBase.id == kb_id,
            KnowledgeBase.user_id == current_user.id
        )
        .first()
    )

    if not kb:
        raise HTTPException(status_code=404, detail="Knowledge base not found")
    
    return kb

@router.put("/{kb_id}", response_model=KnowledgeBaseResponse)
def update_knowledge_base(
    *,
    db: Session = Depends(get_db),
    kb_id: int,
    kb_in: KnowledgeBaseUpdate,
    current_user: User = Depends(get_current_user)
) -> Any:
    """
    Update knowledge base.
    """
    kb = db.query(KnowledgeBase).filter(
        KnowledgeBase.id == kb_id,
        KnowledgeBase.user_id == current_user.id
    ).first()
    
    if not kb:
        raise HTTPException(status_code=404, detail="Knowledge base not found")

    for field, value in kb_in.dict(exclude_unset=True).items():
        setattr(kb, field, value)

    db.add(kb)
    db.commit()
    db.refresh(kb)
    logger.info(f"Knowledge base updated: {kb.name} for user {current_user.id}")
    return kb

@router.delete("/{kb_id}")
async def delete_knowledge_base(
    *,
    db: Session = Depends(get_db),
    kb_id: int,
    current_user: User = Depends(get_current_user)
) -> Any:
    """
    Delete knowledge base and all associated resources.
    """
    logger = logging.getLogger(__name__)
    
    kb = (
        db.query(KnowledgeBase)
        .filter(
            KnowledgeBase.id == kb_id,
            KnowledgeBase.user_id == current_user.id
        )
        .first()
    )
    if not kb:
        raise HTTPException(status_code=404, detail="Knowledge base not found")
    
    try:
        # Get all document file paths before deletion
        document_paths = [doc.file_path for doc in kb.documents]
        
        # Initialize services
        minio_client = get_minio_client()
        embeddings = EmbeddingsFactory.create()

        vector_store = VectorStoreFactory.create(
            store_type=settings.VECTOR_STORE_TYPE,
            collection_name=f"kb_{kb_id}",
            embedding_function=embeddings,
        )
        
        # Clean up external resources first
        cleanup_errors = []
        
        # 1. Clean up MinIO files
        try:
            # Delete all objects with prefix kb_{kb_id}/
            objects = minio_client.list_objects(settings.MINIO_BUCKET_NAME, prefix=f"kb_{kb_id}/")
            for obj in objects:
                minio_client.remove_object(settings.MINIO_BUCKET_NAME, obj.object_name)
            logger.info(f"Cleaned up MinIO files for knowledge base {kb_id}")
        except MinioException as e:
            cleanup_errors.append(f"Failed to clean up MinIO files: {str(e)}")
            logger.error(f"MinIO cleanup error for kb {kb_id}: {str(e)}")
        
        # 2. Clean up vector store
        try:
            vector_store._store.delete_collection(f"kb_{kb_id}")
            logger.info(f"Cleaned up vector store for knowledge base {kb_id}")
        except Exception as e:
            cleanup_errors.append(f"Failed to clean up vector store: {str(e)}")
            logger.error(f"Vector store cleanup error for kb {kb_id}: {str(e)}")
        
        # Finally, delete database records in a single transaction
        db.delete(kb)
        db.commit()
        
        # Report any cleanup errors in the response
        if cleanup_errors:
            return {
                "message": "Knowledge base deleted with cleanup warnings",
                "warnings": cleanup_errors
            }
        
        return {"message": "Knowledge base and all associated resources deleted successfully"}
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to delete knowledge base {kb_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to delete knowledge base: {str(e)}")

# Batch upload documents
@router.post("/{kb_id}/documents/upload")
async def upload_kb_documents(
    kb_id: int,
    files: List[UploadFile] = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Upload multiple documents to MinIO.
    """
    kb = db.query(KnowledgeBase).filter(
        KnowledgeBase.id == kb_id,
        KnowledgeBase.user_id == current_user.id
    ).first()
    if not kb:
        raise HTTPException(status_code=404, detail="Knowledge base not found")
    
    results = []
    for file in files:
        display_name = normalize_filename(file.filename)
        try:
            ensure_supported_file(display_name)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc))

        file_content = await file.read()
        file_hash = hashlib.sha256(file_content).hexdigest()

        existing_document = db.query(Document).filter(
            Document.file_name == display_name,
            Document.file_hash == file_hash,
            Document.knowledge_base_id == kb_id
        ).first()

        if existing_document:
            results.append({
                "document_id": existing_document.id,
                "file_name": existing_document.file_name,
                "status": "exists",
                "message": "File already exists and has been processed",
                "skip_processing": True
            })
            continue

        temp_path = build_temp_object_path(kb_id, file_hash, display_name)
        content_type = get_supported_content_type(display_name, file.content_type)
        try:
            minio_client = get_minio_client()
            file_size = len(file_content)
            minio_client.put_object(
                bucket_name=settings.MINIO_BUCKET_NAME,
                object_name=temp_path,
                data=BytesIO(file_content),
                length=file_size,
                content_type=content_type
            )
        except MinioException as e:
            logger.error(f"Failed to upload file to MinIO: {str(e)}")
            raise HTTPException(status_code=500, detail="Failed to upload file")

        upload = DocumentUpload(
            knowledge_base_id=kb_id,
            file_name=display_name,
            file_hash=file_hash,
            file_size=len(file_content),
            content_type=content_type,
            temp_path=temp_path
        )
        db.add(upload)
        db.commit()
        db.refresh(upload)

        results.append({
            "upload_id": upload.id,
            "file_name": display_name,
            "temp_path": temp_path,
            "status": "pending",
            "skip_processing": False
        })
    
    return results

@router.post("/{kb_id}/documents/preview")
async def preview_kb_documents(
    kb_id: int,
    preview_request: PreviewRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Dict[int, PreviewResult]:
    """
    Preview multiple documents' chunks.
    """
    results = {}
    for doc_id in preview_request.document_ids:
        document = db.query(Document).join(KnowledgeBase).filter(
            Document.id == doc_id,
            Document.knowledge_base_id == kb_id,
            KnowledgeBase.user_id == current_user.id
        ).first()
        
        if document:
            file_path = document.file_path
        else:
            upload = db.query(DocumentUpload).join(KnowledgeBase).filter(
                DocumentUpload.id == doc_id,
                DocumentUpload.knowledge_base_id == kb_id,
                KnowledgeBase.user_id == current_user.id
            ).first()
            
            if not upload:
                raise HTTPException(status_code=404, detail=f"Document {doc_id} not found")
            
            file_path = upload.temp_path
        
        preview = await preview_document(
            file_path,
            chunk_size=preview_request.chunk_size,
            chunk_overlap=preview_request.chunk_overlap
        )
        results[doc_id] = preview
    
    return results

@router.post("/{kb_id}/documents/process")
async def process_kb_documents(
    kb_id: int,
    upload_results: List[dict],
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Process multiple documents asynchronously.
    """
    start_time = time.time()
    
    kb = db.query(KnowledgeBase).filter(
        KnowledgeBase.id == kb_id,
        KnowledgeBase.user_id == current_user.id
    ).first()
    
    if not kb:
        raise HTTPException(status_code=404, detail="Knowledge base not found")
    
    task_info = []
    upload_ids = []
    
    for result in upload_results:
        if result.get("skip_processing"):
            continue
        upload_ids.append(result["upload_id"])
    
    if not upload_ids:
        return {"tasks": []}
    
    uploads = db.query(DocumentUpload).filter(
        DocumentUpload.id.in_(upload_ids),
        DocumentUpload.knowledge_base_id == kb_id
    ).all()
    uploads_dict = {upload.id: upload for upload in uploads}
    if len(uploads_dict) != len(set(upload_ids)):
        raise HTTPException(status_code=400, detail="One or more upload IDs are invalid")
    
    all_tasks = []
    for upload_id in upload_ids:
        upload = uploads_dict.get(upload_id)
        if not upload:
            continue
            
        task = ProcessingTask(
            document_upload_id=upload_id,
            knowledge_base_id=kb_id,
            status="pending"
        )
        all_tasks.append(task)
    
    db.add_all(all_tasks)
    db.commit()
    
    for task in all_tasks:
        db.refresh(task)
    
    task_data = []
    for i, upload_id in enumerate(upload_ids):
        if i < len(all_tasks):
            task = all_tasks[i]
            upload = uploads_dict.get(upload_id)
            
            task_info.append({
                "upload_id": upload_id,
                "task_id": task.id
            })
            
            if upload:
                task_data.append({
                    "task_id": task.id,
                    "upload_id": upload_id,
                    "temp_path": upload.temp_path,
                    "file_name": upload.file_name
                })
    
    background_tasks.add_task(
        add_processing_tasks_to_queue,
        task_data,
        kb_id
    )
    
    return {"tasks": task_info}

def add_processing_tasks_to_queue(task_data, kb_id):
    """Helper function to add document processing tasks to the queue without blocking the main response."""
    for data in task_data:
        process_document_background(
            data["temp_path"],
            data["file_name"],
            kb_id,
            data["task_id"],
            None
        )
    logger.info(f"Added {len(task_data)} document processing tasks to queue")

@router.post("/cleanup")
async def cleanup_temp_files(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Clean up expired temporary files.
    """
    expired_time = datetime.utcnow() - timedelta(hours=24)
    expired_uploads = db.query(DocumentUpload).filter(
        DocumentUpload.created_at < expired_time
    ).all()
    
    minio_client = get_minio_client()
    for upload in expired_uploads:
        try:
            minio_client.remove_object(
                bucket_name=settings.MINIO_BUCKET_NAME,
                object_name=upload.temp_path
            )
        except MinioException as e:
            logger.error(f"Failed to delete temp file {upload.temp_path}: {str(e)}")
        
        db.delete(upload)
    
    db.commit()
    
    return {"message": f"Cleaned up {len(expired_uploads)} expired uploads"}

@router.get("/{kb_id}/documents/tasks")
async def get_processing_tasks(
    kb_id: int,
    task_ids: str = Query(..., description="Comma-separated list of task IDs to check status for"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get status of multiple processing tasks.
    """
    task_id_list = [int(id.strip()) for id in task_ids.split(",")]
    
    kb = db.query(KnowledgeBase).filter(
        KnowledgeBase.id == kb_id,
        KnowledgeBase.user_id == current_user.id
    ).first()
    
    if not kb:
        raise HTTPException(status_code=404, detail="Knowledge base not found")
        
    tasks = (
        db.query(ProcessingTask)
        .options(
            selectinload(ProcessingTask.document_upload)
        )
        .filter(
            ProcessingTask.id.in_(task_id_list),
            ProcessingTask.knowledge_base_id == kb_id
        )
        .all()
    )
    
    return {
        task.id: {
            "document_id": task.document_id,
            "status": task.status,
            "error_message": task.error_message,
            "upload_id": task.document_upload_id,
            "file_name": task.document_upload.file_name if task.document_upload else None
        }
        for task in tasks
    }

@router.get("/{kb_id}/inspector")
async def inspect_knowledge_base(
    *,
    db: Session = Depends(get_db),
    kb_id: int,
    current_user: User = Depends(get_current_user)
) -> Any:
    """
    Return indexing diagnostics for a knowledge base.
    """
    kb = (
        db.query(KnowledgeBase)
        .filter(
            KnowledgeBase.id == kb_id,
            KnowledgeBase.user_id == current_user.id
        )
        .first()
    )

    if not kb:
        raise HTTPException(status_code=404, detail="Knowledge base not found")

    documents = (
        db.query(Document)
        .filter(Document.knowledge_base_id == kb_id)
        .order_by(Document.created_at.desc())
        .all()
    )
    document_ids = [document.id for document in documents]

    chunk_counts = {
        document_id: count
        for document_id, count in db.query(
            DocumentChunk.document_id,
            func.count(DocumentChunk.id),
        )
        .filter(DocumentChunk.kb_id == kb_id)
        .group_by(DocumentChunk.document_id)
        .all()
    }

    latest_tasks: dict[int, ProcessingTask] = {}
    if document_ids:
        tasks = (
            db.query(ProcessingTask)
            .filter(
                ProcessingTask.knowledge_base_id == kb_id,
                ProcessingTask.document_id.in_(document_ids),
            )
            .order_by(ProcessingTask.updated_at.desc(), ProcessingTask.created_at.desc())
            .all()
        )
        for task in tasks:
            if task.document_id and task.document_id not in latest_tasks:
                latest_tasks[task.document_id] = task

    failed_uploads = (
        db.query(DocumentUpload)
        .filter(
            DocumentUpload.knowledge_base_id == kb_id,
            DocumentUpload.status == "failed",
        )
        .order_by(DocumentUpload.created_at.desc())
        .limit(20)
        .all()
    )

    pending_uploads = (
        db.query(DocumentUpload)
        .filter(
            DocumentUpload.knowledge_base_id == kb_id,
            DocumentUpload.status.in_(["pending", "processing"]),
        )
        .order_by(DocumentUpload.created_at.desc())
        .limit(20)
        .all()
    )

    vector_count = None
    vector_error = None
    try:
        embeddings = EmbeddingsFactory.create()
        vector_store = VectorStoreFactory.create(
            store_type=settings.VECTOR_STORE_TYPE,
            collection_name=f"kb_{kb_id}",
            embedding_function=embeddings,
        )
        collection = getattr(getattr(vector_store, "_store", None), "_collection", None)
        if collection is not None and hasattr(collection, "count"):
            vector_count = int(collection.count())
    except Exception as exc:
        vector_error = str(exc)
        logger.warning("Could not inspect vector count for KB %s: %s", kb_id, exc)

    inspected_documents = []
    failed_documents = []
    for document in documents:
        latest_task = latest_tasks.get(document.id)
        chunks_count = int(chunk_counts.get(document.id, 0))
        status = latest_task.status if latest_task else (
            "completed" if chunks_count > 0 else "missing_index"
        )
        error_message = latest_task.error_message if latest_task else None
        if chunks_count == 0 and status == "completed":
            status = "missing_index"
        if chunks_count == 0 and not error_message:
            error_message = "No chunks found for this document"

        item = {
            "id": document.id,
            "file_name": document.file_name,
            "file_size": document.file_size,
            "content_type": document.content_type,
            "created_at": document.created_at,
            "status": status,
            "chunks_count": chunks_count,
            "indexed": chunks_count > 0 and status == "completed",
            "error_message": error_message,
        }
        inspected_documents.append(item)
        if status in {"failed", "missing_index"} or chunks_count == 0:
            failed_documents.append(item)

    failed_upload_items = [
        {
            "id": upload.id,
            "file_name": upload.file_name,
            "file_size": upload.file_size,
            "content_type": upload.content_type,
            "created_at": upload.created_at,
            "status": upload.status,
            "error_message": upload.error_message,
        }
        for upload in failed_uploads
    ]

    pending_upload_items = [
        {
            "id": upload.id,
            "file_name": upload.file_name,
            "file_size": upload.file_size,
            "content_type": upload.content_type,
            "created_at": upload.created_at,
            "status": upload.status,
            "error_message": upload.error_message,
        }
        for upload in pending_uploads
    ]

    return {
        "knowledge_base_id": kb.id,
        "knowledge_base_name": kb.name,
        "documents_count": len(documents),
        "chunks_count": int(sum(chunk_counts.values())),
        "vector_count": vector_count,
        "vector_error": vector_error,
        "failed_count": len(failed_documents) + len(failed_upload_items),
        "documents": inspected_documents,
        "failed_documents": failed_documents,
        "failed_uploads": failed_upload_items,
        "pending_uploads": pending_upload_items,
    }


@router.post("/{kb_id}/reindex")
async def reindex_knowledge_base(
    *,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    kb_id: int,
    current_user: User = Depends(get_current_user)
) -> Any:
    """
    Rebuild all chunk records and vector embeddings for a knowledge base.
    """
    kb = (
        db.query(KnowledgeBase)
        .filter(
            KnowledgeBase.id == kb_id,
            KnowledgeBase.user_id == current_user.id
        )
        .first()
    )

    if not kb:
        raise HTTPException(status_code=404, detail="Knowledge base not found")

    documents = (
        db.query(Document)
        .filter(Document.knowledge_base_id == kb_id)
        .order_by(Document.created_at.asc())
        .all()
    )
    if not documents:
        raise HTTPException(status_code=400, detail="No documents to reindex")

    tasks = [
        ProcessingTask(
            knowledge_base_id=kb_id,
            document_id=document.id,
            status="pending",
        )
        for document in documents
    ]
    db.add_all(tasks)
    db.commit()
    for task in tasks:
        db.refresh(task)

    task_ids = [task.id for task in tasks]
    background_tasks.add_task(
        reindex_knowledge_base_background,
        kb_id,
        task_ids,
    )

    return {
        "message": "Reindexing started",
        "task_ids": task_ids,
        "documents_count": len(documents),
    }

@router.get("/{kb_id}/documents/{doc_id}", response_model=DocumentResponse)
async def get_document(
    *,
    db: Session = Depends(get_db),
    kb_id: int,
    doc_id: int,
    current_user: User = Depends(get_current_user)
) -> Any:
    """
    Get document details by ID.
    """
    document = (
        db.query(Document)
        .join(KnowledgeBase)
        .filter(
            Document.id == doc_id,
            Document.knowledge_base_id == kb_id,
            KnowledgeBase.user_id == current_user.id
        )
        .first()
    )

    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    return document

@router.get("/{kb_id}/documents/{doc_id}/download")
async def download_document(
    *,
    db: Session = Depends(get_db),
    kb_id: int,
    doc_id: int,
    current_user: User = Depends(get_current_user)
) -> StreamingResponse:
    """
    Download original document file from MinIO.
    """
    document = (
        db.query(Document)
        .join(KnowledgeBase)
        .filter(
            Document.id == doc_id,
            Document.knowledge_base_id == kb_id,
            KnowledgeBase.user_id == current_user.id
        )
        .first()
    )

    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    minio_client = get_minio_client()
    try:
        response = minio_client.get_object(
            bucket_name=settings.MINIO_BUCKET_NAME,
            object_name=document.file_path,
        )
    except MinioException as e:
        logger.error(f"Failed to download document {doc_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to download document")

    def iter_file():
        try:
            for chunk in response.stream(32 * 1024):
                yield chunk
        finally:
            response.close()
            response.release_conn()

    fallback_name = "".join(
        char if 32 <= ord(char) < 127 and char not in {'"', "\\"} else "_"
        for char in document.file_name
    ) or "document"

    return StreamingResponse(
        iter_file(),
        media_type=document.content_type or "application/octet-stream",
        headers={
            "Content-Disposition": (
                f'attachment; filename="{fallback_name}"; '
                f"filename*=UTF-8''{quote(document.file_name)}"
            )
        },
    )

@router.delete("/{kb_id}/documents/{doc_id}")
async def delete_document(
    *,
    db: Session = Depends(get_db),
    kb_id: int,
    doc_id: int,
    current_user: User = Depends(get_current_user)
) -> Any:
    """
    Delete a single document, its chunks, processing tasks, vector records and original file.
    """
    document = (
        db.query(Document)
        .join(KnowledgeBase)
        .filter(
            Document.id == doc_id,
            Document.knowledge_base_id == kb_id,
            KnowledgeBase.user_id == current_user.id
        )
        .first()
    )

    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    chunk_ids = [
        row[0]
        for row in db.query(DocumentChunk.id)
        .filter(DocumentChunk.document_id == doc_id)
        .all()
    ]

    try:
        if chunk_ids:
            embeddings = EmbeddingsFactory.create()
            vector_store = VectorStoreFactory.create(
                store_type=settings.VECTOR_STORE_TYPE,
                collection_name=f"kb_{kb_id}",
                embedding_function=embeddings,
            )
            vector_store.delete(chunk_ids)
    except Exception as e:
        logger.error(f"Failed to delete vectors for document {doc_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to delete document vectors")

    original_file_path = document.file_path
    cleanup_warnings = []

    try:
        db.query(ProcessingTask).filter(
            ProcessingTask.document_id == doc_id
        ).delete(synchronize_session=False)
        db.query(DocumentChunk).filter(
            DocumentChunk.document_id == doc_id
        ).delete(synchronize_session=False)
        db.delete(document)
        db.commit()
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to delete document {doc_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to delete document")

    try:
        minio_client = get_minio_client()
        minio_client.remove_object(
            bucket_name=settings.MINIO_BUCKET_NAME,
            object_name=original_file_path,
        )
    except MinioException as e:
        warning = f"Failed to delete original file from storage: {str(e)}"
        cleanup_warnings.append(warning)
        logger.warning(f"{warning} (document {doc_id})")

    return {
        "message": "Document deleted successfully",
        "warnings": cleanup_warnings,
    }

@router.post("/test-retrieval")
async def test_retrieval(
    request: TestRetrievalRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    """
    Test retrieval quality for a given query against a knowledge base.
    """
    try:
        kb = db.query(KnowledgeBase).filter(
            KnowledgeBase.id == request.kb_id,
            KnowledgeBase.user_id == current_user.id
        ).first()
        
        if not kb:
            raise HTTPException(
                status_code=404,
                detail=f"Knowledge base {request.kb_id} not found",
            )
        
        embeddings = EmbeddingsFactory.create()
        
        vector_store = VectorStoreFactory.create(
            store_type=settings.VECTOR_STORE_TYPE,
            collection_name=f"kb_{request.kb_id}",
            embedding_function=embeddings,
        )
        
        results = vector_store.similarity_search_with_score(request.query, k=request.top_k)
        
        response = []
        for doc, score in results:
            response.append({
                "content": doc.page_content,
                "metadata": doc.metadata,
                "score": float(score)
            })
            
        return {"results": response}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
