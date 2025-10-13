from fastapi import FastAPI, Depends, HTTPException, status, UploadFile, File, Form
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine, Column, Integer, String, ForeignKey, DateTime
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from pydantic import BaseModel
from datetime import datetime, timedelta
from jinja2 import Template
from typing import List, Optional
from pymongo import MongoClient
import jwt
import os
from dotenv import load_dotenv
import PyPDF2
from transformers import pipeline
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import requests  # For mock OCDS API

load_dotenv()

app = FastAPI()

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Databases
DATABASE_URL = os.getenv("DATABASE_URL")
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

MONGO_URL = os.getenv("MONGO_URL")
mongo_client = MongoClient(MONGO_URL)
mongo_db = mongo_client["tenderhub"]
summaries_collection = mongo_db["summaries"]

JWT_SECRET = os.getenv("JWT_SECRET")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

# AI Pipeline
summarizer = pipeline("summarization", model=os.getenv("HUGGINGFACE_MODEL", "facebook/bart-large-cnn"))

# Models (SQL)
class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    password = Column(String)  # Hashed in prod
    team_id = Column(Integer, ForeignKey("teams.id"))

class Team(Base):
    __tablename__ = "teams"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    plan = Column(String)  # free, basic, pro
    users = relationship("User")

class CompanyProfile(Base):
    __tablename__ = "company_profiles"
    id = Column(Integer, primary_key=True, index=True)
    team_id = Column(Integer, ForeignKey("teams.id"))
    sector = Column(String)
    services = Column(String)
    certifications = Column(String)
    coverage = Column(String)
    experience = Column(Integer)
    contact = Column(String)

class Tender(Base):
    __tablename__ = "tenders"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String)
    description = Column(String)
    province = Column(String)
    deadline = Column(DateTime)
    buyer = Column(String)
    budget = Column(Integer)

class Workspace(Base):
    __tablename__ = "workspaces"
    id = Column(Integer, primary_key=True, index=True)
    team_id = Column(Integer, ForeignKey("teams.id"))
    tender_id = Column(Integer, ForeignKey("tenders.id"))
    status = Column(String, default="Pending")
    updated_by = Column(String)
    updated_at = Column(DateTime, default=datetime.utcnow)

Base.metadata.create_all(bind=engine)

# Pydantic Models
class UserCreate(BaseModel):
    username: str
    password: str
    team_name: str
    plan: str = "free"

class Token(BaseModel):
    access_token: str
    token_type: str

class CompanyProfileModel(BaseModel):
    sector: str
    services: str
    certifications: str
    coverage: str
    experience: int
    contact: str

class TenderSearch(BaseModel):
    keywords: str

class TenderFilter(BaseModel):
    province: Optional[str]
    deadline_start: Optional[datetime]
    deadline_end: Optional[datetime]
    buyer: Optional[str]
    budget_min: Optional[int]
    budget_max: Optional[int]

class ReadinessCheck(BaseModel):
    tender_id: int
    profile: CompanyProfileModel

# Auth
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

def get_current_user(token: str = Depends(oauth2_scheme)):
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        return username
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, JWT_SECRET, algorithm=ALGORITHM)
    return encoded_jwt

# Mock OCDS API Fetch
def fetch_tenders_from_ocds(keywords: str):
    # Mock data; replace with real requests.get("https://etenders.api.endpoint?query=" + keywords)
    mock_tenders = [
        {"id": 1, "title": "Road Construction", "description": "Build roads in Gauteng", "province": "Gauteng", "deadline": datetime(2025, 12, 31), "buyer": "Dept of Transport", "budget": 1000000},
        {"id": 2, "title": "Security Services", "description": "Provide security in Western Cape", "province": "Western Cape", "deadline": datetime(2025, 11, 15), "buyer": "Dept of Safety", "budget": 500000},
    ]
    # Filter by keywords
    return [t for t in mock_tenders if any(kw.lower() in t["description"].lower() for kw in keywords.split())]

# Endpoints

@app.post("/token", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends()):
    db = SessionLocal()
    user = db.query(User).filter(User.username == form_data.username).first()
    if not user or user.password != form_data.password:  # Hash in prod
        raise HTTPException(status_code=400, detail="Incorrect username or password")
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(data={"sub": user.username}, expires_delta=access_token_expires)
    return {"access_token": access_token, "token_type": "bearer"}

@app.post("/users/")
def create_user(user: UserCreate):
    db = SessionLocal()
    team = Team(name=user.team_name, plan=user.plan)
    db.add(team)
    db.commit()
    db.refresh(team)
    db_user = User(username=user.username, password=user.password, team_id=team.id)  # Hash password
    db.add(db_user)
    db.commit()
    return {"message": "User created"}

# 1. Keyword Search & Filtering
@app.post("/search/")
def search_tenders(search: TenderSearch, current_user: str = Depends(get_current_user)):
    tenders = fetch_tenders_from_ocds(search.keywords)
    # Save to DB if needed
    db = SessionLocal()
    for t in tenders:
        existing = db.query(Tender).filter(Tender.id == t["id"]).first()
        if not existing:
            db_tender = Tender(**t)
            db.add(db_tender)
            db.commit()
    return tenders

@app.post("/filter/")
def filter_tenders(filters: TenderFilter, current_user: str = Depends(get_current_user)):
    db = SessionLocal()
    query = db.query(Tender)
    if filters.province:
        query = query.filter(Tender.province == filters.province)
    if filters.deadline_start:
        query = query.filter(Tender.deadline >= filters.deadline_start)
    if filters.deadline_end:
        query = query.filter(Tender.deadline <= filters.deadline_end)
    if filters.buyer:
        query = query.filter(Tender.buyer == filters.buyer)
    if filters.budget_min:
        query = query.filter(Tender.budget >= filters.budget_min)
    if filters.budget_max:
        query = query.filter(Tender.budget <= filters.budget_max)
    return query.all()

# 2. Company Profile Management
@app.post("/profile/")
def create_profile(profile: CompanyProfileModel, current_user: str = Depends(get_current_user)):
    db = SessionLocal()
    user = db.query(User).filter(User.username == current_user).first()
    db_profile = CompanyProfile(**profile.dict(), team_id=user.team_id)
    db.add(db_profile)
    db.commit()
    return {"message": "Profile created"}

@app.put("/profile/{profile_id}")
def update_profile(profile_id: int, profile: CompanyProfileModel, current_user: str = Depends(get_current_user)):
    db = SessionLocal()
    db_profile = db.query(CompanyProfile).filter(CompanyProfile.id == profile_id).first()
    if not db_profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    for key, value in profile.dict().items():
        setattr(db_profile, key, value)
    db.commit()
    return {"message": "Profile updated"}

# 3. Tender Document Summarization
@app.post("/summary/extract")
def extract_summary(file: UploadFile = File(...), current_user: Optional[str] = Depends(get_current_user)):
    # Plan check
    if current_user:
        db = SessionLocal()
        user = db.query(User).filter(User.username == current_user).first()
        team = db.query(Team).filter(Team.id == user.team_id).first()
        if team.plan == "free":
            raise HTTPException(status_code=403, detail="AI features not available on free plan")
    
    # Extract text
    pdf_reader = PyPDF2.PdfReader(file.file)
    text = ""
    for page in pdf_reader.pages:
        text += page.extract_text()
    
    # Summarize
    summary = summarizer(text, max_length=120, min_length=30, do_sample=False)[0]['summary_text']
    
    # Store in Mongo
    summary_id = summaries_collection.insert_one({"summary": summary, "created_at": datetime.utcnow()}).inserted_id
    return {"summary": summary, "id": str(summary_id)}

# 4. Readiness Scoring
@app.post("/readiness/check")
def check_readiness(check: ReadinessCheck, current_user: str = Depends(get_current_user)):
    db = SessionLocal()
    tender = db.query(Tender).filter(Tender.id == check.tender_id).first()
    if not tender:
        raise HTTPException(status_code=404, detail="Tender not found")
    
    # Get summary from Mongo (assume stored)
    summary_doc = summaries_collection.find_one({"tender_id": check.tender_id})
    summary = summary_doc["summary"] if summary_doc else "No summary"
    
    # Simple scoring: TF-IDF similarity + rule-based
    vectorizer = TfidfVectorizer()
    docs = [summary, check.profile.services + " " + check.profile.certifications + " " + check.profile.coverage]
    tfidf = vectorizer.fit_transform(docs)
    sim = cosine_similarity(tfidf[0:1], tfidf[1:2])[0][0]
    score = int(sim * 100)
    
    checklist = {
        "Has required CIDB": "YES" if "CIDB" in check.profile.certifications else "NO",
        "Operates in Province": "YES" if tender.province in check.profile.coverage else "NO",
    }
    recommendation = "Suitable - low competition expected" if score > 70 else "Not Suitable"
    
    # Store in Mongo
    summaries_collection.update_one({"tender_id": check.tender_id}, {"$set": {"score": score, "checklist": checklist, "recommendation": recommendation}}, upsert=True)
    
    return {"score": score, "checklist": checklist, "recommendation": recommendation}

# 5. Workspace & Tracking
@app.post("/workspace/save/{tender_id}")
def save_to_workspace(tender_id: int, status: str = Form("Pending"), current_user: str = Depends(get_current_user)):
    db = SessionLocal()
    user = db.query(User).filter(User.username == current_user).first()
    workspace = Workspace(team_id=user.team_id, tender_id=tender_id, status=status, updated_by=current_user)
    db.add(workspace)
    db.commit()
    
    # Log in Mongo
    summaries_collection.insert_one({"log": f"Status changed to {status} by {current_user}", "tender_id": tender_id})
    return {"message": "Saved to workspace"}

@app.get("/workspace/")
def get_workspace(current_user: str = Depends(get_current_user)):
    db = SessionLocal()
    user = db.query(User).filter(User.username == current_user).first()
    workspaces = db.query(Workspace).filter(Workspace.team_id == user.team_id).all()
    
    # Fetch scores from Mongo and sort
    results = []
    for ws in workspaces:
        tender = db.query(Tender).filter(Tender.id == ws.tender_id).first()
        summary_doc = summaries_collection.find_one({"tender_id": ws.tender_id})
        score = summary_doc.get("score", 0) if summary_doc else 0
        results.append({
            "title": tender.title,
            "deadline": tender.deadline,
            "summary": summary_doc.get("summary", "") if summary_doc else "",
            "score": score,
            "status": ws.status
        })
    results.sort(key=lambda x: x["score"], reverse=True)
    return results

@app.post("/workspace/note/{workspace_id}")
def add_note(workspace_id: int, note: str = Form(...), current_user: str = Depends(get_current_user)):
    # Store note in Mongo
    summaries_collection.insert_one({"note": note, "workspace_id": workspace_id, "user": current_user})
    return {"message": "Note added"}

# Public APIs
@app.get("/api/enriched-releases")
def enriched_releases():
    db = SessionLocal()
    tenders = db.query(Tender).all()
    enriched = []
    for t in tenders:
        summary_doc = summaries_collection.find_one({"tender_id": t.id})
        enriched.append({
            "metadata": t.__dict__,
            "summary": summary_doc.get("summary") if summary_doc else "",
            "score": summary_doc.get("score") if summary_doc else 0
        })
    return enriched

@app.get("/api/analytics/spend-by-buyer")
def spend_by_buyer():
    db = SessionLocal()
    # Aggregate (simple group by)
    from sqlalchemy.sql import func
    results = db.query(Tender.buyer, func.sum(Tender.budget)).group_by(Tender.buyer).all()
    return [{"buyer": r[0], "total_spend": r[1]} for r in results]

# Export for Pro (example)
@app.get("/export/workspace")
def export_workspace(current_user: str = Depends(get_current_user)):
    db = SessionLocal()
    user = db.query(User).filter(User.username == current_user).first()
    team = db.query(Team).filter(Team.id == user.team_id).first()
    if team.plan != "pro":
        raise HTTPException(status_code=403, detail="Export available on Pro plan only")
    # Generate CSV or PDF; here mock
    return {"message": "Exported (mock)"}

# Plan Checks (integrated in endpoints)
# Seat Limits: Check user count vs plan in create_user, etc.

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)