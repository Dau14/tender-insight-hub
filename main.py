from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine, Column, Integer, String, DateTime
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from pymongo import MongoClient
from dotenv import load_dotenv
import os
import PyPDF2
from transformers import pipeline
from datetime import datetime

app = FastAPI()

# CORS setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://RamaanoDau.github.io"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load environment variables
load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")
MONGO_URL = os.getenv("MONGO_URL")

# PostgreSQL setup
engine = create_engine(DATABASE_URL)
Base = declarative_base()

class Tender(Base):
    __tablename__ = "tenders"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String)
    uploaded_at = Column(DateTime, default=datetime.utcnow)

Base.metadata.create_all(bind=engine)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# MongoDB setup
mongo_client = MongoClient(MONGO_URL)
mongo_db = mongo_client.tenderhub
summaries_collection = mongo_db.summaries

# Hugging Face summarizer
summarizer = pipeline("summarization", model="facebook/bart-large-cnn")

@app.get("/health")
async def health_check():
    return {"status": "Backend is running"}

@app.post("/upload")
async def upload_tender(file: UploadFile = File(...)):
    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are allowed")
    
    # Read PDF
    pdf_reader = PyPDF2.PdfReader(file.file)
    text = ""
    for page in pdf_reader.pages:
        text += page.extract_text() or ""
    
    # Summarize
    summary = summarizer(text, max_length=120, min_length=30, do_sample=False)[0]["summary_text"]
    
    # Store in PostgreSQL
    db = SessionLocal()
    tender = Tender(title=file.filename)
    db.add(tender)
    db.commit()
    tender_id = tender.id
    db.close()
    
    # Store in MongoDB
    summaries_collection.insert_one({"tender_id": tender_id, "text": text, "summary": summary})
    
    return {"tender_id": tender_id, "summary": summary}

@app.get("/tenders")
async def get_tenders():
    db = SessionLocal()
    tenders = db.query(Tender).all()
    db.close()
    return [{"id": t.id, "title": t.title, "uploaded_at": t.uploaded_at} for t in tenders]

@app.get("/summary/{tender_id}")
async def get_summary(tender_id: int):
    summary = summaries_collection.find_one({"tender_id": tender_id})
    if not summary:
        raise HTTPException(status_code=404, detail="Summary not found")
    return {"tender_id": summary["tender_id"], "summary": summary["summary"]}
