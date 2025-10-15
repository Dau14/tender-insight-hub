from fastapi import FastAPI, UploadFile, File, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine, Column, Integer, String, DateTime
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from sqlalchemy.exc import OperationalError
from pymongo import MongoClient
from dotenv import load_dotenv
import os
import PyPDF2
from transformers import pipeline
from datetime import datetime
import logging
import re
import time
from typing import Optional

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = FastAPI()

# CORS setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://Dau14.github.io"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load environment variables
load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")
MONGO_URL = os.getenv("MONGO_URL")

if not DATABASE_URL or not MONGO_URL:
    logger.error("Missing DATABASE_URL or MONGO_URL in .env")
    raise ValueError("Missing DATABASE_URL or MONGO_URL in .env")

# PostgreSQL setup with connection pooling
try:
    engine = create_engine(DATABASE_URL, pool_size=5, max_overflow=10, pool_timeout=30, pool_pre_ping=True)
    Base = declarative_base()

    class Tender(Base):
        __tablename__ = "tenders"
        id = Column(Integer, primary_key=True, index=True)
        title = Column(String)
        province = Column(String)
        deadline = Column(DateTime)
        buyer = Column(String)
        budget = Column(Integer)
        uploaded_at = Column(DateTime, default=datetime.utcnow)

    Base.metadata.create_all(bind=engine)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    logger.info("PostgreSQL connection established")
except Exception as e:
    logger.error(f"PostgreSQL connection failed: {str(e)}")
    raise

# MongoDB setup
try:
    mongo_client = MongoClient(MONGO_URL)
    mongo_db = mongo_client.tenderhub
    summaries_collection = mongo_db.summaries
    logger.info("MongoDB connection established")
except Exception as e:
    logger.error(f"MongoDB connection failed: {str(e)}")
    raise

# Hugging Face summarizer with DistilBART
summarizer = None
try:
    summarizer = pipeline("summarization", model="sshleifer/distilbart-cnn-6-6")
    logger.info("DistilBART model loaded successfully")
except Exception as e:
    logger.error(f"Failed to load DistilBART model: {str(e)}")
    logger.info("Using fallback summarization")

def clean_text(text: str) -> str:
    if not text:
        return ""
    text = re.sub(r'\s+', ' ', text.strip())
    text = re.sub(r'[^\x20-\x7E]', '', text)
    return text

def summarize_text(text: str, max_length: int = 120, min_length: int = 30) -> str:
    text = clean_text(text)
    if not text:
        logger.warning("No valid text for summarization")
        return "No text available for summarization"
    
    max_chars = 4000
    if len(text) > max_chars:
        logger.info(f"Truncating text from {len(text)} to {max_chars} characters")
        text = text[:max_chars]
    
    if summarizer:
        try:
            result = summarizer(text, max_length=max_length, min_length=min_length, do_sample=False, truncation=True)
            return clean_text(result[0]["summary_text"])
        except Exception as e:
            logger.error(f"Summarization failed: {str(e)}")
    
    sentences = text.split('. ')
    if len(sentences) > 3:
        return '. '.join(sentences[:3]) + '.'
    return text[:300] + '...' if len(text) > 300 else text

def get_db():
    max_retries = 3
    for attempt in range(max_retries):
        try:
            db = SessionLocal()
            yield db
            break
        except OperationalError as e:
            logger.warning(f"Database connection attempt {attempt + 1} failed: {str(e)}")
            if attempt == max_retries - 1:
                raise
            time.sleep(2 ** attempt)  # Exponential backoff
        finally:
            db.close()

@app.get("/health")
async def health_check():
    return {"status": "Backend is running", "summarizer": summarizer is not None}

@app.post("/upload")
async def upload_tender(file: UploadFile = File(...), db: SessionLocal = Depends(get_db)):
    logger.info(f"Received upload request for file: {file.filename}")
    if not file.filename.endswith(".pdf"):
        logger.error("Invalid file type: Only PDF files are allowed")
        raise HTTPException(status_code=400, detail="Only PDF files are allowed")
    
    try:
        contents = await file.read()
        if not contents:
            logger.error("Uploaded file is empty")
            raise HTTPException(status_code=400, detail="Uploaded file is empty")
        
        from io import BytesIO
        pdf_reader = PyPDF2.PdfReader(BytesIO(contents))
        if len(pdf_reader.pages) == 0:
            logger.error("PDF has no pages")
            raise HTTPException(status_code=400, detail="PDF has no pages")
        
        text = ""
        for page_num in range(min(len(pdf_reader.pages), 10)):
            try:
                page = pdf_reader.pages[page_num]
                extracted = page.extract_text()
                if extracted:
                    text += extracted + " "
            except Exception as e:
                logger.warning(f"Failed to extract text from page {page_num}: {str(e)}")
                continue
        
        if not text.strip():
            logger.error("No text extracted from PDF")
            raise HTTPException(status_code=400, detail="No text extracted from PDF")
        
        summary = summarize_text(text)
        tender = Tender(
            title=file.filename,
            province="Gauteng",
            deadline=datetime(2025, 11, 13),
            buyer="Government",
            budget=100000
        )
        db.add(tender)
        db.commit()
        tender_id = tender.id
        db.close()
        
        summaries_collection.insert_one({
            "tender_id": tender_id,
            "title": file.filename,
            "text": text[:2000],
            "summary": summary
        })
        
        logger.info(f"Upload successful for tender_id: {tender_id}")
        return {"tender_id": tender_id, "summary": summary}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Upload failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")

@app.get("/tenders")
async def get_tenders(db: SessionLocal = Depends(get_db)):
    try:
        tenders = db.query(Tender).all()
        tender_data = []
        for tender in tenders:
            summary_doc = summaries_collection.find_one({"tender_id": tender.id})
            summary = summary_doc["summary"] if summary_doc and "summary" in summary_doc else "No summary available"
            logger.info(f"Tender {tender.id} summary: {summary}")  # Debug log
            tender_data.append({
                "id": tender.id,
                "title": tender.title,
                "province": tender.province,
                "deadline": tender.deadline,
                "buyer": tender.buyer,
                "budget": tender.budget,
                "uploaded_at": tender.uploaded_at,
                "summary": summary
            })
        return tender_data
    except Exception as e:
        logger.error(f"Failed to fetch tenders: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch tenders: {str(e)}")

@app.get("/summary/{tender_id}")
async def get_summary(tender_id: int):
    try:
        summary = summaries_collection.find_one({"tender_id": tender_id})
        if not summary:
            logger.error(f"Summary not found for tender_id: {tender_id}")
            raise HTTPException(status_code=404, detail="Summary not found")
        return {"tender_id": summary["tender_id"], "summary": summary["summary"]}
    except Exception as e:
        logger.error(f"Failed to fetch summary for tender_id {tender_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch summary: {str(e)}")

@app.get("/stats")
async def get_stats(db: SessionLocal = Depends(get_db)):
    try:
        total_tenders = db.query(Tender).count()
        recent_tenders = db.query(Tender).filter(Tender.uploaded_at >= datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)).count()
        return {"total_tenders": total_tenders, "recent_tenders": recent_tenders}
    except Exception as e:
        logger.error(f"Failed to fetch stats: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch stats: {str(e)}")

@app.post("/profile")
async def update_profile(profile: dict):
    logger.info(f"Profile updated: {profile}")
    return {"message": "Profile updated successfully"}

@app.post("/readiness/check")
async def check_readiness(tender_id: int, profile: dict):
    summary = summaries_collection.find_one({"tender_id": tender_id})
    if not summary:
        raise HTTPException(status_code=404, detail="Tender not found")
    score = 70  # Placeholder: Improve with cosine similarity
    checklist = {"Has required CIDB": "CIDB" in profile.get("certifications", ""), "Operates in Province": True}
    recommendation = "Suitable - low competition expected"
    return {"suitabilityScore": score, "checklist": checklist, "recommendation": recommendation}

@app.get("/workspace")
async def get_workspace():
    return list(summaries_collection.find().limit(10))

@app.post("/workspace")
async def save_to_workspace(tender: dict):
    summaries_collection.insert_one(tender)
    return {"message": "Tender saved to workspace"}

@app.get("/enriched-releases")
async def get_enriched_releases():
    tenders = summaries_collection.find().limit(10)
    return [{"id": t["tender_id"], "title": t["title"], "summary": t["summary"], "suitabilityScore": 70} for t in tenders]

@app.get("/analytics/spend-by-buyer")
async def get_spend_by_buyer():
    return {"Government": 1000000, "Municipality": 500000}

@app.post("/summary/extract")
async def extract_summary(file: UploadFile = File(...)):
    contents = await file.read()
    from io import BytesIO
    pdf_reader = PyPDF2.PdfReader(BytesIO(contents))
    text = ""
    for page_num in range(min(len(pdf_reader.pages), 10)):
        page = pdf_reader.pages[page_num]
        extracted = page.extract_text()
        if extracted:
            text += extracted + " "
    summary = summarize_text(text)
    return {"summary": summary}
