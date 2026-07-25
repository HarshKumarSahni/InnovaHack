# backend/main.py
from fastapi import FastAPI, Depends, HTTPException, status, UploadFile, File, Form, APIRouter
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from database import SessionLocal, engine, Base
from models import User
from schemas import (
    UserCreate, UserLogin, UserResponse,
    OnboardingCreate, OnboardingResponse, OnboardingUpdate
)
from crud import (
    get_user_by_email, create_user, get_user_by_id,
    create_onboarding_data, get_onboarding_data_by_user_id,
    update_onboarding_data, update_user_onboarding_status,
    get_syllabuses_by_user_id, get_syllabus_by_id,
    parse_syllabus_file, create_user_syllabus, delete_syllabus_by_id
)
from auth import verify_password, create_access_token, get_current_user_from_token

from typing import Dict, List, Optional
from pydantic import BaseModel
import os

# Since uvicorn runs from 'src', Python can find MockTestAutomation directly
from services.Generation import run_generation_task
from services.PromptsDict import prompt_templates

# Initialize Database
Base.metadata.create_all(bind=engine)

app = FastAPI(title="AceTrack API", version="1.0.0")

# --- Pydantic Models for Mock Test Generator ---
class QuestionGenerationRequest(BaseModel):
    question_plan: Dict[str, int]
    testing_mode: bool = False
    exam_name: str
    output_format: str = 'pdf'
    questions_per_chunk: int
    syllabus_id: int 

class QuestionGenerationResponse(BaseModel):
    success: bool
    message: str
    files: Optional[Dict[str, str]] = None

class QuestionType(BaseModel):
    name: str
    description: str

class SyllabusResponse(BaseModel):
    id: int
    name: str
    created_at: str
    topic_count: int

# --- CORS Middleware ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Database Dependency ---
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# --- Create Router with /api prefix ---
api_router = APIRouter(prefix="/api")

# ===============================================================
# === MOCK TEST GENERATOR API ENDPOINTS ===
# ===============================================================

@api_router.get("/question-types", response_model=List[QuestionType])
async def get_question_types():
    descriptions = {
        "MTF": "Match the Following questions.", "2S": "Two-statement reasoning questions.",
        "3S": "Three-statement analysis questions.", "4S": "Four-statement analysis questions.",
        "5S": "Five-statement, highly analytical questions.", "SL": "Single-liner scenario-based questions.",
        "AR": "Assertion and Reasoning questions.", "CS": "Case study comprehension questions.",
        "CH": "Chronological ordering questions.", "FU": "Fill in the Blanks questions.",
        "MCQ": "Multiple choice questions.", "NU": "Numerical answer type questions."
    }
    try:
        if not prompt_templates:
            raise HTTPException(status_code=500, detail="Prompt templates are not loaded.")
        return [
            QuestionType(name=qtype, description=descriptions.get(qtype, f"Generate {qtype} questions."))
            for qtype in prompt_templates.keys()
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error loading question types: {str(e)}")

@api_router.post("/generate-questions", response_model=QuestionGenerationResponse)
async def generate_questions(
    request: QuestionGenerationRequest,
    current_user: dict = Depends(get_current_user_from_token),
    db: Session = Depends(get_db)
):
    try:
        user = db.query(User).filter(User.id == current_user["user_id"]).first()
        if not user or not user.is_authorized:
            raise HTTPException(
                status_code=403, 
                detail="Your account does not have generation permissions yet. Please contact support."
            )
        syllabus = get_syllabus_by_id(db, request.syllabus_id, current_user["user_id"])
        if not syllabus:
            raise HTTPException(status_code=404, detail="Syllabus not found or you don't have access to it")
        
        result = run_generation_task(
            plan=request.question_plan,
            testing_mode=request.testing_mode,
            exam_name=request.exam_name,
            output_format=request.output_format,
            questions_per_chunk=request.questions_per_chunk,
            topics=syllabus.topics
        )
        if not result["success"]:
            raise HTTPException(status_code=500, detail=result["message"])

        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An unexpected error occurred: {str(e)}")

@api_router.get("/wakeup")
async def wakeup():
    return {"mssg":"I am ready"}

@api_router.get("/download-questions/{filename}")
async def download_questions_file(
    filename: str,
    current_user: dict = Depends(get_current_user_from_token)
):
    if ".." in filename or "/" in filename:
        raise HTTPException(status_code=400, detail="Invalid filename.")
    
    current_script_dir = os.path.dirname(os.path.abspath(__file__))
    file_path = os.path.join(current_script_dir, "data", "generated_files", filename)

    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail=f"File not found.")
    
    return FileResponse(path=file_path, filename=filename, media_type='application/pdf')

# ===============================================================
# === SYLLABUS API ENDPOINTS ===
# ===============================================================

@api_router.get("/syllabus", response_model=List[SyllabusResponse])
async def get_user_syllabuses(
    current_user: dict = Depends(get_current_user_from_token),
    db: Session = Depends(get_db)
):
    syllabuses = get_syllabuses_by_user_id(db, current_user["user_id"])
    return [
        SyllabusResponse(
            id=s.id, name=s.name, created_at=s.created_at.isoformat(), topic_count=len(s.topics)
        ) for s in syllabuses
    ]

@api_router.post("/syllabus/upload")
async def upload_syllabus(
    name: str = Form(...),
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user_from_token),
    db: Session = Depends(get_db)
):
    try:
        if not file.filename.endswith(('.xlsx', '.xls')):
            raise HTTPException(status_code=400, detail="Only .xlsx and .xls files allowed.")
        topics = parse_syllabus_file(file.file)
        syllabus = create_user_syllabus(db, current_user["user_id"], name, topics)
        return SyllabusResponse(
            id=syllabus.id, name=syllabus.name, created_at=syllabus.created_at.isoformat(), topic_count=len(syllabus.topics)
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")

@api_router.delete("/syllabus/{syllabus_id}")
async def delete_syllabus(
    syllabus_id: int,
    current_user: dict = Depends(get_current_user_from_token),
    db: Session = Depends(get_db)
):
    success = delete_syllabus_by_id(db, syllabus_id, current_user["user_id"])
    if not success:
        raise HTTPException(status_code=404, detail="Syllabus not found")
    return {"message": "Syllabus deleted successfully"}

# ===============================================================
# === USER AUTH & ONBOARDING ENDPOINTS ===
# ===============================================================

@api_router.post("/signup", response_model=UserResponse)
def signup(user: UserCreate, db: Session = Depends(get_db)):
    db_user = get_user_by_email(db, user.email)
    if db_user: 
        raise HTTPException(status_code=400, detail="Email already registered")
    new_user = create_user(db, user)
    return UserResponse(id=new_user.id, email=new_user.email, has_completed_onboarding=new_user.has_completed_onboarding)

@api_router.post("/login")
def login(user: UserLogin, db: Session = Depends(get_db)):
    db_user = get_user_by_email(db, user.email)
    if not db_user or not verify_password(user.password, db_user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    access_token = create_access_token(data={"sub": db_user.email, "user_id": db_user.id})
    return {
        "access_token": access_token, 
        "token_type": "bearer", 
        "user": {
            "id": db_user.id, "email": db_user.email, "has_completed_onboarding": db_user.has_completed_onboarding
        }
    }

@api_router.get("/me", response_model=UserResponse)
def get_current_user(current_user: dict = Depends(get_current_user_from_token), db: Session = Depends(get_db)):
    user = get_user_by_id(db, current_user["user_id"])
    if not user: 
        raise HTTPException(status_code=404, detail="User not found")
    return UserResponse(id=user.id, email=user.email, has_completed_onboarding=user.has_completed_onboarding)

@api_router.post("/onboarding", response_model=OnboardingResponse)
def create_user_onboarding(onboarding_data: OnboardingCreate, current_user: dict = Depends(get_current_user_from_token), db: Session = Depends(get_db)):
    user_id = current_user["user_id"]
    if get_onboarding_data_by_user_id(db, user_id): 
        raise HTTPException(status_code=400, detail="Onboarding already completed.")
    db_onboarding = create_onboarding_data(db, user_id, onboarding_data)
    update_user_onboarding_status(db, user_id, True)
    return db_onboarding

@api_router.get("/onboarding", response_model=OnboardingResponse)
def get_user_onboarding(current_user: dict = Depends(get_current_user_from_token), db: Session = Depends(get_db)):
    user_id = current_user["user_id"]
    onboarding_data = get_onboarding_data_by_user_id(db, user_id)
    if not onboarding_data: 
        raise HTTPException(status_code=404, detail="Onboarding data not found")
    return onboarding_data

@api_router.put("/onboarding", response_model=OnboardingResponse)
def update_user_onboarding(onboarding_update: OnboardingUpdate, current_user: dict = Depends(get_current_user_from_token), db: Session = Depends(get_db)):
    user_id = current_user["user_id"]
    try:
        updated_onboarding = update_onboarding_data(db, user_id, onboarding_update)
        return updated_onboarding
    except Exception:
        raise HTTPException(status_code=500, detail="Update failed")

@api_router.get("/onboarding/status")
def check_onboarding_status(current_user: dict = Depends(get_current_user_from_token), db: Session = Depends(get_db)):
    user = get_user_by_id(db, current_user["user_id"])
    if not user: 
        raise HTTPException(status_code=404, detail="User not found")
    return {"has_completed_onboarding": user.has_completed_onboarding, "user_id": user.id}

# --- Include the router in the app ---
app.include_router(api_router)

# Root endpoint for health checks
# @app.get("/")
# def read_root(): 
#     return {"message": "AceTrack API is running!"}
# Change your existing @app.get("/") to this:
@app.api_route("/", methods=["GET", "HEAD"])
async def read_root(): 
    return {"message": "AceTrack API is running!"}