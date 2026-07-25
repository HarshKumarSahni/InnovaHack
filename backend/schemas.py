from pydantic import BaseModel, EmailStr
from datetime import date, datetime
from typing import Optional, List
from enum import Enum

class UserCreate(BaseModel):
    email: EmailStr
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: int
    email: EmailStr
    has_completed_onboarding: bool

    class Config:
        from_attributes = True

class PreparationLevel(str, Enum):
    beginner = "beginner"
    intermediate = "intermediate"
    advanced = "advanced"

class StudyTime(str, Enum):
    morning = "morning"
    afternoon = "afternoon"
    evening = "evening"
    night = "night"

class OnboardingCreate(BaseModel):
    exam_name: str
    exam_date: date
    current_preparation_level: PreparationLevel
    daily_study_hours: int
    preferred_study_time: StudyTime
    topics_covered: Optional[List[str]] = []
    weak_subjects: Optional[List[str]] = []
    strong_subjects: Optional[List[str]] = []
    additional_notes: Optional[str] = None

class OnboardingResponse(BaseModel):
    id: int
    user_id: int
    exam_name: str
    exam_date: date
    current_preparation_level: str
    daily_study_hours: int
    preferred_study_time: str
    topics_covered: Optional[List[str]] = []
    weak_subjects: Optional[List[str]] = []
    strong_subjects: Optional[List[str]] = []
    additional_notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class OnboardingUpdate(BaseModel):
    exam_name: Optional[str] = None
    exam_date: Optional[date] = None
    current_preparation_level: Optional[PreparationLevel] = None
    daily_study_hours: Optional[int] = None
    preferred_study_time: Optional[StudyTime] = None
    topics_covered: Optional[List[str]] = None
    weak_subjects: Optional[List[str]] = None
    strong_subjects: Optional[List[str]] = None
    additional_notes: Optional[str] = None