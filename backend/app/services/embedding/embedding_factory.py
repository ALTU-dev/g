from app.core.config import settings
from langchain_openai import OpenAIEmbeddings
from langchain_ollama import OllamaEmbeddings
from langchain_community.embeddings import DashScopeEmbeddings


class EmbeddingsFactory:
    @staticmethod
    def create():
        """
        Factory method to create an embeddings instance based on .env config.
        """
        embeddings_provider = settings.EMBEDDINGS_PROVIDER.lower()

        if embeddings_provider == "openai":
            return OpenAIEmbeddings(
                openai_api_key=settings.OPENAI_API_KEY,
                openai_api_base=settings.OPENAI_API_BASE,
                model=settings.OPENAI_EMBEDDINGS_MODEL,
                chunk_size=settings.OPENAI_EMBEDDINGS_CHUNK_SIZE,
                max_retries=settings.OPENAI_EMBEDDINGS_MAX_RETRIES,
                request_timeout=settings.OPENAI_EMBEDDINGS_TIMEOUT_SECONDS,
            )
        elif embeddings_provider == "dashscope":
            return DashScopeEmbeddings(
                model=settings.DASH_SCOPE_EMBEDDINGS_MODEL,
                dashscope_api_key=settings.DASH_SCOPE_API_KEY
            )
        elif embeddings_provider == "ollama":
            return OllamaEmbeddings(
                model=settings.OLLAMA_EMBEDDINGS_MODEL,
                base_url=settings.OLLAMA_API_BASE
            )
        elif embeddings_provider == "huggingface":
            try:
                from langchain_huggingface import HuggingFaceEmbeddings
            except ImportError as exc:
                raise ValueError(
                    "HuggingFace embeddings are optional. Install "
                    "backend/requirements-huggingface.txt or use "
                    "EMBEDDINGS_PROVIDER=openai, dashscope, or ollama."
                ) from exc

            model_kwargs = {}
            if settings.HUGGINGFACE_API_KEY:
                model_kwargs["token"] = settings.HUGGINGFACE_API_KEY
            return HuggingFaceEmbeddings(
                model_name=settings.HUGGINGFACE_EMBEDDINGS_MODEL,
                model_kwargs=model_kwargs
            )
        else:
            raise ValueError(f"Unsupported embeddings provider: {embeddings_provider}")
