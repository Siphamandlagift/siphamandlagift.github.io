from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List
import json

from database import SessionLocal, UserDB, CourseDB, engine, Base
from models import UserCreate, UserResponse, UserLogin, CourseCreate, CourseResponse
from auth import get_password_hash, verify_password, create_access_token

Base.metadata.create_all(bind=engine)

app = FastAPI(title="LMS API (Backend)")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# --- USERS ROUTES ---
@app.post("/api/users", response_model=UserResponse)
def create_user(user: UserCreate, db: Session = Depends(get_db)):
    db_user = db.query(UserDB).filter(UserDB.email == user.email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
        
    hashed = get_password_hash(user.password)
    
    new_user = UserDB(
        name=user.name,
        surname=user.surname,
        email=user.email,
        role=user.role,
        password_hash=hashed
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

@app.get("/api/users")
def get_users(db: Session = Depends(get_db)):
    users = db.query(UserDB).all()
    frontend_formatted = []
    for u in users:
         frontend_formatted.append({
             "id": f"usr-{u.id}",
             "name": u.name,
             "surname": u.surname,
             "email": u.email,
             "role": u.role
         })
    return {"users": frontend_formatted}

@app.post("/api/login")
def login_user(login_data: UserLogin, db: Session = Depends(get_db)):
    user = db.query(UserDB).filter(UserDB.email == login_data.email).first()
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not verify_password(login_data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")
        
    access_token = create_access_token(data={"sub": user.email, "role": user.role})
    return {
        "success": True,
        "token": access_token,
        "user": {
            "id": f"usr-{user.id}",
            "name": user.name,
            "surname": user.surname,
            "email": user.email,
            "role": user.role
        }
    }

# --- COURSES ROUTES ---
@app.post("/api/courses", response_model=CourseResponse)
def add_course(course: CourseCreate, db: Session = Depends(get_db)):
    # Convert lists to JSON strings for SQLite
    v_json = json.dumps(course.videos) if course.videos else "[]"
    q_json = json.dumps(course.questions) if course.questions else "[]"
    a_json = json.dumps(course.assignments) if course.assignments else "[]"
    
    new_course = CourseDB(
        name=course.name,
        description=course.description,
        completion_deadline=course.completionDeadline,
        picture=course.picture,
        videos_json=v_json,
        questions_json=q_json,
        assignments_json=a_json
    )
    db.add(new_course)
    db.commit()
    db.refresh(new_course)
    
    return CourseResponse(
        id=new_course.id,
        name=new_course.name,
        description=new_course.description,
        completionDeadline=new_course.completion_deadline,
        picture=new_course.picture,
        videos=json.loads(new_course.videos_json),
        questions=json.loads(new_course.questions_json),
        assignments=json.loads(new_course.assignments_json)
    )

@app.get("/api/courses")
def get_courses(db: Session = Depends(get_db)):
    courses = db.query(CourseDB).all()
    results = []
    for c in courses:
        results.append({
            "id": c.id,
            "name": c.name,
            "description": c.description,
            "completionDeadline": c.completion_deadline,
            "picture": c.picture,
            "videos": json.loads(c.videos_json or "[]"),
            "questions": json.loads(c.questions_json or "[]"),
            "assignments": json.loads(c.assignments_json or "[]")
        })
    return {"courses": results}
