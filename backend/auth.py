from passlib.context import CryptContext
import jwt
from datetime import datetime, timedelta

# Create a bcrypt context for hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Secret key for JWT (In production, load this from an environment variable)
SECRET_KEY = "my_super_secret_lms_testing_key_change_me_later"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 1440  # Token expires in 24 hours

def verify_password(plain_password, hashed_password):
    """Checks if the typed password matches the encrypted hash in the database"""
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    """Encrypts a password into a hash"""
    return pwd_context.hash(password)

def create_access_token(data: dict):
    """Creates a JWT session token for the user so they stay logged in"""
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt
