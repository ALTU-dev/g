import logging
import os
import hashlib
import tempfile
import traceback
import time
from datetime import datetime
from app.db.session import SessionLocal
from io import BytesIO
from typing import Optional, List, Dict, Set
from fastapi import UploadFile
from langchain_community.document_loaders import (
    PyPDFLoader,
    Docx2txtLoader,
    UnstructuredMarkdownLoader,
    TextLoader
)
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_core.documents import Document as LangchainDocument
from pydantic import BaseModel
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session
from app.core.config import settings
from app.core.minio import get_minio_client
from app.models.knowledge import ProcessingTask, Document, DocumentChunk
from app.services.chunk_record import ChunkRecord
import uuid
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_community.document_loaders import UnstructuredFileLoader
from minio.error import MinioException
from minio import Minio
from minio.commonconfig import CopySource
from app.services.vector_store import VectorStoreFactory
from app.services.embedding.embedding_factory import EmbeddingsFactory

SUPPORTED_TEXT_EXTENSIONS = {".pdf", ".docx", ".md", ".txt"}
SUPPORTED_IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".bmp", ".tif", ".tiff"}
SUPPORTED_EXTENSIONS = SUPPORTED_TEXT_EXTENSIONS | SUPPORTED_IMAGE_EXTENSIONS
IMAGE_CONTENT_TYPES = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".bmp": "image/bmp",
    ".tif": "image/tiff",
    ".tiff": "image/tiff",
}
DOCUMENT_CONTENT_TYPES = {
    ".pdf": "application/pdf",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".md": "text/markdown",
    ".txt": "text/plain",
}
CONTENT_TYPES = {**DOCUMENT_CONTENT_TYPES, **IMAGE_CONTENT_TYPES}
EMBEDDING_BATCH_SIZE = int(os.getenv("DOCUMENT_EMBED_BATCH_SIZE", "16"))
EMBEDDING_BATCH_RETRIES = int(os.getenv("DOCUMENT_EMBED_BATCH_RETRIES", "4"))
EMBEDDING_RETRY_BASE_SECONDS = float(os.getenv("DOCUMENT_EMBED_RETRY_BASE_SECONDS", "1.5"))
PREVIEW_CHUNK_LIMIT = int(os.getenv("DOCUMENT_PREVIEW_CHUNK_LIMIT", "20"))
DEFAULT_CHUNK_SIZE = int(os.getenv("DOCUMENT_CHUNK_SIZE", "1600"))
DEFAULT_CHUNK_OVERLAP = int(os.getenv("DOCUMENT_CHUNK_OVERLAP", "250"))
OCR_LANGUAGES = os.getenv("OCR_LANGUAGES", "kaz+rus+eng")

class UploadResult(BaseModel):
    file_path: str
    file_name: str
    file_size: int
    content_type: str
    file_hash: str

class TextChunk(BaseModel):
    content: str
    metadata: Optional[Dict] = None

class PreviewResult(BaseModel):
    chunks: List[TextChunk]
    total_chunks: int

def normalize_filename(filename: str, max_length: int = 240) -> str:
    """Keep the display filename readable but safe for DB/object metadata."""
    base_name = os.path.basename(filename or "document").replace("\\", "_").replace("/", "_").strip()
    if not base_name:
        base_name = "document"

    name, ext = os.path.splitext(base_name)
    ext = ext.lower()
    if len(base_name) <= max_length:
        return base_name

    hash_suffix = hashlib.sha1(base_name.encode("utf-8")).hexdigest()[:8]
    keep = max(1, max_length - len(ext) - len(hash_suffix) - 1)
    return f"{name[:keep]}_{hash_suffix}{ext}"

def get_supported_content_type(file_name: str, fallback: Optional[str] = None) -> str:
    _, ext = os.path.splitext(file_name)
    return CONTENT_TYPES.get(ext.lower(), fallback or "application/octet-stream")

def ensure_supported_file(file_name: str) -> None:
    _, ext = os.path.splitext(file_name)
    if ext.lower() not in SUPPORTED_EXTENSIONS:
        raise ValueError(
            "Unsupported file type. Supported: PDF, DOCX, TXT, MD, PNG, JPG, JPEG, WEBP, BMP, TIFF."
        )

def build_temp_object_path(kb_id: int, file_hash: str, file_name: str) -> str:
    _, ext = os.path.splitext(file_name)
    return f"kb_{kb_id}/temp/{file_hash[:16]}_{uuid.uuid4().hex}{ext.lower()}"

def build_permanent_object_path(kb_id: int, upload_id: int, file_hash: str, file_name: str) -> str:
    _, ext = os.path.splitext(file_name)
    return f"kb_{kb_id}/{file_hash[:16]}_{upload_id}{ext.lower()}"

def _load_docx_with_python_docx(local_path: str, file_name: str) -> List[LangchainDocument]:
    from docx import Document as DocxDocument

    docx = DocxDocument(local_path)
    parts = [paragraph.text for paragraph in docx.paragraphs if paragraph.text.strip()]
    for table in docx.tables:
        for row in table.rows:
            cells = [cell.text.strip() for cell in row.cells if cell.text.strip()]
            if cells:
                parts.append(" | ".join(cells))

    text = "\n".join(parts).strip()
    if not text:
        raise ValueError("DOCX file does not contain extractable text")

    return [LangchainDocument(page_content=text, metadata={"source": file_name})]

def _load_image_with_ocr(local_path: str, file_name: str) -> List[LangchainDocument]:
    try:
        from PIL import Image
        import pytesseract
    except ImportError as exc:
        raise ValueError(
            "Image OCR dependencies are not installed. Rebuild the backend image to enable image text extraction."
        ) from exc

    with Image.open(local_path) as image:
        try:
            text = pytesseract.image_to_string(image, lang=OCR_LANGUAGES)
        except Exception:
            text = pytesseract.image_to_string(image)

    text = text.strip()
    if not text:
        text = f"Image file '{file_name}' was uploaded, but no readable text was detected."

    return [LangchainDocument(page_content=text, metadata={"source": file_name, "content_type": "image"})]

def load_documents_from_file(local_path: str, file_name: str) -> List[LangchainDocument]:
    _, ext = os.path.splitext(file_name)
    ext = ext.lower()
    ensure_supported_file(file_name)

    if ext == ".pdf":
        loader = PyPDFLoader(local_path)
        documents = loader.load()
    elif ext == ".docx":
        try:
            documents = _load_docx_with_python_docx(local_path, file_name)
        except Exception:
            documents = Docx2txtLoader(local_path).load()
    elif ext == ".md":
        try:
            documents = UnstructuredMarkdownLoader(local_path).load()
        except Exception:
            documents = TextLoader(local_path, encoding="utf-8", autodetect_encoding=True).load()
    elif ext == ".txt":
        documents = TextLoader(local_path, encoding="utf-8", autodetect_encoding=True).load()
    elif ext in SUPPORTED_IMAGE_EXTENSIONS:
        documents = _load_image_with_ocr(local_path, file_name)
    else:
        raise ValueError(f"Unsupported file type: {ext}")

    for doc in documents:
        doc.metadata = {**(doc.metadata or {}), "source": file_name}

    if not any(doc.page_content.strip() for doc in documents):
        raise ValueError("Document does not contain extractable text")

    return documents

def add_document_batch_with_retries(
    vector_store,
    batch: List[LangchainDocument],
    logger: logging.Logger,
    ids: Optional[List[str]] = None,
) -> None:
    if not batch:
        return

    last_error: Optional[Exception] = None
    for attempt in range(1, EMBEDDING_BATCH_RETRIES + 1):
        try:
            vector_store.add_documents(batch, ids=ids)
            return
        except Exception as exc:
            last_error = exc
            if attempt >= EMBEDDING_BATCH_RETRIES:
                break

            delay = min(
                EMBEDDING_RETRY_BASE_SECONDS * (2 ** (attempt - 1)),
                20,
            )
            logger.warning(
                "Embedding batch failed on attempt %s/%s for %s chunks. Retrying in %.1fs: %s",
                attempt,
                EMBEDDING_BATCH_RETRIES,
                len(batch),
                delay,
                exc,
            )
            time.sleep(delay)

    if len(batch) > 1:
        mid = max(1, len(batch) // 2)
        logger.warning(
            "Embedding batch of %s chunks still failed; splitting into %s and %s chunks.",
            len(batch),
            mid,
            len(batch) - mid,
        )
        add_document_batch_with_retries(
            vector_store,
            batch[:mid],
            logger,
            ids=ids[:mid] if ids else None,
        )
        add_document_batch_with_retries(
            vector_store,
            batch[mid:],
            logger,
            ids=ids[mid:] if ids else None,
        )
        return

    raise last_error or RuntimeError("Failed to add document batch to vector store")


def add_documents_to_vector_store_in_batches(vector_store, documents: List[LangchainDocument]) -> None:
    logger = logging.getLogger(__name__)
    for start in range(0, len(documents), EMBEDDING_BATCH_SIZE):
        batch = documents[start:start + EMBEDDING_BATCH_SIZE]
        batch_ids = [
            str(document.metadata.get("chunk_id"))
            for document in batch
            if document.metadata and document.metadata.get("chunk_id")
        ]
        logger.info(
            "Adding embedding batch %s-%s of %s chunks",
            start + 1,
            min(start + len(batch), len(documents)),
            len(documents),
        )
        add_document_batch_with_retries(
            vector_store,
            batch,
            logger,
            ids=batch_ids if len(batch_ids) == len(batch) else None,
        )

async def process_document(
    file_path: str,
    file_name: str,
    kb_id: int,
    document_id: int,
    chunk_size: int = DEFAULT_CHUNK_SIZE,
    chunk_overlap: int = DEFAULT_CHUNK_OVERLAP,
) -> None:
    """Process document and store in vector database with incremental updates"""
    logger = logging.getLogger(__name__)
    
    try:
        preview_result = await preview_document(file_path, chunk_size, chunk_overlap)
        
        # Initialize embeddings
        logger.info("Initializing OpenAI embeddings...")
        embeddings = EmbeddingsFactory.create()
        
        logger.info(f"Initializing vector store with collection: kb_{kb_id}")
        vector_store = VectorStoreFactory.create(
            store_type=settings.VECTOR_STORE_TYPE,
            collection_name=f"kb_{kb_id}",
            embedding_function=embeddings,
        )
        
        # Initialize chunk record manager
        chunk_manager = ChunkRecord(kb_id)
        
        # Get existing chunk hashes for this file
        existing_hashes = chunk_manager.list_chunks(file_name)
        
        # Prepare new chunks
        new_chunks = []
        current_hashes = set()
        documents_to_update = []
        
        for chunk in preview_result.chunks:
            # Calculate chunk hash
            chunk_hash = hashlib.sha256(
                (chunk.content + str(chunk.metadata)).encode()
            ).hexdigest()
            current_hashes.add(chunk_hash)
            
            # Skip if chunk hasn't changed
            if chunk_hash in existing_hashes:
                continue
            
            # Create unique ID for the chunk
            chunk_id = _build_chunk_id(
                kb_id,
                document_id,
                file_name,
                len(new_chunks),
                chunk.content,
            )
            
            # Prepare chunk record
            # Prepare metadata
            metadata = {
                **chunk.metadata,
                "chunk_id": chunk_id,
                "file_name": file_name,
                "kb_id": kb_id,
                "document_id": document_id
            }
            
            new_chunks.append({
                "id": chunk_id,
                "kb_id": kb_id,
                "document_id": document_id,
                "file_name": file_name,
                "metadata": metadata,
                "hash": chunk_hash
            })
            
            # Prepare document for vector store
            doc = LangchainDocument(
                page_content=chunk.content,
                metadata=metadata
            )
            documents_to_update.append(doc)
        
        # Add new chunks to database and vector store
        if new_chunks:
            logger.info(f"Adding {len(new_chunks)} new/updated chunks")
            chunk_manager.add_chunks(new_chunks)
            add_documents_to_vector_store_in_batches(vector_store, documents_to_update)
        
        # Delete removed chunks
        chunks_to_delete = chunk_manager.get_deleted_chunks(current_hashes, file_name)
        if chunks_to_delete:
            logger.info(f"Removing {len(chunks_to_delete)} deleted chunks")
            chunk_manager.delete_chunks(chunks_to_delete)
            vector_store.delete(chunks_to_delete)
        
        logger.info("Document processing completed successfully")
        
    except Exception as e:
        logger.error(f"Error processing document: {str(e)}")
        raise

async def upload_document(file: UploadFile, kb_id: int) -> UploadResult:
    """Step 1: Upload document to MinIO"""
    content = await file.read()
    file_size = len(content)
    
    file_hash = hashlib.sha256(content).hexdigest()
    
    file_name = normalize_filename(file.filename)
    ensure_supported_file(file_name)
    object_path = build_temp_object_path(kb_id, file_hash, file_name)
    content_type = get_supported_content_type(file_name, file.content_type)
    
    # Upload to MinIO
    minio_client = get_minio_client()
    try:
        minio_client.put_object(
            bucket_name=settings.MINIO_BUCKET_NAME,
            object_name=object_path,
            data=BytesIO(content),
            length=file_size,
            content_type=content_type
        )
    except Exception as e:
        logging.error(f"Failed to upload file to MinIO: {str(e)}")
        raise
        
    return UploadResult(
        file_path=object_path,
        file_name=file_name,
        file_size=file_size,
        content_type=content_type,
        file_hash=file_hash
    )

async def preview_document(
    file_path: str,
    chunk_size: int = DEFAULT_CHUNK_SIZE,
    chunk_overlap: int = DEFAULT_CHUNK_OVERLAP,
) -> PreviewResult:
    """Step 2: Generate preview chunks"""
    # Get file from MinIO
    minio_client = get_minio_client()
    _, ext = os.path.splitext(file_path)
    ext = ext.lower()
    
    # Download to temp file
    with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as temp_file:
        minio_client.fget_object(
            bucket_name=settings.MINIO_BUCKET_NAME,
            object_name=file_path,
            file_path=temp_file.name
        )
        temp_path = temp_file.name
    
    try:
        documents = load_documents_from_file(temp_path, os.path.basename(file_path))
        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap
        )
        chunks = text_splitter.split_documents(documents)
        
        # Convert only the first chunks to preview format. Processing still uses all chunks.
        # Returning hundreds/thousands of chunks to the browser makes larger files feel stuck.
        preview_chunks = [
            TextChunk(
                content=chunk.page_content,
                metadata=chunk.metadata
            )
            for chunk in chunks[:PREVIEW_CHUNK_LIMIT]
        ]
        
        return PreviewResult(
            chunks=preview_chunks,
            total_chunks=len(chunks)
        )
    finally:
        os.unlink(temp_path)

def process_document_background(
    temp_path: str,
    file_name: str,
    kb_id: int,
    task_id: int,
    db: Session = None,
    chunk_size: int = DEFAULT_CHUNK_SIZE,
    chunk_overlap: int = DEFAULT_CHUNK_OVERLAP
) -> None:
    """Process document in background"""
    logger = logging.getLogger(__name__)
    logger.info(f"Starting background processing for task {task_id}, file: {file_name}")

    # if we don't pass in db, create a new database session
    if db is None:
        db = SessionLocal()
        should_close_db = True
    else:
        should_close_db = False
    
    task = db.query(ProcessingTask).get(task_id)
    if not task:
        logger.error(f"Task {task_id} not found")
        return
    
    try:
        logger.info(f"Task {task_id}: Setting status to processing")
        task.status = "processing"
        db.commit()
        
        # 1. 从临时目录下载文件
        minio_client = get_minio_client()
        try:
            _, ext = os.path.splitext(file_name)
            temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=ext.lower())
            local_temp_path = temp_file.name
            temp_file.close()
            logger.info(f"Task {task_id}: Downloading file from MinIO: {temp_path} to {local_temp_path}")
            minio_client.fget_object(
                bucket_name=settings.MINIO_BUCKET_NAME,
                object_name=temp_path,
                file_path=local_temp_path
            )
            logger.info(f"Task {task_id}: File downloaded successfully")
        except MinioException as e:
            error_msg = f"Failed to download temp file: {str(e)}"
            logger.error(f"Task {task_id}: {error_msg}")
            raise Exception(error_msg)
        
        try:
            # 2. 加载和分块文档
            _, ext = os.path.splitext(file_name)
            ext = ext.lower()
            
            logger.info(f"Task {task_id}: Loading document with extension {ext}")
            logger.info(f"Task {task_id}: Loading document content")
            documents = load_documents_from_file(local_temp_path, file_name)
            logger.info(f"Task {task_id}: Document loaded successfully")
            
            logger.info(f"Task {task_id}: Splitting document into chunks")
            text_splitter = RecursiveCharacterTextSplitter(
                chunk_size=chunk_size,
                chunk_overlap=chunk_overlap
            )
            chunks = text_splitter.split_documents(documents)
            logger.info(f"Task {task_id}: Document split into {len(chunks)} chunks")
            
            # 3. 创建向量存储
            logger.info(f"Task {task_id}: Initializing vector store")
            embeddings = EmbeddingsFactory.create()
            
            vector_store = VectorStoreFactory.create(
                store_type=settings.VECTOR_STORE_TYPE,
                collection_name=f"kb_{kb_id}",
                embedding_function=embeddings,
            )
            
            # 4. 将临时文件移动到永久目录
            permanent_path = build_permanent_object_path(
                kb_id,
                task.document_upload_id or task_id,
                task.document_upload.file_hash,
                file_name
            )
            try:
                logger.info(f"Task {task_id}: Moving file to permanent storage")
                # 复制到永久目录
                source = CopySource(settings.MINIO_BUCKET_NAME, temp_path)
                minio_client.copy_object(
                    bucket_name=settings.MINIO_BUCKET_NAME,
                    object_name=permanent_path,
                    source=source
                )
                logger.info(f"Task {task_id}: File moved to permanent storage")
                
                # 删除临时文件
                logger.info(f"Task {task_id}: Removing temporary file from MinIO")
                minio_client.remove_object(
                    bucket_name=settings.MINIO_BUCKET_NAME,
                    object_name=temp_path
                )
                logger.info(f"Task {task_id}: Temporary file removed")
            except MinioException as e:
                error_msg = f"Failed to move file to permanent storage: {str(e)}"
                logger.error(f"Task {task_id}: {error_msg}")
                raise Exception(error_msg)
            
            # 5. 创建文档记录
            logger.info(f"Task {task_id}: Creating document record")
            document_file_name = file_name
            existing_name = db.query(Document).filter(
                Document.knowledge_base_id == kb_id,
                Document.file_name == document_file_name
            ).first()
            if existing_name:
                base, ext = os.path.splitext(document_file_name)
                document_file_name = normalize_filename(
                    f"{base}_{task.document_upload.file_hash[:8]}{ext}"
                )

            document = Document(
                file_name=document_file_name,
                file_path=permanent_path,
                file_hash=task.document_upload.file_hash,
                file_size=task.document_upload.file_size,
                content_type=task.document_upload.content_type,
                knowledge_base_id=kb_id
            )
            db.add(document)
            db.commit()
            db.refresh(document)
            logger.info(f"Task {task_id}: Document record created with ID {document.id}")
            
            # 6. 存储文档块
            logger.info(f"Task {task_id}: Storing document chunks")
            for i, chunk in enumerate(chunks):
                # 为每个 chunk 生成唯一的 ID
                chunk_id = _build_chunk_id(
                    kb_id,
                    document.id,
                    document_file_name,
                    i,
                    chunk.page_content,
                )

                chunk.metadata["source"] = document_file_name
                chunk.metadata["kb_id"] = kb_id
                chunk.metadata["document_id"] = document.id
                chunk.metadata["chunk_id"] = chunk_id
                
                doc_chunk = DocumentChunk(
                    id=chunk_id,  # 添加 ID 字段
                    document_id=document.id,
                    kb_id=kb_id,
                    file_name=document_file_name,
                    chunk_metadata={
                        "page_content": chunk.page_content,
                        **chunk.metadata
                    },
                    hash=hashlib.sha256(
                        (chunk.page_content + str(chunk.metadata)).encode()
                    ).hexdigest()
                )
                db.add(doc_chunk)
                if i > 0 and i % 100 == 0:
                    logger.info(f"Task {task_id}: Stored {i} chunks")
                    db.commit()  # 每 100 条提交一次，避免事务太大
            
            # 7. 添加到向量存储
            logger.info(f"Task {task_id}: Adding chunks to vector store")
            add_documents_to_vector_store_in_batches(vector_store, chunks)
            # 移除 persist() 调用，因为新版本不需要
            logger.info(f"Task {task_id}: Chunks added to vector store")
            
            # 8. 更新任务状态
            logger.info(f"Task {task_id}: Updating task status to completed")
            task.status = "completed"
            task.document_id = document.id  # 更新为新创建的文档ID
            
            # 9. 更新上传记录状态
            upload = task.document_upload  # 直接通过关系获取
            if upload:
                logger.info(f"Task {task_id}: Updating upload record status to completed")
                upload.status = "completed"
            
            db.commit()
            logger.info(f"Task {task_id}: Processing completed successfully")
            
        finally:
            # 清理本地临时文件
            try:
                if os.path.exists(local_temp_path):
                    logger.info(f"Task {task_id}: Cleaning up local temp file")
                    os.remove(local_temp_path)
                    logger.info(f"Task {task_id}: Local temp file cleaned up")
            except Exception as e:
                logger.warning(f"Task {task_id}: Failed to clean up local temp file: {str(e)}")
        
    except Exception as e:
        logger.error(f"Task {task_id}: Error processing document: {str(e)}")
        logger.error(f"Task {task_id}: Stack trace: {traceback.format_exc()}")
        task.status = "failed"
        task.error_message = str(e)
        upload = task.document_upload
        if upload:
            upload.status = "failed"
            upload.error_message = str(e)
        db.commit()
        
        # 清理临时文件
        try:
            logger.info(f"Task {task_id}: Cleaning up temporary file after error")
            minio_client.remove_object(
                bucket_name=settings.MINIO_BUCKET_NAME,
                object_name=temp_path
            )
            logger.info(f"Task {task_id}: Temporary file cleaned up after error")
        except:
            logger.warning(f"Task {task_id}: Failed to clean up temporary file after error")
    finally:
        # if we create the db session, we need to close it
        if should_close_db and db:
            db.close()


def _build_chunk_id(kb_id: int, document_id: int, file_name: str, index: int, content: str) -> str:
    return hashlib.sha256(
        f"{kb_id}:{document_id}:{file_name}:{index}:{content}".encode("utf-8")
    ).hexdigest()


def reindex_knowledge_base_background(
    kb_id: int,
    task_ids: Optional[List[int]] = None,
    chunk_size: int = DEFAULT_CHUNK_SIZE,
    chunk_overlap: int = DEFAULT_CHUNK_OVERLAP,
) -> None:
    """Rebuild DB chunk records and vector collection for every document in a KB."""
    logger = logging.getLogger(__name__)
    db = SessionLocal()

    try:
        tasks_by_document_id: Dict[int, ProcessingTask] = {}
        if task_ids:
            tasks = db.query(ProcessingTask).filter(
                ProcessingTask.id.in_(task_ids),
                ProcessingTask.knowledge_base_id == kb_id,
            ).all()
            for task in tasks:
                task.status = "processing"
                task.error_message = None
                if task.document_id:
                    tasks_by_document_id[task.document_id] = task
            db.commit()

        documents = (
            db.query(Document)
            .filter(Document.knowledge_base_id == kb_id)
            .order_by(Document.created_at.asc())
            .all()
        )

        if not documents:
            logger.info("No documents to reindex for knowledge base %s", kb_id)
            return

        embeddings = EmbeddingsFactory.create()
        collection_name = f"kb_{kb_id}"

        try:
            old_vector_store = VectorStoreFactory.create(
                store_type=settings.VECTOR_STORE_TYPE,
                collection_name=collection_name,
                embedding_function=embeddings,
            )
            old_vector_store.delete_collection()
            logger.info("Deleted vector collection before reindex: %s", collection_name)
        except Exception as exc:
            logger.warning(
                "Could not delete vector collection %s before reindex: %s",
                collection_name,
                exc,
            )

        vector_store = VectorStoreFactory.create(
            store_type=settings.VECTOR_STORE_TYPE,
            collection_name=collection_name,
            embedding_function=embeddings,
        )

        db.query(DocumentChunk).filter(DocumentChunk.kb_id == kb_id).delete(
            synchronize_session=False
        )
        db.commit()

        minio_client = get_minio_client()

        for document in documents:
            task = tasks_by_document_id.get(document.id)
            local_temp_path = None

            try:
                _, ext = os.path.splitext(document.file_name)
                temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=ext.lower())
                local_temp_path = temp_file.name
                temp_file.close()

                minio_client.fget_object(
                    bucket_name=settings.MINIO_BUCKET_NAME,
                    object_name=document.file_path,
                    file_path=local_temp_path,
                )

                loaded_documents = load_documents_from_file(
                    local_temp_path,
                    document.file_name,
                )
                text_splitter = RecursiveCharacterTextSplitter(
                    chunk_size=chunk_size,
                    chunk_overlap=chunk_overlap,
                )
                chunks = text_splitter.split_documents(loaded_documents)
                vector_documents: List[LangchainDocument] = []

                for index, chunk in enumerate(chunks):
                    chunk_id = _build_chunk_id(
                        kb_id,
                        document.id,
                        document.file_name,
                        index,
                        chunk.page_content,
                    )
                    chunk_hash = hashlib.sha256(
                        (chunk.page_content + str(chunk.metadata)).encode("utf-8")
                    ).hexdigest()

                    chunk.metadata["source"] = document.file_name
                    chunk.metadata["kb_id"] = kb_id
                    chunk.metadata["document_id"] = document.id
                    chunk.metadata["chunk_id"] = chunk_id

                    db.add(
                        DocumentChunk(
                            id=chunk_id,
                            document_id=document.id,
                            kb_id=kb_id,
                            file_name=document.file_name,
                            chunk_metadata={
                                "page_content": chunk.page_content,
                                **chunk.metadata,
                            },
                            hash=chunk_hash,
                        )
                    )
                    vector_documents.append(chunk)

                    if index > 0 and index % 100 == 0:
                        db.commit()

                if vector_documents:
                    add_documents_to_vector_store_in_batches(vector_store, vector_documents)

                if task:
                    task.status = "completed"
                    task.error_message = None

                db.commit()
                logger.info(
                    "Reindexed document %s (%s chunks) in KB %s",
                    document.id,
                    len(vector_documents),
                    kb_id,
                )
            except Exception as exc:
                db.rollback()
                if task:
                    task.status = "failed"
                    task.error_message = str(exc)
                    db.commit()
                logger.error(
                    "Failed to reindex document %s in KB %s: %s",
                    document.id,
                    kb_id,
                    exc,
                )
            finally:
                if local_temp_path and os.path.exists(local_temp_path):
                    try:
                        os.remove(local_temp_path)
                    except Exception as cleanup_exc:
                        logger.warning(
                            "Failed to remove reindex temp file %s: %s",
                            local_temp_path,
                            cleanup_exc,
                        )
    finally:
        db.close()
