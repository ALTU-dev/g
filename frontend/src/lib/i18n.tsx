"use client";

import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export const translations = {
  kk: {
    common: {
      language: "Тіл",
      brand: "ALTBot",
      error: "Қате",
      success: "Сәтті",
      cancel: "Болдырмау",
      create: "Құру",
      creating: "Құрылуда...",
      loading: "Жүктелуде...",
      noDescription: "Сипаттама жоқ",
      documents: "құжат",
      messages: "хабарлама",
      total: "барлығы",
      name: "Атауы",
      size: "Өлшемі",
      created: "Құрылған",
      status: "Күйі",
      delete: "Жою",
      search: "Іздеу",
      reindex: "Қайта индекстеу",
      toggleTheme: "Тақырыпты ауыстыру",
      lightTheme: "Жарық",
      darkTheme: "Қараңғы",
    },
    uploads: {
      attach: "Файл қосу",
      dropToUpload: "Файлдарды осында тастаңыз",
      uploading: "Жүктелуде",
      processing: "Өңделуде",
      completed: "Дайын",
      failed: "Қате",
      filesReady: "Файлдар білім базасына қосылды",
      supported: "PDF, DOCX, TXT, MD және суреттер",
      waitForProcessing: "Файл өңделгенше күтіңіз",
      uploadFailed: "Файлдарды жүктеу мүмкін болмады",
    },
    home: {
      knowledgeBase: "Білім базасы",
      newChat: "Жаңа чат",
      eyebrow: "RAG көмекші",
      title: "Қалай көмектесе аламын?",
      subtitle:
        "Құжаттарды білім базасына қосып, олардың мазмұны бойынша ChatGPT-ке ұқсас интерфейсте сұрақ қойыңыз.",
      promptLabel: "Сұрағыңыз",
      promptPlaceholder: "Жүктелген құжаттар бойынша сұрақ қойыңыз...",
      noDocsHint: "Құжаттар жоқ болса — файл жүктеу ашылады",
      errorOpenChat:
        "Чатты ашу мүмкін болмады. Құжаттарды білім базасына қосып, қайта көріңіз.",
      defaultKbName: "Менің білім базам",
      defaultKbDescription: "ALTBot чатта жауап беретін құжаттар",
      examples: [
        "Жүктелген құжаттарды қысқаша мазмұнда",
        "Білім базасындағы негізгі тәуекелдерді тап",
        "Материалдар бойынша әрекеттер тізімін жаса",
      ],
      features: {
        upload: "PDF, DOCX, TXT, MD және суреттер",
        answers: "Құжаттар бойынша жауаптар",
        noLogin: "Аккаунтсыз және логинсіз",
      },
    },
    layout: {
      openNavigation: "Навигацияны ашу",
      closeNavigation: "Навигацияны жабу",
      newChat: "Жаңа чат",
      chat: "Чат",
      knowledgeBase: "Білім базасы",
      localWorkspace: "Жергілікті workspace",
      localWorkspaceDescription:
        "Кірусіз: құжаттар мен чаттар жергілікті workspace ішінде сақталады.",
    },
    dashboard: {
      title: "Білім көмекшісі",
      subtitle:
        "Жеке AI білім орталығыңыз. Құжаттарды жүктеп, білім базаларын құрып, табиғи диалог арқылы жылдам жауап алыңыз.",
      newKb: "Жаңа білім базасы",
      knowledgeBases: "Білім базалары",
      viewAllKbs: "Барлық білім базаларын көру",
      chatSessions: "Чат сессиялары",
      viewAllChats: "Барлық чаттарды көру",
      quickActions: "Жылдам әрекеттер",
      createKb: "Білім базасын құру",
      createKbDescription: "AI қолдайтын жаңа білім қоймасын жасаңыз",
      uploadDocuments: "Құжаттарды жүктеу",
      uploadDocumentsDescription:
        "Білім базаларыңызға PDF, DOCX, MD немесе TXT файлдарын қосыңыз",
      startChatting: "Чатты бастау",
      startChattingDescription:
        "Біліміңізден AI арқылы жылдам жауап алыңыз",
      howItWorks: "Қалай жұмыс істейді",
      stepCreateTitle: "Білім базасын құрыңыз",
      stepCreateDescription:
        "Ақпаратыңызды ұйымдастыру үшін жаңа білім базасын құрудан бастаңыз. Оны оңай тану үшін атауы мен сипаттамасын беріңіз.",
      createNow: "Қазір құру",
      stepUploadTitle: "Құжаттарыңызды жүктеңіз",
      stepUploadDescription:
        "PDF, DOCX, MD немесе TXT файлдарын білім базаңызға жүктеңіз. Жүйе оларды AI іздеуіне дайындап, индекстейді.",
      uploadDocumentsCta: "Құжат жүктеу",
      stepChatTitle: "Білім базаңызбен сөйлесіңіз",
      stepChatDescription:
        "Білім базаңызбен диалог бастаңыз. Табиғи тілде сұрақ қойып, құжаттарыңызға негізделген нақты жауап алыңыз.",
      startChattingCta: "Чатты бастау",
    },
    chat: {
      emptyTitle: "Қалай көмектесе аламын?",
      emptyDescription:
        "Таңдалған білім базасы бойынша сұрақ қойыңыз — жауаптар осы жерде диалог түрінде пайда болады.",
      placeholder: "Бірдеңе сұраңыз...",
      sendMessage: "Хабарлама жіберу",
      disclaimer:
        "ALTBot қателесуі мүмкін. Маңызды жауаптарды дереккөздер бойынша тексеріңіз.",
      conversationsTitle: "Сіздің чаттарыңыз",
      conversationsDescription: "Чат тарихын қарап, басқарыңыз",
      startNewChat: "Жаңа чат бастау",
      searchPlaceholder: "Чаттарды іздеу...",
      confirmDelete: "Бұл чатты жою керек пе?",
      deleteSuccess: "Чат сәтті жойылды",
      noConversationsTitle: "Әзірге чат жоқ",
      noConversationsDescription:
        "Білім базаңызды зерттеуді бастау үшін жаңа чат ашыңыз",
      startFirstChat: "Алғашқы чатты бастау",
      newChatTitle: "Жаңа чат бастау",
      newChatDescription: "Сөйлесетін білім базасын таңдаңыз",
      openingNewChat: "Жаңа чат ашылып жатыр",
      openingAllKnowledge:
        "Барлық жүктелген білім базалары автоматты түрде қосылады.",
      noKbsTitle: "Білім базалары табылмады",
      noKbsDescription:
        "Чатты бастамас бұрын кемінде бір білім базасын құру қажет.",
      createKb: "Білім базасын құру",
      addDocsFirstTitle: "Алдымен құжат қосыңыз",
      addDocsFirstDescription:
        "Чат өңделген құжаттарға сүйеніп жауап береді. Білім базаңызға файл жүктеп, өңдеу аяқталған соң чатты бастаңыз.",
      addDocuments: "Құжат қосу",
      firstMessage: "Бірінші хабарламаңыз",
      chatTitle: "Чат атауы",
      chatTitlePlaceholder: "Чат атауын енгізіңіз",
      knowledgeBase: "Білім базасы",
      multipleSelectionSoon: "Көп таңдау жақында қосылады...",
      selectKbError: "Өңделген құжаттары бар білім базасын таңдаңыз",
      failedCreateChat: "Чат құру мүмкін болмады",
      startChat: "Чатты бастау",
      strictSources: "Қатаң құжаттар бойынша",
      strictSourcesHint:
        "Жауап тек табылған фрагменттерге сүйенеді. Дерек жетпесе, бот оны ашық айтады.",
      documentWizard: "Құжат шебері",
      documentWizardHint:
        "ДИ / ПП / РИ үшін жетіспейтін деректерді сұрап, кейін DOCX үлгісін дайындайды.",
      documentWizardMode: "Құжат шебері қосулы",
      templateAuto: "Авто",
      templateDi: "ДИ",
      templatePp: "ПП",
      templateRi: "РИ",
    },
    knowledge: {
      listTitle: "Білім базалары",
      listDescription:
        "Құжаттарды осында қосыңыз, кейін чатта олар бойынша сұрақ қойыңыз",
      newKb: "Жаңа білім базасы",
      addDocuments: "Құжат қосу",
      ask: "Сұрау",
      documentsTitle: "Құжаттар",
      noKbTitle: "Әзірге білім базасы жоқ",
      noKbDescription:
        "Білім базасын құрып, құжаттарды жүктеңіз — ALTBot оларды жауаптар үшін контекст ретінде қолданады.",
      createKb: "Білім базасын құру",
      loadingKbs: "Білім базалары жүктелуде...",
      confirmDelete: "Бұл білім базасын жою керек пе?",
      deleteSuccess: "Білім базасы сәтті жойылды",
      viewAllDocuments: "Барлық құжаттарды көру",
      detailTitle: "Білім базасы",
      detailDescription:
        "Құжаттарды қосыңыз — өңдеуден кейін чат олар бойынша жауап береді.",
      startChat: "Чатты бастау",
      dialogTitle: "Құжат қосу",
      dialogDescription:
        "PDF, DOCX, Markdown, Text файлдарын немесе суреттерді жүктеңіз. ALTBot оларды іздеуге болатын бөліктерге бөліп, чат жауаптарында қолданады.",
      uploadNudge:
        "Сұрағыңызға жауап беру үшін алдымен құжаттарды осы білім базасына жүктеңіз. Өңдеуден кейін чатқа қайта оралуға болады.",
      inspectorTitle: "Білім базасының инспекторы",
      inspectorDescription:
        "Индекстеу күйін, chunks санын, қателерді және тестілік іздеуді тексеріңіз.",
      documentsLoaded: "Жүктелген құжаттар",
      chunksCreated: "Құрылған chunks",
      vectorRecords: "Vector жазбалар",
      failedIndexing: "Индекстелмеген",
      notIndexedTitle: "Индекстелмеген құжаттар",
      allIndexed: "Барлық құжаттар индекстелген.",
      reindexStarted: "Қайта индекстеу басталды",
      testSearch: "Тестілік іздеу",
      testSearchPlaceholder: "Сұрақ енгізіп, бот қандай фрагменттерді тапқанын көріңіз...",
      searchResults: "Табылған фрагменттер",
      noSearchResults: "Фрагменттер табылмады.",
      score: "Ұқсастық",
      source: "Дереккөз",
      newTitle: "Білім базасын құру",
      newDescription: "Құжаттарыңызды сақтау үшін жаңа білім базасын құрыңыз",
      nameLabel: "Атауы",
      namePlaceholder: "Білім базасының атауын енгізіңіз",
      descriptionLabel: "Сипаттама",
      descriptionPlaceholder: "Білім базасының сипаттамасын енгізіңіз",
      failedCreate: "Білім базасын құру мүмкін болмады",
    },
    documents: {
      loading: "Құжаттар жүктелуде...",
      failedFetch: "Құжаттарды жүктеу мүмкін болмады",
      emptyTitle: "Әзірге құжат жоқ",
      emptyDescription:
        "Білім базаңызды құруды бастау үшін алғашқы құжатыңызды жүктеңіз.",
      uploadLabel: "Жүктеу",
      previewLabel: "Алдын ала көру",
      processLabel: "Өңдеу",
      dropzone: "Файлдарды осында тастаңыз немесе таңдау үшін басыңыз",
      supports: "PDF, DOCX, TXT, MD және суреттерді қолдайды",
      uploadFiles: "Файлдарды жүктеу",
      uploaded: "Жүктелді",
      uploadSuccessful: "Жүктеу сәтті өтті",
      uploadSuccessfulDescription: "файл сәтті жүктелді.",
      uploadFailed: "Жүктеу сәтсіз аяқталды",
      somethingWentWrong: "Бірдеңе дұрыс болмады",
      previewGenerated: "Алдын ала көру дайын",
      previewGeneratedDescription: "Құжаттың алдын ала көрінісі сәтті жасалды.",
      previewFailed: "Алдын ала көру сәтсіз аяқталды",
      processingFailed: "Өңдеу сәтсіз аяқталды",
      processingCompleted: "Өңдеу аяқталды",
      processingCompletedDescription: "Барлық құжаттар сәтті өңделді.",
      processingCompletedWithErrors: "Өңдеу қателермен аяқталды",
      processingCompletedWithErrorsDescription:
        "Кейбір құжаттарды өңдеу мүмкін болмады.",
      statusCheckFailed: "Күйді тексеру сәтсіз аяқталды",
      selectDocumentToPreview: "Алдын ала көру үшін құжат таңдаңыз",
      selectDocumentPlaceholder: "Алдын ала көруге құжат таңдаңыз",
      advancedSettings: "Кеңейтілген баптаулар",
      chunkSize: "Бөлік өлшемі (токен)",
      chunkOverlap: "Бөліктер қиылысы (токен)",
      previewChunks: "Бөліктерді алдын ала көру",
      continue: "Жалғастыру",
      chunks: "бөлік",
      chunk: "Бөлік",
      status: "Күйі",
      pending: "күтуде",
      processing: "өңделуде",
      completed: "аяқталды",
      failed: "қате",
      process: "Өңдеу",
      processingLabel: "Өңделуде...",
    },
    answer: {
      downloadDocument: "Құжатты жүктеу",
      debugInfo: "Техникалық ақпарат:",
      foundFragments: "Табылған фрагменттер",
      showFoundFragments: "Табылған фрагменттерді көрсету",
      hideFoundFragments: "Фрагменттерді жасыру",
    },
  },
  en: {
    common: {
      language: "Language",
      brand: "ALTBot",
      error: "Error",
      success: "Success",
      cancel: "Cancel",
      create: "Create",
      creating: "Creating...",
      loading: "Loading...",
      noDescription: "No description",
      documents: "documents",
      messages: "messages",
      total: "total",
      name: "Name",
      size: "Size",
      created: "Created",
      status: "Status",
      delete: "Delete",
      search: "Search",
      reindex: "Reindex",
      toggleTheme: "Toggle theme",
      lightTheme: "Light",
      darkTheme: "Dark",
    },
    uploads: {
      attach: "Attach files",
      dropToUpload: "Drop files here to upload",
      uploading: "Uploading",
      processing: "Processing",
      completed: "Ready",
      failed: "Failed",
      filesReady: "Files were added to the knowledge base",
      supported: "PDF, DOCX, TXT, MD and images",
      waitForProcessing: "Wait for file processing to finish",
      uploadFailed: "Could not upload files",
    },
    home: {
      knowledgeBase: "Knowledge Base",
      newChat: "New chat",
      eyebrow: "RAG assistant",
      title: "How can I help?",
      subtitle:
        "Add documents to the knowledge base, then ask questions about their content in a ChatGPT-like interface.",
      promptLabel: "Your prompt",
      promptPlaceholder: "Ask something about uploaded documents...",
      noDocsHint: "If there are no documents, file upload will open",
      errorOpenChat:
        "Could not open the chat. Add documents to the knowledge base and try again.",
      defaultKbName: "My knowledge base",
      defaultKbDescription: "Documents ALTBot uses to answer in chat",
      examples: [
        "Briefly summarize the uploaded documents",
        "Find key risks in the knowledge base",
        "Create an action list from the materials",
      ],
      features: {
        upload: "Upload PDF, DOCX, TXT, MD and images",
        answers: "Answers from documents",
        noLogin: "No account or login",
      },
    },
    layout: {
      openNavigation: "Open navigation",
      closeNavigation: "Close navigation",
      newChat: "New chat",
      chat: "Chat",
      knowledgeBase: "Knowledge Base",
      localWorkspace: "Local workspace",
      localWorkspaceDescription:
        "No login: documents and chats are stored in the local workspace.",
    },
    dashboard: {
      title: "Knowledge Assistant",
      subtitle:
        "Your personal AI-powered knowledge hub. Upload documents, create knowledge bases, and get instant answers through natural conversations.",
      newKb: "New Knowledge Base",
      knowledgeBases: "Knowledge Bases",
      viewAllKbs: "View all knowledge bases",
      chatSessions: "Chat Sessions",
      viewAllChats: "View all chat sessions",
      quickActions: "Quick Actions",
      createKb: "Create Knowledge Base",
      createKbDescription: "Build a new AI-powered knowledge repository",
      uploadDocuments: "Upload Documents",
      uploadDocumentsDescription:
        "Add PDF, DOCX, MD or TXT files to your knowledge bases",
      startChatting: "Start Chatting",
      startChattingDescription:
        "Get instant answers from your knowledge with AI",
      howItWorks: "How It Works",
      stepCreateTitle: "Create a Knowledge Base",
      stepCreateDescription:
        "Start by creating a new knowledge base to organize your information. Give it a name and description that helps you identify its purpose.",
      createNow: "Create now",
      stepUploadTitle: "Upload Your Documents",
      stepUploadDescription:
        "Upload PDF, DOCX, MD or TXT files to your knowledge base. Our system will process and index them for AI-powered retrieval.",
      uploadDocumentsCta: "Upload documents",
      stepChatTitle: "Chat With Your Knowledge",
      stepChatDescription:
        "Start a conversation with your knowledge base. Ask questions in natural language and get accurate answers based on your documents.",
      startChattingCta: "Start chatting",
    },
    chat: {
      emptyTitle: "How can I help?",
      emptyDescription:
        "Ask a question about the selected knowledge base — answers will appear here as a normal conversation.",
      placeholder: "Ask anything...",
      sendMessage: "Send message",
      disclaimer:
        "ALTBot can make mistakes. Check important answers against sources.",
      conversationsTitle: "Your conversations",
      conversationsDescription: "Explore and manage your chat history",
      startNewChat: "Start new chat",
      searchPlaceholder: "Search conversations...",
      confirmDelete: "Are you sure you want to delete this chat?",
      deleteSuccess: "Chat deleted successfully",
      noConversationsTitle: "No conversations yet",
      noConversationsDescription:
        "Start a new chat to begin exploring your knowledge base",
      startFirstChat: "Start your first chat",
      newChatTitle: "Start new chat",
      newChatDescription: "Select a knowledge base to chat with",
      openingNewChat: "Opening a new chat",
      openingAllKnowledge:
        "All uploaded knowledge bases are connected automatically.",
      noKbsTitle: "No knowledge bases found",
      noKbsDescription:
        "You need to create at least one knowledge base before starting a chat.",
      createKb: "Create Knowledge Base",
      addDocsFirstTitle: "Add documents first",
      addDocsFirstDescription:
        "The chat answers from processed documents. Upload files to your knowledge base, wait for processing, then start chatting.",
      addDocuments: "Add Documents",
      firstMessage: "Your first message",
      chatTitle: "Chat title",
      chatTitlePlaceholder: "Enter chat title",
      knowledgeBase: "Knowledge Base",
      multipleSelectionSoon: "Multiple selection coming soon...",
      selectKbError: "Please select a knowledge base with processed documents",
      failedCreateChat: "Failed to create chat",
      startChat: "Start chat",
      strictSources: "Strictly from documents",
      strictSourcesHint:
        "Answers use only retrieved fragments. If evidence is missing, the bot says so.",
      documentWizard: "Document wizard",
      documentWizardHint:
        "For DI / PP / RI, asks for missing fields and then prepares a DOCX template.",
      documentWizardMode: "Document wizard enabled",
      templateAuto: "Auto",
      templateDi: "DI",
      templatePp: "PP",
      templateRi: "RI",
    },
    knowledge: {
      listTitle: "Knowledge Bases",
      listDescription:
        "Add documents here, then ask questions about them in chat",
      newKb: "New Knowledge Base",
      addDocuments: "Add Documents",
      ask: "Ask",
      documentsTitle: "Documents",
      noKbTitle: "No knowledge base yet",
      noKbDescription:
        "Create a knowledge base, upload documents, and ALTBot will use them as context for answers.",
      createKb: "Create Knowledge Base",
      loadingKbs: "Loading knowledge bases...",
      confirmDelete: "Are you sure you want to delete this knowledge base?",
      deleteSuccess: "Knowledge base deleted successfully",
      viewAllDocuments: "View all documents",
      detailTitle: "Knowledge Base",
      detailDescription:
        "Add documents — after processing, chat will answer from them.",
      startChat: "Start chat",
      dialogTitle: "Add Documents",
      dialogDescription:
        "Upload PDF, DOCX, Markdown, Text files, or images. ALTBot will split them into searchable chunks and use them in chat answers.",
      uploadNudge:
        "To answer your question, first upload documents to this knowledge base. After processing, you can return to chat.",
      inspectorTitle: "Knowledge Base Inspector",
      inspectorDescription:
        "Check indexing status, chunk counts, failures, and test retrieval.",
      documentsLoaded: "Documents loaded",
      chunksCreated: "Chunks created",
      vectorRecords: "Vector records",
      failedIndexing: "Not indexed",
      notIndexedTitle: "Documents not indexed",
      allIndexed: "All documents are indexed.",
      reindexStarted: "Reindexing started",
      testSearch: "Test search",
      testSearchPlaceholder: "Enter a question to see which fragments the bot finds...",
      searchResults: "Found fragments",
      noSearchResults: "No fragments found.",
      score: "Similarity",
      source: "Source",
      newTitle: "Create Knowledge Base",
      newDescription: "Create a new knowledge base to store your documents",
      nameLabel: "Name",
      namePlaceholder: "Enter knowledge base name",
      descriptionLabel: "Description",
      descriptionPlaceholder: "Enter knowledge base description",
      failedCreate: "Failed to create knowledge base",
    },
    documents: {
      loading: "Loading documents...",
      failedFetch: "Failed to fetch documents",
      emptyTitle: "No documents yet",
      emptyDescription:
        "Upload your first document to start building your knowledge base.",
      uploadLabel: "Upload",
      previewLabel: "Preview",
      processLabel: "Process",
      dropzone: "Drop your files here or click to browse",
      supports: "Supports PDF, DOCX, TXT, MD, and images",
      uploadFiles: "Upload files",
      uploaded: "Uploaded",
      uploadSuccessful: "Upload successful",
      uploadSuccessfulDescription: "files uploaded successfully.",
      uploadFailed: "Upload failed",
      somethingWentWrong: "Something went wrong",
      previewGenerated: "Preview generated",
      previewGeneratedDescription: "Document preview generated successfully.",
      previewFailed: "Preview failed",
      processingFailed: "Processing failed",
      processingCompleted: "Processing completed",
      processingCompletedDescription:
        "All documents have been processed successfully.",
      processingCompletedWithErrors: "Processing completed with errors",
      processingCompletedWithErrorsDescription:
        "Some documents failed to process.",
      statusCheckFailed: "Status check failed",
      selectDocumentToPreview: "Select document to preview",
      selectDocumentPlaceholder: "Select a document to preview",
      advancedSettings: "Advanced settings",
      chunkSize: "Chunk size (tokens)",
      chunkOverlap: "Chunk overlap (tokens)",
      previewChunks: "Preview chunks",
      continue: "Continue",
      chunks: "chunks",
      chunk: "Chunk",
      status: "Status",
      pending: "pending",
      processing: "processing",
      completed: "completed",
      failed: "failed",
      process: "Process",
      processingLabel: "Processing...",
    },
    answer: {
      downloadDocument: "Download document",
      debugInfo: "Debug Info:",
      foundFragments: "Found fragments",
      showFoundFragments: "Show found fragments",
      hideFoundFragments: "Hide fragments",
    },
  },
  ru: {
    common: {
      language: "Язык",
      brand: "ALTBot",
      error: "Ошибка",
      success: "Готово",
      cancel: "Отмена",
      create: "Создать",
      creating: "Создаётся...",
      loading: "Загрузка...",
      noDescription: "Нет описания",
      documents: "документов",
      messages: "сообщений",
      total: "всего",
      name: "Название",
      size: "Размер",
      created: "Создано",
      status: "Статус",
      delete: "Удалить",
      search: "Поиск",
      reindex: "Переиндексировать",
      toggleTheme: "Переключить тему",
      lightTheme: "Светлая",
      darkTheme: "Тёмная",
    },
    uploads: {
      attach: "Прикрепить файлы",
      dropToUpload: "Перетащите файлы сюда для загрузки",
      uploading: "Загрузка",
      processing: "Обработка",
      completed: "Готово",
      failed: "Ошибка",
      filesReady: "Файлы добавлены в базу знаний",
      supported: "PDF, DOCX, TXT, MD и изображения",
      waitForProcessing: "Дождитесь окончания обработки файла",
      uploadFailed: "Не удалось загрузить файлы",
    },
    home: {
      knowledgeBase: "База знаний",
      newChat: "Новый чат",
      eyebrow: "RAG ассистент",
      title: "Чем я могу помочь?",
      subtitle:
        "Добавьте документы в базу знаний и задавайте вопросы по их содержимому в интерфейсе, похожем на ChatGPT.",
      promptLabel: "Ваш запрос",
      promptPlaceholder: "Спросите что-нибудь по загруженным документам...",
      noDocsHint: "Если документов нет — откроется загрузка файлов",
      errorOpenChat:
        "Не получилось открыть чат. Добавьте документы в базу знаний и попробуйте ещё раз.",
      defaultKbName: "Моя база знаний",
      defaultKbDescription: "Документы, по которым ALTBot отвечает в чате",
      examples: [
        "Кратко перескажи загруженные документы",
        "Найди ключевые риски в базе знаний",
        "Составь список действий по материалам",
      ],
      features: {
        upload: "Загрузка PDF, DOCX, TXT, MD и изображений",
        answers: "Ответы по документам",
        noLogin: "Без аккаунта и логина",
      },
    },
    layout: {
      openNavigation: "Открыть навигацию",
      closeNavigation: "Закрыть навигацию",
      newChat: "Новый чат",
      chat: "Чат",
      knowledgeBase: "База знаний",
      localWorkspace: "Локальный workspace",
      localWorkspaceDescription:
        "Без входа: документы и чаты хранятся в локальном workspace.",
    },
    dashboard: {
      title: "База знаний AI",
      subtitle:
        "Ваш персональный AI-хаб знаний. Загружайте документы, создавайте базы знаний и получайте быстрые ответы через естественный диалог.",
      newKb: "Новая база знаний",
      knowledgeBases: "Базы знаний",
      viewAllKbs: "Посмотреть все базы знаний",
      chatSessions: "Чат-сессии",
      viewAllChats: "Посмотреть все чаты",
      quickActions: "Быстрые действия",
      createKb: "Создать базу знаний",
      createKbDescription: "Создайте новое AI-хранилище знаний",
      uploadDocuments: "Загрузить документы",
      uploadDocumentsDescription:
        "Добавьте PDF, DOCX, MD или TXT файлы в ваши базы знаний",
      startChatting: "Начать чат",
      startChattingDescription:
        "Получайте быстрые ответы из вашей базы знаний с AI",
      howItWorks: "Как это работает",
      stepCreateTitle: "Создайте базу знаний",
      stepCreateDescription:
        "Начните с создания новой базы знаний для организации информации. Дайте ей название и описание, чтобы быстро понимать её назначение.",
      createNow: "Создать сейчас",
      stepUploadTitle: "Загрузите документы",
      stepUploadDescription:
        "Загрузите PDF, DOCX, MD или TXT файлы в базу знаний. Система обработает и проиндексирует их для AI-поиска.",
      uploadDocumentsCta: "Загрузить документы",
      stepChatTitle: "Общайтесь со своей базой знаний",
      stepChatDescription:
        "Начните диалог с базой знаний. Задавайте вопросы естественным языком и получайте точные ответы на основе ваших документов.",
      startChattingCta: "Начать чат",
    },
    chat: {
      emptyTitle: "Чем могу помочь?",
      emptyDescription:
        "Задайте вопрос по выбранной базе знаний — ответы появятся здесь в формате обычного диалога.",
      placeholder: "Спросите что-нибудь...",
      sendMessage: "Отправить сообщение",
      disclaimer:
        "ALTBot может ошибаться. Проверяйте важные ответы по источникам.",
      conversationsTitle: "Ваши чаты",
      conversationsDescription: "Просматривайте и управляйте историей чатов",
      startNewChat: "Начать новый чат",
      searchPlaceholder: "Искать чаты...",
      confirmDelete: "Вы уверены, что хотите удалить этот чат?",
      deleteSuccess: "Чат успешно удалён",
      noConversationsTitle: "Пока нет чатов",
      noConversationsDescription:
        "Начните новый чат, чтобы исследовать свою базу знаний",
      startFirstChat: "Начать первый чат",
      newChatTitle: "Начать новый чат",
      newChatDescription: "Выберите базу знаний для общения",
      openingNewChat: "Открываю новый чат",
      openingAllKnowledge:
        "Все загруженные базы знаний подключаются автоматически.",
      noKbsTitle: "Базы знаний не найдены",
      noKbsDescription:
        "Перед началом чата нужно создать хотя бы одну базу знаний.",
      createKb: "Создать базу знаний",
      addDocsFirstTitle: "Сначала добавьте документы",
      addDocsFirstDescription:
        "Чат отвечает по обработанным документам. Загрузите файлы в базу знаний, дождитесь обработки и затем начните чат.",
      addDocuments: "Добавить документы",
      firstMessage: "Ваше первое сообщение",
      chatTitle: "Название чата",
      chatTitlePlaceholder: "Введите название чата",
      knowledgeBase: "База знаний",
      multipleSelectionSoon: "Множественный выбор скоро появится...",
      selectKbError: "Выберите базу знаний с обработанными документами",
      failedCreateChat: "Не удалось создать чат",
      startChat: "Начать чат",
      strictSources: "Строго по документам",
      strictSourcesHint:
        "Ответ строится только по найденным фрагментам. Если данных нет, бот честно скажет, чего не хватает.",
      documentWizard: "Мастер документов",
      documentWizardHint:
        "Для ДИ / ПП / РИ спросит недостающие поля и подготовит DOCX по шаблону.",
      documentWizardMode: "Мастер документов включён",
      templateAuto: "Авто",
      templateDi: "ДИ",
      templatePp: "ПП",
      templateRi: "РИ",
    },
    knowledge: {
      listTitle: "Базы знаний",
      listDescription:
        "Добавляйте документы здесь, а затем задавайте вопросы по ним в чате",
      newKb: "Новая база знаний",
      addDocuments: "Добавить документы",
      ask: "Спросить",
      documentsTitle: "Документы",
      noKbTitle: "Базы знаний пока нет",
      noKbDescription:
        "Создайте базу знаний, загрузите документы, и ALTBot будет использовать их как контекст для ответов.",
      createKb: "Создать базу знаний",
      loadingKbs: "Загрузка баз знаний...",
      confirmDelete: "Вы уверены, что хотите удалить эту базу знаний?",
      deleteSuccess: "База знаний успешно удалена",
      viewAllDocuments: "Посмотреть все документы",
      detailTitle: "База знаний",
      detailDescription:
        "Добавьте документы — после обработки чат будет отвечать по ним.",
      startChat: "Начать чат",
      dialogTitle: "Добавить документы",
      dialogDescription:
        "Загрузите PDF, DOCX, Markdown, Text файлы или изображения. ALTBot разделит их на searchable chunks и использует в ответах чата.",
      uploadNudge:
        "Чтобы ответить на ваш вопрос, сначала загрузите документы в эту базу знаний. После обработки можно вернуться в чат.",
      inspectorTitle: "Инспектор базы знаний",
      inspectorDescription:
        "Проверяйте статус индексации, количество chunks, ошибки и тестовый поиск.",
      documentsLoaded: "Загружено документов",
      chunksCreated: "Создано chunks",
      vectorRecords: "Записей vector store",
      failedIndexing: "Не проиндексировано",
      notIndexedTitle: "Документы без индекса",
      allIndexed: "Все документы проиндексированы.",
      reindexStarted: "Переиндексация запущена",
      testSearch: "Тестовый поиск",
      testSearchPlaceholder: "Введите вопрос и посмотрите, какие фрагменты найдёт бот...",
      searchResults: "Найденные фрагменты",
      noSearchResults: "Фрагменты не найдены.",
      score: "Похожесть",
      source: "Источник",
      newTitle: "Создать базу знаний",
      newDescription: "Создайте новую базу знаний для хранения документов",
      nameLabel: "Название",
      namePlaceholder: "Введите название базы знаний",
      descriptionLabel: "Описание",
      descriptionPlaceholder: "Введите описание базы знаний",
      failedCreate: "Не удалось создать базу знаний",
    },
    documents: {
      loading: "Загрузка документов...",
      failedFetch: "Не удалось загрузить документы",
      emptyTitle: "Пока нет документов",
      emptyDescription:
        "Загрузите первый документ, чтобы начать формировать базу знаний.",
      uploadLabel: "Загрузка",
      previewLabel: "Предпросмотр",
      processLabel: "Обработка",
      dropzone: "Перетащите файлы сюда или нажмите, чтобы выбрать",
      supports: "Поддерживаются PDF, DOCX, TXT, MD и изображения",
      uploadFiles: "Загрузить файлы",
      uploaded: "Загружено",
      uploadSuccessful: "Загрузка успешна",
      uploadSuccessfulDescription: "файлов успешно загружено.",
      uploadFailed: "Загрузка не удалась",
      somethingWentWrong: "Что-то пошло не так",
      previewGenerated: "Предпросмотр создан",
      previewGeneratedDescription: "Предпросмотр документа успешно создан.",
      previewFailed: "Предпросмотр не удался",
      processingFailed: "Обработка не удалась",
      processingCompleted: "Обработка завершена",
      processingCompletedDescription: "Все документы успешно обработаны.",
      processingCompletedWithErrors: "Обработка завершена с ошибками",
      processingCompletedWithErrorsDescription:
        "Некоторые документы не удалось обработать.",
      statusCheckFailed: "Не удалось проверить статус",
      selectDocumentToPreview: "Выберите документ для предпросмотра",
      selectDocumentPlaceholder: "Выберите документ для предпросмотра",
      advancedSettings: "Расширенные настройки",
      chunkSize: "Размер чанка (токены)",
      chunkOverlap: "Перекрытие чанков (токены)",
      previewChunks: "Предпросмотр чанков",
      continue: "Продолжить",
      chunks: "чанков",
      chunk: "Чанк",
      status: "Статус",
      pending: "ожидает",
      processing: "обрабатывается",
      completed: "готово",
      failed: "ошибка",
      process: "Обработать",
      processingLabel: "Обработка...",
    },
    answer: {
      downloadDocument: "Скачать документ",
      debugInfo: "Техническая информация:",
      foundFragments: "Найденные фрагменты",
      showFoundFragments: "Показать найденные фрагменты",
      hideFoundFragments: "Скрыть фрагменты",
    },
  },
} as const;

export type Language = keyof typeof translations;

const DEFAULT_LANGUAGE: Language = "kk";
const STORAGE_KEY = "altbot.language";

const languageLabels: Record<Language, string> = {
  kk: "Қазақша",
  en: "English",
  ru: "Русский",
};

interface I18nContextValue {
  language: Language;
  setLanguage: (language: Language) => void;
  copy: (typeof translations)[Language];
  languageLabels: Record<Language, string>;
}

const I18nContext = createContext<I18nContextValue | null>(null);

const isLanguage = (value: string | null): value is Language =>
  value === "kk" || value === "en" || value === "ru";

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(DEFAULT_LANGUAGE);

  useEffect(() => {
    const savedLanguage = window.localStorage.getItem(STORAGE_KEY);
    if (isLanguage(savedLanguage)) {
      setLanguageState(savedLanguage);
      document.documentElement.lang = savedLanguage;
      return;
    }

    document.documentElement.lang = DEFAULT_LANGUAGE;
  }, []);

  const setLanguage = (nextLanguage: Language) => {
    setLanguageState(nextLanguage);
    window.localStorage.setItem(STORAGE_KEY, nextLanguage);
    document.documentElement.lang = nextLanguage;
  };

  const value = useMemo<I18nContextValue>(
    () => ({
      language,
      setLanguage,
      copy: translations[language],
      languageLabels,
    }),
    [language]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used inside LanguageProvider");
  }
  return context;
}
