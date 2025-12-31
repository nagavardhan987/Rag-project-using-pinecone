import os
from langchain_pinecone import PineconeVectorStore
from main import rag_pipeline, PINECONE_INDEX_NAME, PINECONE_API_KEY

PDF_DIR = "./documents"

def ingest_all_pdfs():
    for fname in os.listdir(PDF_DIR):
        if not fname.lower().endswith(".pdf"):
            continue

        pdf_path = os.path.join(PDF_DIR, fname)
        print(f"Ingesting {pdf_path} ...")

        chunks = rag_pipeline.load_documents(pdf_path)

        namespace = fname.replace(".pdf", "")
        PineconeVectorStore.from_documents(
            documents=chunks,
            embedding=rag_pipeline.embeddings,
            index_name=PINECONE_INDEX_NAME,
            namespace=namespace,
            pinecone_api_key=PINECONE_API_KEY,
        )

    print("Done ingesting all PDFs.")

if __name__ == "__main__":
    ingest_all_pdfs()
