import os
import json
import aiosqlite
from typing import List
from datetime import datetime

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import HTMLResponse, JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel
from dotenv import load_dotenv
from groq import AsyncGroq

# Load environment variables (override allows reloading from .env if already set in terminal)
load_dotenv(override=True)

# Initialize FastAPI app
app = FastAPI(title="AuditChain AI API")

# Setup templates and static files
os.makedirs("static/css", exist_ok=True)
os.makedirs("static/js", exist_ok=True)
os.makedirs("templates", exist_ok=True)

app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

# Initialize Groq client
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
if not GROQ_API_KEY:
    print("WARNING: GROQ_API_KEY is not set in the environment variables.")

try:
    groq_client = AsyncGroq(api_key=GROQ_API_KEY)
except Exception as e:
    groq_client = None
    print(f"Error initializing Groq client: {e}")

# Database setup
DB_FILE = "history.db"

async def init_db():
    async with aiosqlite.connect(DB_FILE) as db:
        await db.execute('''
            CREATE TABLE IF NOT EXISTS chat_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT NOT NULL,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        await db.commit()

@app.on_event("startup")
async def startup_event():
    await init_db()

# Models
class ChatRequest(BaseModel):
    message: str
    session_id: str = "default"

# Helper functions for DB
async def save_message(session_id: str, role: str, content: str):
    async with aiosqlite.connect(DB_FILE) as db:
        await db.execute("INSERT INTO chat_history (session_id, role, content) VALUES (?, ?, ?)", 
                         (session_id, role, content))
        await db.commit()

async def get_session_history(session_id: str, limit: int = 50) -> List[dict]:
    async with aiosqlite.connect(DB_FILE) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT role, content FROM chat_history WHERE session_id = ? ORDER BY id ASC LIMIT ?", (session_id, limit)) as cursor:
            rows = await cursor.fetchall()
            return [{"role": row["role"], "content": row["content"]} for row in rows]

async def clear_session_history(session_id: str):
    async with aiosqlite.connect(DB_FILE) as db:
        await db.execute("DELETE FROM chat_history WHERE session_id = ?", (session_id,))
        await db.commit()

# Routes
@app.get("/", response_class=HTMLResponse)
async def home(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

@app.post("/api/chat")
async def chat_endpoint(req: ChatRequest):
    if not groq_client:
        raise HTTPException(status_code=500, detail="Groq client is not initialized. Check API key.")
    
    user_message = req.message.strip()
    if not user_message:
        raise HTTPException(status_code=400, detail="Message cannot be empty")
        
    session_id = req.session_id.strip() or "default"
    # Basic validation for session_id (optional but good practice)
    if not session_id.isalnum() and "_" not in session_id and "-" not in session_id:
        # If it's not a standard slug, we can just default or handle it
        pass 
    
    # Save user message to history
    await save_message(session_id, "user", user_message)
    
    # Retrieve previous history to maintain context
    history = await get_session_history(session_id, limit=20)
    
    messages = [{"role": "system", "content": "You are AuditChain AI, a helpful, secure, and highly intelligent AI assistant designed to help with audits, answering questions accurately and professionally."}]
    messages.extend(history)
    
    async def generate():
        ai_response_content = ""
        try:
            stream = await groq_client.chat.completions.create(
                messages=messages,
                model="llama-3.3-70b-versatile",
                temperature=0.7,
                max_tokens=2048,
                stream=True
            )
            
            async for chunk in stream:
                if chunk.choices[0].delta.content:
                    content = chunk.choices[0].delta.content
                    ai_response_content += content
                    yield f"data: {json.dumps({'content': content})}\n\n"
            
            # Save the complete AI response to history
            await save_message(session_id, "assistant", ai_response_content)
            yield f"data: {json.dumps({'done': True})}\n\n"
            
        except Exception as e:
            error_msg = f"Error during AI generation: {str(e)}"
            print(error_msg)
            yield f"data: {json.dumps({'error': error_msg})}\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")

@app.get("/api/history")
async def get_history(session_id: str = "default"):
    history = await get_session_history(session_id)
    return {"history": history}

@app.post("/api/clear")
async def clear_chat(request: Request):
    data = await request.json()
    session_id = data.get("session_id", "default")
    await clear_session_history(session_id)
    return {"status": "success", "message": "Chat history cleared"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
