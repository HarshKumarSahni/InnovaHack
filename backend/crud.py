from sqlalchemy.orm import Session
from models import User, OnboardingData, Syllabus
from schemas import UserCreate, OnboardingCreate, OnboardingUpdate
from auth import hash_password
import pandas as pd
from typing import List, IO

def get_user_by_email(db: Session, email: str):
    return db.query(User).filter(User.email == email).first()

def get_user_by_id(db: Session, user_id: int):
    return db.query(User).filter(User.id == user_id).first()

def create_user(db: Session, user: UserCreate):
    hashed_pw = hash_password(user.password)
    db_user = User(email=user.email, hashed_password=hashed_pw)
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

def update_user_onboarding_status(db: Session, user_id: int, status: bool = True):
    db_user = db.query(User).filter(User.id == user_id).first()
    if db_user:
        db_user.has_completed_onboarding = status
        db.commit()
        db.refresh(db_user)
    return db_user

def create_onboarding_data(db: Session, user_id: int, onboarding: OnboardingCreate):
    db_onboarding = OnboardingData(
        user_id=user_id,
        exam_name=onboarding.exam_name,
        exam_date=onboarding.exam_date,
        current_preparation_level=onboarding.current_preparation_level,
        daily_study_hours=onboarding.daily_study_hours,
        preferred_study_time=onboarding.preferred_study_time,
        topics_covered=onboarding.topics_covered,
        weak_subjects=onboarding.weak_subjects,
        strong_subjects=onboarding.strong_subjects,
        additional_notes=onboarding.additional_notes
    )
    db.add(db_onboarding)
    db.commit()
    db.refresh(db_onboarding)
    return db_onboarding

def get_onboarding_data_by_user_id(db: Session, user_id: int):
    return db.query(OnboardingData).filter(OnboardingData.user_id == user_id).first()

def update_onboarding_data(db: Session, user_id: int, onboarding_update: OnboardingUpdate):
    db_onboarding = db.query(OnboardingData).filter(OnboardingData.user_id == user_id).first()
    if db_onboarding:
        update_data = onboarding_update.dict(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_onboarding, field, value)
        db.commit()
        db.refresh(db_onboarding)
    return db_onboarding

def delete_onboarding_data(db: Session, user_id: int):
    db_onboarding = db.query(OnboardingData).filter(OnboardingData.user_id == user_id).first()
    if db_onboarding:
        db.delete(db_onboarding)
        db.commit()
        return True
    return False

# Syllabus Funcs
def parse_syllabus_file(file: IO) -> List[str]:
    """
    (Step 2: Validation)
    Reads an Excel file in-memory and parses the first column into a list of topics.
    Raises ValueError if the file is invalid.
    """
    try:
        # Read the file directly from the upload stream
        df = pd.read_excel(file)
        if df.empty or len(df.columns) == 0:
            raise ValueError("File is empty or has no columns.")
        
        # Get the first column, drop any empty rows, and convert to list of strings
        topic_column = df.columns[0]
        topics = df[topic_column].dropna().astype(str).tolist()
        
        if not topics:
            raise ValueError("No topics found in the first column.")
            
        return topics
    except Exception as e:
        # Catch pandas errors, bad file types, etc.
        raise ValueError(f"Failed to parse Excel file: {e}")

def create_user_syllabus(db: Session, user_id: int, name: str, topics: List[str]) -> Syllabus:
    """
    (Step 3: Storing)
    Creates and saves a new syllabus for a user.
    """
    db_syllabus = Syllabus(name=name, topics=topics, owner_id=user_id)
    db.add(db_syllabus)
    db.commit()
    db.refresh(db_syllabus)
    return db_syllabus

def get_syllabuses_by_user_id(db: Session, user_id: int) -> List[Syllabus]:
    """
    (Step 5: Selecting)
    Fetches all syllabuses owned by a specific user.
    """
    return db.query(Syllabus).filter(Syllabus.owner_id == user_id).order_by(Syllabus.name).all()

def get_syllabus_by_id(db: Session, syllabus_id: int, user_id: int) -> Syllabus:
    """
    (Step 4: Using)
    Fetches a single syllabus, ensuring it belongs to the correct user.
    """
    return db.query(Syllabus).filter(Syllabus.id == syllabus_id, Syllabus.owner_id == user_id).first()

def delete_syllabus_by_id(db: Session, syllabus_id: int, user_id: int) -> bool:
    """
    (Bonus: Managing)
    Deletes a syllabus, ensuring it belongs to the correct user.
    """
    db_syllabus = get_syllabus_by_id(db, syllabus_id, user_id)
    if db_syllabus:
        db.delete(db_syllabus)
        db.commit()
        return True
    return False