# AuditChain AI Platform

AuditChain AI is a production-ready, highly responsive, full-stack AI chat application powered by Groq and the `llama3-70b-8192` model. This platform acts as an intelligent assistant tailored for audits, queries, and professional assistance.

## Features

- **Blazing Fast AI Responses** using the Groq API
- **SSE Streaming** for real-time ChatGPT-like typing effect
- **Context Persistence** across sessions utilizing a local SQLite database
- **Modern UI** built with Bootstrap 5 and vanilla JavaScript
- **Dark & Light Mode** toggle support
- **Minimalist Design** matching the exact specifications (Dark theme focus)
- **Responsive Navigation** with Chat Clear functionality

## Project Structure

```text
auditchain-ai/
│
├── app.py                # Main FastAPI application and routing logic
├── requirements.txt      # Python dependencies
├── .env.example          # Template for setting environment variables
├── history.db            # SQLite database generated at runtime
├── templates/
│   └── index.html        # Main HTML UI structure
├── static/
│   ├── css/
│   │   └── style.css     # UI Styling
│   └── js/
│       └── chat.js       # Client interaction, stream parsing, and logic
└── README.md             # Project documentation
```

## Setup & Local Execution

### 1. Install Dependencies
Ensure you have Python 3.9+ installed on your system. Run the following command to install the required packages:

```bash
pip install -r requirements.txt
```

### 2. Configure Environment Variables
Create a file named `.env` in the root directory by copying `.env.example`:

```bash
# On Linux/macOS
cp .env.example .env

# On Windows (Command Prompt)
copy .env.example .env
```

Open the `.env` file and insert your Groq API Key:
```env
GROQ_API_KEY=gsk_your_actual_api_key_here
```

### 3. Run Locally
Execute the backend server using FastAPI's embedded runner (Uvicorn):

```bash
python app.py
```

The application will now be available on your browser at `http://localhost:8000`.

## Deployment

The application is fully container-ready, standard REST, and requires no extensive server setup since it uses SQLite.

### Render / Railway
1. Push your repository to GitHub.
2. In Railway/Render, create a new "Web Service" from your GitHub repository.
3. Add an Environment Variable matching your `.env` key setting: `GROQ_API_KEY`.
4. Set the Start Command to:
   ```bash
   uvicorn app:app --host 0.0.0.0 --port $PORT
   ```
5. Deploy.

### Vercel Backend
Vercel supports serverless execution. However, native Vercel handles Python setups a bit differently.
It is highly recommended to use Render or Railway for the backend so that `history.db` writes successfully, as Vercel runs on read-only serverless instances which makes local flat-file databases reset continually.
If Vercel must be used, switch the database module from `sqlite` to Vercel Postgres or Supabase, and maintain standard ASGI endpoints.

## Git & GitHub Setup

To push this project to your own GitHub repository manually:

1. **Initialize Git:**
   ```bash
   git init
   ```

2. **Add Files:**
   ```bash
   git add .
   ```

3. **Commit:**
   ```bash
   git commit -m "Initial commit: AuditChain AI Platform"
   ```

4. **Link to GitHub:**
   Go to GitHub, create a new repository, then run:
   ```bash
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
   git branch -M main
   git push -u origin main
   ```

---
### API Usage Example

**Endpoint:** `POST /api/chat`
**Body:**
```json
{
  "message": "Explain financial smart contract audits.",
  "session_id": "optional_unique_session"
}
```
**Response Format:** Data Server Sent Events (SSE):
```
data: {"content": "Sure! Here is the explanation..."}
```
