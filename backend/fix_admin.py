import sqlite3
import sqlalchemy

conn = sqlite3.connect('c:/Users/sipha/OneDrive/Documentos/GitHub/siphamandlagift.github.io/backend/lms_database.db')
cursor = conn.cursor()

try:
    cursor.execute("DELETE FROM users WHERE email = 'admin@system.com'")
    conn.commit()

    import bcrypt 
    hashed = bcrypt.hashpw(b"admin123", bcrypt.gensalt()).decode("utf-8")
    
    cursor.execute("INSERT INTO users (id, name, surname, email, role, _hashed_password) VALUES (2, 'System', 'Admin', 'admin@system.com', 'administrator', ?)", (hashed,))
    conn.commit()
    print("SUCCESS: Default user 'admin@system.com' with password 'admin123' inserted.")
except Exception as e:
    print(f"ERROR: {e}")
finally:
    conn.close()
