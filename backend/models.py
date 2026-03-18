from pydantic import BaseModel
from typing import Optional

# Pydantic models define what data our API expects to receive and send
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
