from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List

# Import our database code
from database import SessionLocal, UserDB, engine, Base
from models import UserCreate, UserResponse, UserLogin
from auth import get_password_hash, verify_password, create_access_token

# This actually constructs the local SQLite database file upon start
Base.metadata.create_all(bind=engine)

app = FastAPI(title="LMS API (Backend)")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Dependency that yields a database session per single request
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.get("/")
def read_root():
    return {"status": "success", "message": "The LMS is connected to the SQLite Database!"}

@app.post("/api/users", response_model=UserResponse)
def create_user(user: UserCreate, db: Session = Depends(get_db)):
    db_user = db.query(UserDB).filter(UserDB.email == user.email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
        
    hashed_pw = get_password_hash(user.password)
        
    new_user = UserDB(
        name=user.name, 
        surname=user.surname, 
        email=user.email, 
        role=user.role, 
        password_hash=hashed_pw
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

@app.get("/api/users")
def get_users(db: Session = Depends(get_db)):
    users = db.query(UserDB).all()
    # Format to match what the frontend expects exactly right now
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
    # 1. Find user in Database
    user = db.query(UserDB).filter(UserDB.email == login_data.email).first()
    
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")
        
    # 2. Check Password
    if not verify_password(login_data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")
        
    # 3. Create Session Token
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

# Ensure there is an admin available to log in with
@app.on_event("startup")
def create_initial_admin():
    db = SessionLocal()
    admin = db.query(UserDB).filter(UserDB.email == "mandla1_z@yahoo.com").first()
    if not admin:
        new_admin = UserDB(
            name="Mandla",
            surname="Admin",
            email="mandla1_z@yahoo.com",
            role="administrator",
            password_hash=get_password_hash("password123")
        )
        db.add(new_admin)
        db.commit()
    db.close()
