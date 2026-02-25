from fastapi import FastAPI, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from apscheduler.schedulers.asyncio import AsyncIOScheduler
import uvicorn
import os

from database import get_db, ArticleSimplified, Metric, Quiz, QuizAnswer, ArticleOriginal, FactVerificationLog
from services.ingestion import ingest_rss_feed
import database
from deep_translator import GoogleTranslator
import asyncio

app = FastAPI(title="AI Simplified News Platform API")

# Setup Background Auto-Ingest Scheduler
scheduler = AsyncIOScheduler()


from routes_auth import router as auth_router

import asyncio

async def scheduled_ingestion():
    print("Running scheduled auto-ingestion...")
    try:
        await ingest_rss_feed()
    except Exception as e:
        print(f"Error during scheduled auto-ingestion: {e}")

@app.on_event("startup")
def startup_event():
    scheduler.add_job(scheduled_ingestion, "interval", minutes=5, max_instances=2)
    scheduler.start()

@app.on_event("shutdown")
def shutdown_event():
    scheduler.shutdown()

from fastapi.middleware.cors import CORSMiddleware
import os

# Define allowed origins for CORS
origins = [
    "http://localhost:3000",          # Local React production server
    "http://127.0.0.1:3000",
    "http://localhost:5173",          # Local React dev server
    "http://127.0.0.1:5173",
]

# If deployed, allow the production frontend URL
frontend_url = os.getenv("FRONTEND_URL")
if frontend_url:
    origins.append(frontend_url)

# Add CORS middleware to allow React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins, 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register Auth Router
app.include_router(auth_router, prefix="/api/auth", tags=["auth"])

from mongodb import articles_collection, item_helper
from auth import get_current_user

@app.get("/api/articles")
async def get_articles(
    lang: str = "en", 
    page: int = 1, 
    limit: int = 12, 
    search: str = "",
    genre: str = "All",
    current_user: dict = Depends(get_current_user)
):
    """API: Return feed of simplified articles with pagination and filtering"""
    # Base query for passed articles
    query = {"processing_status": "PASS"}
    
    if search:
        # Case-insensitive regex match on the headline
        query["simplified_headline"] = {"$regex": search, "$options": "i"}
        
    if genre and genre != "All":
        query["genre"] = genre
    
    # Calculate total matching documents
    total_articles = await articles_collection.count_documents(query)
    total_pages = max(1, (total_articles + limit - 1) // limit)
    
    # Enforce safe bounds
    safe_page = max(1, min(page, total_pages))
    skip = (safe_page - 1) * limit
    
    # Fetch paginated articles
    cursor = articles_collection.find(query).sort("_id", -1).skip(skip).limit(limit)
    articles = await cursor.to_list(length=limit)
    
    result = []
    for art in articles:
        headline = art.get("simplified_headline", "Headline missing")
        genre = art.get("genre", "General")
        
        is_available = True
        if lang.lower() in ["hi", "ta"]:
            trans = art.get("translations", {}).get(lang.lower())
            if trans:
                # If explicit False, then it failed. If missing, assume True (old records)
                if trans.get("is_available") is False:
                    is_available = False
                else:
                    headline = trans.get("headline", headline)
                    genre = trans.get("genre", genre)
                
        result.append({
            "id": str(art.get("_id")),
            "headline": headline,
            "publisher_name": art.get("original", {}).get("publisher_name", "Unknown"),
            "date": art.get("original", {}).get("published_date", "Unknown")[:10],
            "read_time_min": max(1, round(art.get("word_count", 0) / 150)),
            "readability_score": art.get("readability_score", 0),
            "genre": genre,
            "is_available": is_available
        })
        
    return {
        "articles": result,
        "pagination": {
            "total_articles": total_articles,
            "total_pages": total_pages,
            "current_page": safe_page,
            "limit": limit
        }
    }

@app.get("/api/genres")
async def get_genres(current_user: dict = Depends(get_current_user)):
    """API: Return a list of all unique genres currently in the database."""
    genres = await articles_collection.distinct("genre", {"processing_status": "PASS"})
    # Filter out empty or None genres, sort alphabetically
    valid_genres = sorted([g for g in genres if g and isinstance(g, str)])
    return {"genres": ["All"] + valid_genres}

from bson import ObjectId

@app.get("/api/articles/{article_id}")
async def get_article_detail(article_id: str, lang: str = "en", current_user: dict = Depends(get_current_user)):
    """API: Return full article detail, fact verification, and quizzes"""
    try:
        obj_id = ObjectId(article_id)
    except:
        return {"error": "Invalid Article ID format"}
        
    article = await articles_collection.find_one({"_id": obj_id})
    if not article:
        return {"error": "Article not found"}
        
    article = item_helper(article)
    
    formatted_quizzes = []
    for q in article.get("quizzes", []):
        formatted_quizzes.append({
            "id": str(q.get("id", "")),
            "question_text": q.get("question_text", ""),
            "answers": [{"id": str(a.get("id", "")), "text": a.get("answer_text", "")} for a in q.get("answers", [])]
        })
    
    response_data = {
        "id": article["id"],
        "headline": article.get("simplified_headline", ""),
        "publisher_name": article.get("original", {}).get("publisher_name", "Unknown"),
        "simplified_text": article.get("simplified_text", ""),
        "original_text": article.get("original", {}).get("raw_text", ""),
        "original_url": article.get("original", {}).get("source_url", ""),
        "fact_confidence": article.get("fact_verification", {}).get("confidence_pct", 0),
        "matched_entities": article.get("fact_verification", {}).get("matched_entities_count", 0),
        "quizzes": formatted_quizzes
    }
    
    response_data["is_available"] = True
    
    if lang.lower() in ["hi", "ta"]:
        trans = article.get("translations", {}).get(lang.lower())
        if trans:
            if trans.get("is_available") is False:
                response_data["is_available"] = False
            else:
                response_data["headline"] = trans.get("headline", response_data["headline"])
                response_data["simplified_text"] = trans.get("simplified_text", response_data["simplified_text"])
                response_data["original_text"] = trans.get("original_text", response_data["original_text"])
                
                # Map translated quizzes
                if "quizzes" in trans and trans["quizzes"]:
                    translated_quizzes = []
                    for q in trans["quizzes"]:
                        translated_quizzes.append({
                            "id": str(q.get("id", "")),
                            "question_text": q.get("question_text", ""),
                            "answers": [{"id": str(a.get("id", "")), "text": a.get("answer_text", "")} for a in q.get("answers", [])]
                        })
                    response_data["quizzes"] = translated_quizzes
    return response_data

import io
import asyncio
from fastapi.responses import StreamingResponse
from fastapi import HTTPException
from auth import SECRET_KEY, ALGORITHM
from jose import jwt, JWTError

@app.get("/api/tts/{article_id}")
async def get_article_tts(article_id: str, lang: str = "en", token: str = None):
    """API: Stream MP3 chunks of the simplified article text in the requested language"""
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise HTTPException(status_code=401, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

    try:
        obj_id = ObjectId(article_id)
    except:
        return {"error": "Invalid Article ID format"}
        
    article = await articles_collection.find_one({"_id": obj_id})
    if not article:
        return {"error": "Article not found"}
        
    text_to_read = article.get("simplified_text", "")
    
    if lang.lower() in ["hi", "ta"]:
        trans = article.get("translations", {}).get(lang.lower())
        if trans and trans.get("is_available") is not False:
            text_to_read = trans.get("simplified_text", text_to_read)
            
    if not text_to_read:
        return {"error": "No text available to read"}
        
    try:
        from gtts import gTTS
        from fastapi.responses import Response
        import io
        import asyncio
        
        def generate_audio():
            tts = gTTS(text=text_to_read, lang=lang.lower(), slow=False)
            fp_buffer = io.BytesIO()
            tts.write_to_fp(fp_buffer)
            return fp_buffer.getvalue()

        # Run the blocking network audio generation in a separate thread
        audio_content = await asyncio.to_thread(generate_audio)
        
        return Response(content=audio_content, media_type="audio/mpeg")
    except Exception as e:
        print(f"TTS Generation Error: {e}")
        return {"error": "Failed to generate audio"}

from pydantic import BaseModel

class TTSSnippetRequest(BaseModel):
    text: str
    lang: str = "en"

@app.post("/api/tts/snippet")
async def get_tts_snippet(request: TTSSnippetRequest, current_user: dict = Depends(get_current_user)):
    """API: Generate MP3 audio for a specific text snippet instantly"""
    if not request.text or len(request.text.strip()) == 0:
        return {"error": "Empty text string"}
    try:
        from gtts import gTTS
        from fastapi.responses import Response
        import io
        import asyncio
        
        def generate_snippet():
            tts = gTTS(text=request.text, lang=request.lang.lower(), slow=False)
            fp_buffer = io.BytesIO()
            tts.write_to_fp(fp_buffer)
            return fp_buffer.getvalue()

        audio_content = await asyncio.to_thread(generate_snippet)
        return Response(content=audio_content, media_type="audio/mpeg")
    except Exception as e:
        print(f"TTS Snippet Error: {e}")
        return {"error": "Failed to generate audio snippet"}

from mongodb import metrics_collection

@app.post("/api/quiz/{article_id}")
async def submit_quiz(article_id: str, request: Request, current_user: dict = Depends(get_current_user)):
    """API: Submit quiz answers and return score"""
    payload = await request.json()
    answers = payload.get("answers", {}) # dict of {quiz_id: selected_answer_id}
    
    try:
        obj_id = ObjectId(article_id)
    except:
        return {"error": "Invalid Article ID format"}
        
    article = await articles_collection.find_one({"_id": obj_id})
    if not article:
        return {"error": "Article not found"}
        
    correct_count = 0
    quizzes = article.get("quizzes", [])
    total_count = len(quizzes)
    
    if total_count > 0:
        correct_answers_map = {}
        for quiz in quizzes:
            quiz_id_str = str(quiz.get("id"))
            selected_id = answers.get(quiz_id_str)
            
            # Find the correct answer for this question
            correct_ans = next((a for a in quiz.get("answers", []) if a.get("is_correct")), None)
            if correct_ans:
                correct_answers_map[quiz_id_str] = {
                    "id": str(correct_ans.get("id")),
                    "text": correct_ans.get("answer_text")
                }
                
            if str(selected_id) == str(correct_ans.get("id", "")):
                correct_count += 1
                    
        score_pct = (correct_count / total_count) * 100
        
        from datetime import datetime, timezone, timedelta
        ist_tz = timezone(timedelta(hours=5, minutes=30))
        
        # Save metric
        metric_doc = {
            "user_id": current_user["id"],
            "article_id": str(obj_id),
            "action": "quiz",
            "quiz_score_pct": score_pct,
            "time_on_page_seconds": 120,
            "viewed_original": payload.get("viewed_original", False),
            "created_at": str(os.getenv("CURRENT_TIME", lambda: datetime.now(ist_tz).isoformat()) if callable(os.getenv("CURRENT_TIME")) else os.getenv("CURRENT_TIME", datetime.now(ist_tz).isoformat()))
        }
        await metrics_collection.insert_one(metric_doc)
        
        return {
            "score": score_pct, 
            "correct": correct_count, 
            "total": total_count,
            "correct_answers": correct_answers_map
        }
    return {"score": 0, "correct": 0, "total": 0, "correct_answers": {}}

import datetime

@app.post("/api/articles/{article_id}/view")
async def record_article_view(article_id: str, current_user: dict = Depends(get_current_user)):
    """API: Record an article view for a user"""
    try:
        obj_id = ObjectId(article_id)
    except:
        return {"error": "Invalid Article ID format"}
        
    from datetime import datetime, timezone, timedelta
    ist_tz = timezone(timedelta(hours=5, minutes=30))
    metric_doc = {
        "user_id": current_user["id"],
        "article_id": str(obj_id),
        "action": "view",
        "created_at": datetime.now(ist_tz).isoformat()
    }
    await metrics_collection.insert_one(metric_doc)
    return {"status": "success"}

@app.get("/api/user/stats")
async def get_user_stats(lang: str = "en", current_user: dict = Depends(get_current_user)):
    """API: Get personalized dashboard metrics"""
    user_id = current_user["id"]
    
    # Get all metrics for this specific user, sorted by newest first
    cursor = metrics_collection.find({"user_id": user_id}).sort("created_at", -1)
    user_metrics = await cursor.to_list(length=1000)
    
    view_metrics = [m for m in user_metrics if m.get("action") == "view"]
    quiz_metrics = [m for m in user_metrics if m.get("action") == "quiz"]
    
    total_articles_read = len(set(m.get("article_id") for m in view_metrics))
    avg_score = sum(m.get("quiz_score_pct", 0) for m in quiz_metrics) / len(quiz_metrics) if quiz_metrics else 0
    
    # Collect all unique article IDs from metrics to fetch titles
    all_article_ids_str = list(set([m.get("article_id") for m in user_metrics if m.get("article_id")]))
    
    article_headlines = {}
    avg_readability = 0
    
    if all_article_ids_str:
        try:
            object_ids = [ObjectId(aid) for aid in all_article_ids_str]
            articles_cursor = articles_collection.find({"_id": {"$in": object_ids}})
            all_articles = await articles_cursor.to_list(length=1000)
            
            # Map ID to Headline for quick lookup
            article_headlines = {str(a["_id"]): a.get("simplified_headline", "Unknown Article") for a in all_articles}
            
            # Calculate average readability only for articles they viewed
            read_article_ids_str = set(m.get("article_id") for m in view_metrics if m.get("article_id"))
            read_articles = [a for a in all_articles if str(a["_id"]) in read_article_ids_str]
            if read_articles:
                avg_readability = sum(a.get("readability_score", 0) for a in read_articles) / len(read_articles)
        except Exception as e:
            print(f"Error fetching articles for stats: {e}")
            
    global_total = await articles_collection.count_documents({"processing_status": "PASS"})
    
    # Build Reading History (limit 5 unique articles)
    reading_history = []
    seen_articles_history = set()
    for m in view_metrics:
        aid = m.get("article_id")
        if aid not in seen_articles_history and aid in article_headlines:
            headline = article_headlines[aid]
            if lang.lower() in ["hi", "ta"]:
                art_doc = next((a for a in all_articles if str(a.get("_id")) == aid), None)
                if art_doc:
                    trans = art_doc.get("translations", {}).get(lang.lower())
                    if trans:
                        headline = trans.get("headline", headline)
                        
            reading_history.append({
                "article_id": aid,
                "headline": headline,
                "date": m.get("created_at")
            })
            seen_articles_history.add(aid)
            if len(reading_history) >= 5:
                break
                
    # Build Quiz History (limit 5 recent quizzes)
    quiz_history = []
    for m in quiz_metrics:
        aid = m.get("article_id")
        headline = article_headlines.get(aid, "Unknown Article")
        if aid and lang.lower() in ["hi", "ta"]:
            art_doc = next((a for a in all_articles if str(a.get("_id")) == aid), None)
            if art_doc:
                trans = art_doc.get("translations", {}).get(lang.lower())
                if trans:
                    headline = trans.get("headline", headline)

        quiz_history.append({
            "article_id": aid,
            "headline": headline,
            "score": m.get("quiz_score_pct", 0),
            "date": m.get("created_at")
        })
        if len(quiz_history) >= 5:
            break
            
    return {
        "articles_read": total_articles_read,
        "global_total_articles": global_total,
        "avg_score": round(avg_score, 1),
        "avg_readability": round(avg_readability, 2),
        "reading_history": reading_history,
        "quiz_history": quiz_history
    }

@app.post("/api/admin/ingest")
async def trigger_ingestion(current_user: dict = Depends(get_current_user)):
    """API: Trigger mock ingestion"""
    result = await ingest_rss_feed()
    return result

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8080, reload=True)
