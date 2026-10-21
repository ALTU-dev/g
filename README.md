
- Frontend UI: http://127.0.0.1.nip.io
- API Documentation: http://127.0.0.1.nip.io/redoc
- MinIO Console: http://127.0.0.1.nip.io:9001

## Configuration

### Core Configuration

| Parameter                   | Description                | Default   | Required |
| --------------------------- | -------------------------- | --------- | -------- |
| MYSQL_SERVER                | MySQL Server Address       | localhost | ✅        |
| MYSQL_USER                  | MySQL Username             | postgres  | ✅        |
| MYSQL_PASSWORD              | MySQL Password             | postgres  | ✅        |
| MYSQL_DATABASE              | MySQL Database Name        | ragwebui  | ✅        |
| SECRET_KEY                  | JWT Secret Key             | -         | ✅        |
| ACCESS_TOKEN_EXPIRE_MINUTES | JWT Token Expiry (minutes) | 30        | ✅        |

### LLM Configuration

| Parameter         | Description           | Default                   | Applicable            |
| ----------------- | --------------------- | ------------------------- | --------------------- |
| CHAT_PROVIDER     | LLM Service Provider  | openai                    | ✅                     |
| OPENAI_API_KEY    | OpenAI API Key        | -                         | Required for OpenAI   |
| OPENAI_API_BASE   | OpenAI API Base URL   | https://api.openai.com/v1 | Optional for OpenAI   |
| OPENAI_MODEL      | OpenAI Model Name     | gpt-4                     | Required for OpenAI   |
| DEEPSEEK_API_KEY  | DeepSeek API Key      | -                         | Required for DeepSeek |
| DEEPSEEK_API_BASE | DeepSeek API Base URL | -                         | Required for DeepSeek |
| DEEPSEEK_MODEL    | DeepSeek Model Name   | -                         | Required for DeepSeek |
| OLLAMA_API_BASE   | Ollama API Base URL   | http://localhost:11434    | Required for Ollama   |
| OLLAMA_MODEL      | Ollama Model Name     | llama2                    | Required for Ollama   |
| MINIMAX_API_KEY   | MiniMax API Key       | -                         | Required for MiniMax  |
| MINIMAX_API_BASE  | MiniMax API Base URL  | https://api.minimax.io/v1 | Optional for MiniMax  |
| MINIMAX_MODEL     | MiniMax Model Name    | MiniMax-M2.7              | Required for MiniMax  |

### Embedding Configuration

| Parameter                   | Description                | Default                | Applicable                    |
| --------------------------- | -------------------------- | ---------------------- | ----------------------------- |
| EMBEDDINGS_PROVIDER         | Embedding Service Provider | openai                 | ✅                             |
| OPENAI_API_KEY              | OpenAI API Key             | -                      | Required for OpenAI Embedding |
| OPENAI_EMBEDDINGS_MODEL     | OpenAI Embedding Model     | text-embedding-ada-002 | Required for OpenAI Embedding |
| DASH_SCOPE_API_KEY          | DashScope API Key          | -                      | Required for DashScope        |
| DASH_SCOPE_EMBEDDINGS_MODEL | DashScope Embedding Model  | -                      | Required for DashScope        |
| OLLAMA_EMBEDDINGS_MODEL     | Ollama Embedding Model     | deepseek-r1:7b         | Required for Ollama Embedding |

### Vector Database Configuration

| Parameter          | Description                       | Default               | Applicable            |
| ------------------ | --------------------------------- | --------------------- | --------------------- |
| VECTOR_STORE_TYPE  | Vector Store Type                 | chroma                | ✅                     |
| CHROMA_DB_HOST     | ChromaDB Server Address           | localhost             | Required for ChromaDB |
| CHROMA_DB_PORT     | ChromaDB Port                     | 8000                  | Required for ChromaDB |
| QDRANT_URL         | Qdrant Vector Store URL           | http://localhost:6333 | Required for Qdrant   |
| QDRANT_PREFER_GRPC | Prefer gRPC Connection for Qdrant | true                  | Optional for Qdrant   |

### Object Storage Configuration

| Parameter         | Description          | Default        | Required |
| ----------------- | -------------------- | -------------- | -------- |
| MINIO_ENDPOINT    | MinIO Server Address | localhost:9000 | ✅        |
| MINIO_ACCESS_KEY  | MinIO Access Key     | minioadmin     | ✅        |
| MINIO_SECRET_KEY  | MinIO Secret Key     | minioadmin     | ✅        |
| MINIO_BUCKET_NAME | MinIO Bucket Name    | documents      | ✅        |

