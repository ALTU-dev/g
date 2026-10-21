import json
import base64
from collections import defaultdict
from typing import Any, List, AsyncGenerator
from sqlalchemy.orm import Session
from langchain_openai import ChatOpenAI
from langchain.chains import create_history_aware_retriever, create_retrieval_chain
from langchain.chains.combine_documents import create_stuff_documents_chain
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder, PromptTemplate
from langchain_core.messages import HumanMessage, AIMessage
from langchain_core.documents import Document as LangchainDocument
from langchain_core.runnables import RunnableLambda
from app.core.config import settings
from app.models.chat import Message
from app.models.knowledge import KnowledgeBase, Document, DocumentChunk
from langchain.globals import set_verbose, set_debug
from app.services.vector_store import VectorStoreFactory
from app.services.embedding.embedding_factory import EmbeddingsFactory
from app.services.llm.llm_factory import LLMFactory

set_verbose(True)
set_debug(True)


GENERIC_KB_QUERY_MARKERS = (
    "что там за документ",
    "какие документ",
    "список документ",
    "что загружено",
    "загруженные документ",
    "загруженных документ",
    "кратко перескажи",
    "перескажи загруж",
    "summarize uploaded",
    "uploaded documents",
    "what documents",
)


def _is_generic_knowledge_query(query: str) -> bool:
    lowered = query.lower()
    return any(marker in lowered for marker in GENERIC_KB_QUERY_MARKERS)


def _chunk_text(chunk: DocumentChunk) -> str:
    metadata = chunk.chunk_metadata or {}
    value = metadata.get("page_content", "")
    return value if isinstance(value, str) else str(value or "")


def _build_inventory_document(
    knowledge_bases: List[KnowledgeBase],
    documents: List[Document],
    chunk_counts: dict[int, int],
) -> LangchainDocument:
    kb_names = {kb.id: kb.name for kb in knowledge_bases}
    lines = ["В базе знаний доступны следующие документы:"]

    for index, document in enumerate(documents, start=1):
        kb_name = kb_names.get(document.knowledge_base_id, "Knowledge Base")
        chunks = chunk_counts.get(document.id, 0)
        size_mb = (document.file_size or 0) / (1024 * 1024)
        lines.append(
            f"{index}. {document.file_name} — база: {kb_name}; "
            f"размер: {size_mb:.2f} MB; фрагментов: {chunks}."
        )

    if len(documents) == 0:
        lines.append("Документы не найдены.")

    return LangchainDocument(
        page_content="\n".join(lines),
        metadata={
            "source": "knowledge_base_inventory",
            "content_type": "inventory",
        },
    )


def _load_db_context_documents(
    db: Session,
    knowledge_bases: List[KnowledgeBase],
    knowledge_base_ids: List[int],
    query: str,
    limit_documents: int = 20,
    chunks_per_document: int = 2,
) -> List[LangchainDocument]:
    documents = (
        db.query(Document)
        .filter(Document.knowledge_base_id.in_(knowledge_base_ids))
        .order_by(Document.created_at.desc())
        .all()
    )

    if not documents:
        return []

    document_ids = [document.id for document in documents]
    chunks = (
        db.query(DocumentChunk)
        .filter(DocumentChunk.document_id.in_(document_ids))
        .order_by(DocumentChunk.file_name.asc())
        .all()
    )

    chunk_counts: dict[int, int] = defaultdict(int)
    grouped_chunks: dict[int, list[DocumentChunk]] = defaultdict(list)
    for chunk in chunks:
        chunk_counts[chunk.document_id] += 1
        if len(grouped_chunks[chunk.document_id]) < chunks_per_document:
            grouped_chunks[chunk.document_id].append(chunk)

    context_docs: List[LangchainDocument] = [
        _build_inventory_document(
            knowledge_bases=knowledge_bases,
            documents=documents,
            chunk_counts=chunk_counts,
        )
    ]

    if not _is_generic_knowledge_query(query):
        return context_docs

    for document in documents[:limit_documents]:
        for chunk in grouped_chunks.get(document.id, []):
            text = _chunk_text(chunk).strip()
            if not text:
                continue
            context_docs.append(
                LangchainDocument(
                    page_content=text[:1800],
                    metadata={
                        "source": document.file_name,
                        "kb_id": document.knowledge_base_id,
                        "document_id": document.id,
                        "chunk_id": chunk.id,
                        "content_type": "database_chunk",
                    },
                )
            )

    return context_docs


def _dedupe_context_documents(documents: List[LangchainDocument], limit: int = 24) -> List[LangchainDocument]:
    seen: set[str] = set()
    unique: List[LangchainDocument] = []
    for document in documents:
        metadata = document.metadata or {}
        key = (
            str(metadata.get("chunk_id") or "")
            or f"{metadata.get('source', '')}:{document.page_content[:160]}"
        )
        if key in seen:
            continue
        seen.add(key)
        unique.append(document)
        if len(unique) >= limit:
            break
    return unique


def _retrieve_from_all_sources(
    query: str,
    vector_stores: list[Any],
    db_context_documents: List[LangchainDocument],
) -> List[LangchainDocument]:
    retrieved: List[LangchainDocument] = []

    # Keep inventory/database context first so general questions like
    # "what documents are loaded?" can always be answered.
    retrieved.extend(db_context_documents)

    for vector_store in vector_stores:
        try:
            retrieved.extend(vector_store.similarity_search(query, k=6))
        except Exception as exc:
            print(f"Vector retrieval failed for one collection: {exc}")

    return _dedupe_context_documents(retrieved)

async def generate_response(
    query: str,
    messages: dict,
    knowledge_base_ids: List[int],
    chat_id: int,
    db: Session,
    current_user_id: int | None = None,
    strict_sources: bool = False,
    document_wizard: bool = False,
    document_template: str | None = None,
) -> AsyncGenerator[str, None]:
    try:
        # Create user message
        user_message = Message(
            content=query,
            role="user",
            chat_id=chat_id
        )
        db.add(user_message)
        db.commit()
        
        # Create bot message placeholder
        bot_message = Message(
            content="",
            role="assistant",
            chat_id=chat_id
        )
        db.add(bot_message)
        db.commit()
        
        # Get knowledge bases and their documents. In the local workspace UX the
        # user usually expects "all uploaded documents" to be available in chat,
        # so include every KB with documents for the current user as a safety net.
        knowledge_base_query = db.query(KnowledgeBase)
        if current_user_id is not None:
            knowledge_base_query = knowledge_base_query.filter(
                KnowledgeBase.user_id == current_user_id
            )
        elif knowledge_base_ids:
            knowledge_base_query = knowledge_base_query.filter(
                KnowledgeBase.id.in_(knowledge_base_ids)
            )

        all_user_knowledge_bases = knowledge_base_query.all()
        requested_ids = set(knowledge_base_ids or [])
        knowledge_bases = [
            kb
            for kb in all_user_knowledge_bases
            if (not requested_ids or kb.id in requested_ids or current_user_id is not None)
        ]
        
        # Initialize embeddings
        embeddings = EmbeddingsFactory.create()
        
        # Create a vector store for each knowledge base
        vector_stores = []
        active_kb_ids: List[int] = []
        for kb in knowledge_bases:
            documents = db.query(Document).filter(Document.knowledge_base_id == kb.id).all()
            if documents:
                # Use the factory to create the appropriate vector store
                vector_store = VectorStoreFactory.create(
                    store_type=settings.VECTOR_STORE_TYPE,  # 'chroma' or other supported types
                    collection_name=f"kb_{kb.id}",
                    embedding_function=embeddings,
                )
                print(f"Collection {f'kb_{kb.id}'} count:", vector_store._store._collection.count())
                vector_stores.append(vector_store)
                active_kb_ids.append(kb.id)
        
        db_context_documents = []
        if active_kb_ids:
            db_context_documents = _load_db_context_documents(
                db=db,
                knowledge_bases=knowledge_bases,
                knowledge_base_ids=active_kb_ids,
                query=query,
            )

        if not vector_stores and not db_context_documents:
            error_msg = "I don't have any knowledge base to help answer your question."
            yield f'0:"{error_msg}"\n'
            yield 'd:{"finishReason":"stop","usage":{"promptTokens":0,"completionTokens":0}}\n'
            bot_message.content = error_msg
            db.commit()
            return
        
        retriever = RunnableLambda(
            lambda search_query: _retrieve_from_all_sources(
                search_query,
                vector_stores,
                db_context_documents,
            )
        )
        
        # Initialize the language model
        llm = LLMFactory.create()
        
        # Create contextualize question prompt
        contextualize_q_system_prompt = (
            "Given a chat history and the latest user message "
            "which might reference context in the chat history, "
            "formulate a standalone request or question which can be understood "
            "without the chat history. Do NOT answer it, just "
            "reformulate it if needed and otherwise return it as is."
        )
        contextualize_q_prompt = ChatPromptTemplate.from_messages([
            ("system", contextualize_q_system_prompt),
            MessagesPlaceholder("chat_history"),
            ("human", "{input}")
        ])
        
        # Create history aware retriever
        history_aware_retriever = create_history_aware_retriever(
            llm, 
            retriever,
            contextualize_q_prompt
        )

        # Create QA prompt
        allowed_document_templates = {"auto", "di", "pp", "ri"}
        template_hint = (document_template or "auto").lower()
        if template_hint not in allowed_document_templates:
            template_hint = "auto"

        strict_source_instruction = (
            "STRICT_SOURCE_MODE is ON. Answer only from the retrieved knowledge-base contexts. "
            "Do not use outside knowledge, guesses, or unstated assumptions. "
            "If the retrieved fragments do not contain enough evidence, say clearly what information is missing and, when possible, list which loaded documents or sources were checked from the context inventory. "
            "It is allowed to answer inventory questions from the inventory context, but do not use the inventory alone as evidence for detailed legal, policy, HR, or procedural claims. "
            "Every factual sentence must cite the relevant context with [citation:x]. "
        ) if strict_sources else (
            "SOURCE_MODE is balanced. Prefer knowledge-base contexts and cite them. If the context is incomplete, say what is missing before giving any general guidance. "
        )

        document_wizard_instruction = (
            "DOCUMENT_WIZARD_MODE is ON. The selected template hint is "
            f"'{template_hint}'. Treat the user's request as a request to create a formal ALT University document. "
            "First identify the template: 'di' for Должностная инструкция, 'pp' for Положение о подразделении, 'ri' for Рабочая инструкция, or infer it from the request if the hint is auto. "
            "Before drafting the final document, check required fields. For DI require at least: position_full_name, position_short_name if available, department_full_name, supervisor/leader position if relevant, document date, and approver details when approval is required. "
            "For PP require: department_full_name, department_short_name, document date, document code if available, and approval authority/approver when required. "
            "For RI require: instruction title, process or work scope, responsible department/position, document date, and approver when required. "
            "If any essential field is missing and cannot be found in the knowledge base, ask short numbered clarification questions only; do not draft placeholders. "
            "When all required fields are known, show a clean preview in the chat and include the DOCX_META block so the Word export button creates the file by the approved template. "
        ) if document_wizard else (
            "DOCUMENT_WIZARD_MODE is OFF. Still detect explicit requests to create DI/PP/RI or downloadable files and follow the official template instructions when requested. "
        )

        qa_system_prompt = (
            "You are ALTBot, a helpful knowledge-base assistant. Treat every user message as a request for help, whether it is phrased as a question, instruction, task, search prompt, or short keyword query. "
            f"{strict_source_instruction}"
            f"{document_wizard_instruction}"
            "Always provide the best possible answer to the user's intent; do not wait for imperative wording or require the user to demand an answer. "
            "If the message is phrased as a question, answer it directly instead of treating it as optional small talk. "
            "You are given a user message, and please write a clean, concise and accurate answer to it. "
            "You will be given a set of related contexts to the user message, which are numbered sequentially starting from 1. "
            "Each context has an implicit reference number based on its position in the array (first context is 1, second is 2, etc.). "
            "Please use these contexts and cite them using the format [citation:x] at the end of each sentence where applicable. "
            "Your answer must be correct, accurate and written by an expert using an unbiased and professional tone. "
            "Please limit ordinary answers to 1024 tokens. For document drafting requests, write as much as is needed to create a usable draft. Do not give any information that is not related to the user message, and do not repeat. "
            "Say 'information is missing on' followed by the related topic only if the provided context and the knowledge-base inventory truly do not contain the requested information. If the context contains a document inventory, use it to answer questions like which documents are loaded, what is in the knowledge base, or what can be summarized. "
            "If a sentence draws from multiple contexts, please list all applicable citations, like [citation:1][citation:2]. "
            "Other than code and specific names and citations, your answer must be written in the same language as the user message. "
            "If the user asks to create, prepare, send, or download a Word/DOCX, Excel, CSV, TXT or other downloadable file, prepare the requested file content in the answer instead of saying that file sending is unavailable; the interface can export your answer with the Word, Excel, TXT, MD and CSV buttons above it. "
            "For official document drafts, use the knowledge base to identify the addressee, rector, organization, positions, and names when those facts are available. If an essential field is not provided by the user and cannot be found in the knowledge base (for example the user's full name, user's position, addressee, approver, document type, or date), ask a short clarification question before drafting the final document. "
            "In ALT University document-template context, the abbreviation 'ДИ' means 'Должностная инструкция' and must use template=di. Do not interpret 'ДИ' as disciplinary action or 'дисциплинарное взыскание' unless the user explicitly writes that phrase. "
            "When drafting an official document that should be exported to DOCX, put this hidden metadata block at the very beginning of the answer, replacing every ellipsis with a real value; if a required value is unknown, ask the user first instead of using placeholders. Then write only the document body below it: <!-- DOCX_META\n"
            "document_type: ...\n"
            "title: ...\n"
            "organization: АО «ALT Университет имени Мухамеджана Тынышпаева»\n"
            "template: pp|di|ri|auto\n"
            "document_code: ...\n"
            "department_full_name: ...\n"
            "department_short_name: ...\n"
            "position_full_name: ...\n"
            "position_short_name: ...\n"
            "supervisor_position: ...\n"
            "leader_position: ...\n"
            "recipient_position: ...\n"
            "recipient_name: ...\n"
            "author_position: ...\n"
            "author_name: ...\n"
            "approval_required: true|false\n"
            "approver_position: ...\n"
            "approver_name: ...\n"
            "approval_authority: rector|board|none\n"
            "board_protocol: ...\n"
            "date: ...\n"
            "-->. "
            "For official university documents, strictly choose one of the approved templates: template=pp for 'Положение о подразделении' with sections 'ОБЩИЕ ПОЛОЖЕНИЯ', 'СТРУКТУРА', 'ЗАДАЧИ И ФУНКЦИИ', 'ОТВЕТСТВЕННОСТЬ', 'ЗАКЛЮЧИТЕЛЬНЫЕ ПОЛОЖЕНИЯ'; template=di for 'Должностная инструкция' with sections 'ОБЩИЕ ПОЛОЖЕНИЯ', 'КВАЛИФИКАЦИОННЫЕ ТРЕБОВАНИЯ', 'ОБЯЗАННОСТИ', 'ПРАВА', 'ОТВЕТСТВЕННОСТЬ', 'ЗАКЛЮЧИТЕЛЬНЫЕ ПОЛОЖЕНИЯ'; template=ri for 'Рабочая инструкция' following RI-ALT-125. "
            "For pp and di, fill department_full_name, department_short_name, document_code, approver fields, date, and for di also position_full_name and position_short_name. Use section headings exactly as listed so the DOCX exporter can put the content into the official Word template. "
            "Set approval_required to true only when the document type and context genuinely require an approval block from the rector, such as an order, rules, regulation, policy, instruction, or similar university act. Do not use the word 'УТВЕРЖДАЮ' for ordinary letters, applications, or messages to an addressee. "
            "Be concise.\n\nContext: {context}\n\n"
            "Remember: Cite contexts by their position number (1 for first context, 2 for second, etc.) and don't blindly "
            "repeat the contexts verbatim."
        )
        qa_prompt = ChatPromptTemplate.from_messages([
            ("system", qa_system_prompt),
            MessagesPlaceholder("chat_history"),
            ("human", "{input}")
        ])

        # 修改 create_stuff_documents_chain 来自定义 context 格式
        document_prompt = PromptTemplate.from_template("\n\n- {page_content}\n\n")

        # Create QA chain
        question_answer_chain = create_stuff_documents_chain(
            llm,
            qa_prompt,
            document_variable_name="context",
            document_prompt=document_prompt
        )

        # Create retrieval chain
        rag_chain = create_retrieval_chain(
            history_aware_retriever,
            question_answer_chain,
        )

        # Generate response
        chat_history = []
        for message in messages["messages"]:
            if message["role"] == "user":
                chat_history.append(HumanMessage(content=message["content"]))
            elif message["role"] == "assistant":
                # if include __LLM_RESPONSE__, only use the last part
                if "__LLM_RESPONSE__" in message["content"]:
                    message["content"] = message["content"].split("__LLM_RESPONSE__")[-1]
                chat_history.append(AIMessage(content=message["content"]))

        full_response = ""
        async for chunk in rag_chain.astream({
            "input": query,
            "chat_history": chat_history
        }):
            if "context" in chunk:
                serializable_context = []
                for context in chunk["context"]:
                    serializable_doc = {
                        "page_content": context.page_content.replace('"', '\\"'),
                        "metadata": context.metadata,
                    }
                    serializable_context.append(serializable_doc)
                
                # 先替换引号，再序列化
                escaped_context = json.dumps({
                    "context": serializable_context
                })

                # 转成 base64
                base64_context = base64.b64encode(escaped_context.encode()).decode()

                # 连接符号
                separator = "__LLM_RESPONSE__"
                
                yield f'0:"{base64_context}{separator}"\n'
                full_response += base64_context + separator

            if "answer" in chunk:
                answer_chunk = chunk["answer"]
                full_response += answer_chunk
                # Escape quotes and use json.dumps to properly handle special characters
                escaped_chunk = (answer_chunk
                    .replace('"', '\\"')
                    .replace('\n', '\\n'))
                yield f'0:"{escaped_chunk}"\n'
            
        # Update bot message content
        bot_message.content = full_response
        db.commit()
            
    except Exception as e:
        error_message = f"Error generating response: {str(e)}"
        print(error_message)
        yield '3:{text}\n'.format(text=error_message)
        
        # Update bot message with error
        if 'bot_message' in locals():
            bot_message.content = error_message
            db.commit()
    finally:
        db.close()
