from pydantic import BaseModel
from typing import Optional, List, Dict, Any

# --- Users ---
class UserCreate(BaseModel):
    name: str
    surname: str
    email: str
    role: str
    password: str

class UserResponse(BaseModel):
    id: int
    name: str
    surname: str
    email: str
    role: str

    class Config:
        from_attributes = True

class UserLogin(BaseModel):
    email: str
    password: str

# --- Courses ---
class CourseCreate(BaseModel):
    name: str
    description: str
    completionDeadline: Optional[str] = None
    picture: Optional[str] = None
    videos: Optional[List[Any]] = []
    questions: Optional[List[Any]] = []
    assignments: Optional[List[Any]] = []

class CourseResponse(BaseModel):
    id: int
    name: str
    description: str
    completionDeadline: Optional[str] = None
    picture: Optional[str] = None
    videos: Optional[List[Any]] = []
    questions: Optional[List[Any]] = []
    assignments: Optional[List[Any]] = []
