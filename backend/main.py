from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

app = FastAPI(title="LMS API (Backend)")

# Configure CORS so your frontend (index.html) can talk to this local server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods (GET, POST, etc.)
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"status": "success", "message": "LMS Backend Server is running!"}

@app.get("/api/users")
def get_users():
    # Right now this is hardcoded, but soon it will query a REAL database!
    return {
        "users": [
            {"id": "usr-100", "name": "Admin", "email": "mandla1_z@yahoo.com", "role": "admin"},
            {"id": "usr-101", "name": "Test", "surname": "Student", "role": "student"}
        ]
    }

if __name__ == "__main__":
    print("Starting server on http://localhost:8000 ...")
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
