from sqlalchemy import create_engine, Column, Integer, String, Text
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
    password_hash = Column(String)

# Define the Courses Database Table 
class CourseDB(Base):
    __tablename__ = "courses"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    description = Column(String)
    completion_deadline = Column(String, nullable=True)
    picture = Column(String, nullable=True)
    # Storing complex JSON structures as Text for simplicity in this prototype
    videos_json = Column(Text, default="[]")
    questions_json = Column(Text, default="[]")
    assignments_json = Column(Text, default="[]")

# Tell SQLAlchemy to create the tables in the database right now!
Base.metadata.create_all(bind=engine)
