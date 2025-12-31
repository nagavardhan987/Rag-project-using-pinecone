from dotenv import load_dotenv
from pydantic import BaseModel
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_groq import ChatGroq
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import RunnablePassthrough
from langchain_community.document_loaders import PyMuPDFLoader
from langchain_core.documents import Document
from langchain_pinecone import PineconeVectorStore

from pinecone.grpc import PineconeGRPC as Pinecone  # gRPC client

import os
import re
from typing import List, Optional


# ---------- CONFIG ----------
load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")

# Pinecone config
PINECONE_API_KEY = os.getenv("PINECONE_API_KEY", "")
PINECONE_INDEX_NAME = os.getenv("PINECONE_INDEX_NAME", "sales")
PINECONE_HOST = os.getenv("PINECONE_HOST", "")  # e.g. https://sales-xxxx.svc.aped-xxx.pinecone.io

if not PINECONE_API_KEY or not PINECONE_HOST:
    raise ValueError("PINECONE_API_KEY and PINECONE_HOST must be set.")

# gRPC Pinecone client + index handle (for stats/debug)
pc = Pinecone(api_key=PINECONE_API_KEY)
index = pc.Index(PINECONE_INDEX_NAME, host=PINECONE_HOST)

DOCUMENTS_DIR = "./documents"
CHUNK_SIZE = 1000
CHUNK_OVERLAP = 200

os.makedirs(DOCUMENTS_DIR, exist_ok=True)


# ---------- FastAPI ----------
app = FastAPI(title="RAG System")

app.mount("/static", StaticFiles(directory=DOCUMENTS_DIR), name="static")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------- Models ----------
class QuestionRequest(BaseModel):
    question: str


class FactCheckRequest(BaseModel):
    claim: str
    namespace: Optional[str] = None  # optional override of namespace


# ---------- Embeddings & LLM ----------
embeddings = HuggingFaceEmbeddings(
    model_name="sentence-transformers/all-MiniLM-L6-v2"
)

llm = ChatGroq(
    model_name="llama-3.1-8b-instant",
    api_key=GROQ_API_KEY,
    temperature=0,
)


# ---------- Cleaning helper ----------
def clean_text_block(text: str) -> str:
    cleaned_lines = []
    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line:
            continue

        letters = sum(c.isalpha() for c in line)
        if letters < 4:
            continue

        noisy = sum(not (c.isalnum() or c.isspace()) for c in line)
        if noisy > 0 and noisy / max(len(line), 1) > 0.4:
            continue

        cleaned_lines.append(line)

    text = "\n".join(cleaned_lines)
    text = re.sub(r"\s+", " ", text).strip()
    return text


# ---------- QA prompt (strict document-only) ----------
qa_template = ChatPromptTemplate.from_template(
    """Use the following context to answer the question.

If the context does not contain the answer, say:
"I don't have this information in my knowledge base."

CONTEXT:
{context}

QUESTION: {question}

ANSWER:"""
)

# ---------- Fact-check prompt ----------
from langchain_core.prompts import ChatPromptTemplate

fact_check_template = ChatPromptTemplate.from_template(
    """
You are a strict fact-checking assistant for technical PDFs.

You receive:
- CONTEXT: text chunks extracted from the reference PDFs
- CLAIM: a single statement to verify

Task:
1. Decide if the CLAIM is:
   - SUPPORTED: clearly supported by the CONTEXT
   - REFUTED: clearly contradicted by the CONTEXT
   - NOT_ENOUGH_INFO: the CONTEXT is insufficient or unrelated
2. Explain your reasoning in 2–4 sentences.
3. Quote the most relevant sentences from the CONTEXT with page or chunk metadata when possible.

Always follow this JSON schema exactly:

{{
  "verdict": "SUPPORTED | REFUTED | NOT_ENOUGH_INFO",
  "reason": "short explanation",
  "evidence": ["quoted sentence 1", "quoted sentence 2"]
}}

CONTEXT:
{context}

CLAIM:
{claim}
"""
)


# ---------- RAG pipeline ----------
class RAGPipeline:
    def __init__(self, default_namespace: str = "documents"):
        self.embeddings = embeddings
        self.vectorstore: Optional[PineconeVectorStore] = None
        self.retriever = None
        self.qa_chain = None
        self.fact_check_chain = None
        self.namespace = default_namespace

    # --- namespace helper ---
    def set_namespace(self, namespace: str):
        self.namespace = namespace
        self.attach_existing_vectorstore(namespace=namespace)

    # ---------- Load and chunk documents ----------
    def load_documents(self, pdf_path: str) -> List[Document]:
        loader = PyMuPDFLoader(pdf_path)
        docs = loader.load()

        cleaned_docs: List[Document] = []
        for doc in docs:
            cleaned = clean_text_block(doc.page_content)
            if not cleaned:
                continue
            cleaned_docs.append(
                Document(page_content=cleaned, metadata=doc.metadata)
            )

        if not cleaned_docs:
            raise ValueError("No clean text could be extracted from the PDF.")

        splitter = RecursiveCharacterTextSplitter(
            chunk_size=CHUNK_SIZE,
            chunk_overlap=CHUNK_OVERLAP,
            length_function=len,
        )
        chunks = splitter.split_documents(cleaned_docs)
        print(f"✅ Loaded {len(chunks)} chunks from {pdf_path}")
        return chunks

    # ---------- Ingest chunks into Pinecone ----------
    def create_vectorstore(self, chunks: List[Document], namespace: str = None):
        if not chunks:
            raise ValueError("No chunks to index. Check PDF loading.")

        ns = namespace or self.namespace

        PineconeVectorStore.from_documents(
            documents=chunks,
            embedding=self.embeddings,
            index_name=PINECONE_INDEX_NAME,
            namespace=ns,
            pinecone_api_key=PINECONE_API_KEY,
        )
        print(f"✅ Indexed {len(chunks)} chunks into Pinecone (namespace: {ns})")

    # ---------- Attach to existing Pinecone index ----------
    def attach_existing_vectorstore(self, namespace: str | None = None):
        ns = namespace or self.namespace
        self.vectorstore = PineconeVectorStore(
            index_name=PINECONE_INDEX_NAME,
            embedding=self.embeddings,
            namespace=ns,
            pinecone_api_key=PINECONE_API_KEY,
        )
        self._setup_retrieval_chain()
        print(f"✅ Connected to Pinecone (namespace: {ns})")

    # ---------- Setup RAG chains ----------
    def _setup_retrieval_chain(self):
        if not self.vectorstore:
            raise ValueError("Vector store not initialized.")

        self.retriever = self.vectorstore.as_retriever(
            search_type="similarity",
            search_kwargs={"k": 10},
        )

        # QA chain
        qa_chain = (
            {"context": self.retriever, "question": RunnablePassthrough()}
            | qa_template
            | llm
            | StrOutputParser()
        )
        self.qa_chain = qa_chain
        self.fact_check_chain = None  # reset; will be built lazily

    # ---------- QA: Answer user questions ----------
    def answer_question(self, question: str) -> str:
        if not self.qa_chain:
            raise ValueError("QA chain not initialized. Call attach_existing_vectorstore() first.")
        return self.qa_chain.invoke(question)

    # ---------- Fact-check chain ----------
    def setup_fact_check_chain(self):
        if not self.retriever:
            raise ValueError("Retriever not initialized for fact checking")

        def _combine_context(claim: str):
            docs = self.retriever.invoke(claim)
            context = "\n\n".join(d.page_content for d in docs)
            return {"claim": claim, "context": context}

        self.fact_check_chain = (
            RunnablePassthrough()
            | _combine_context
            | fact_check_template
            | llm
            | StrOutputParser()
        )

    def fact_check(self, claim: str) -> str:
        if not self.fact_check_chain:
            self.setup_fact_check_chain()
        return self.fact_check_chain.invoke(claim)


# ✅ Initialize RAG pipeline and connect to existing namespace
rag_pipeline = RAGPipeline(default_namespace="documents")
rag_pipeline.attach_existing_vectorstore(namespace="documents")


# ---------- Routes ----------
@app.get("/")
def root():
    return {"status": "ok", "message": "RAG backend is running"}


@app.post("/upload-pdf")
async def upload_pdf(file: UploadFile = File(...)):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files allowed")

    pdf_path = os.path.join(DOCUMENTS_DIR, file.filename)
    try:
        with open(pdf_path, "wb") as f:
            f.write(await file.read())
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save file: {e}")

    try:
        chunks = rag_pipeline.load_documents(pdf_path)
        rag_pipeline.create_vectorstore(chunks, namespace="documents")
        # re-attach to ensure retriever sees new data
        rag_pipeline.attach_existing_vectorstore(namespace="documents")
        return {"status": "success", "chunks": len(chunks)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/query")
async def query_rag(req: QuestionRequest):
    if not rag_pipeline.qa_chain:
        raise HTTPException(
            status_code=400,
            detail="No documents loaded. Upload a PDF first.",
        )

    try:
        response = rag_pipeline.answer_question(req.question)
        return {"answer": response}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/fact_check")
async def fact_check_endpoint(req: FactCheckRequest):
    if not rag_pipeline:
        raise HTTPException(status_code=500, detail="RAG pipeline not initialized")

    if req.namespace:
        rag_pipeline.set_namespace(req.namespace)

    try:
        result = rag_pipeline.fact_check(req.claim)
        return {"claim": req.claim, "result": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/debug/pinecone-stats")
def check_pinecone():
    try:
        stats = index.describe_index_stats()
        total = getattr(stats, "total_vector_count", None)
        return {"message": f"Total vectors in index: {total}"}
    except Exception as e:
        return {"error": str(e)}


# ---------- Entrypoint ----------
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
