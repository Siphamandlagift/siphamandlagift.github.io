from sqlalchemy import create_engine, Column, Integer, String
from sqlalchemy.orm import declarative_base, sessionmaker

# Create a SQLite database file called lms_database.db
SQLALCHEMY_DATABASE_URL = "sqlite:///./lms_database.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

# Define the User Database Table
class UserDB(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    surname = Column(String, index=True)
    email = Column(String, unique=True, index=True)
    role = Column(String)  # admin, student, manager, etc
    password_hash = Column(String) # For later when we add login

# Tell SQLAlchemy to create the tables in the database right now!
Base.metadata.create_all(bind=engine)
