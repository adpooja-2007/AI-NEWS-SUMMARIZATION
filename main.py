from fastapi import FastAPI, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from apscheduler.schedulers.asyncio import AsyncIOScheduler
import uvicorn
import os

from database import get_db, ArticleSimplified, Metric, Quiz, QuizAnswer, ArticleOriginal, FactVerificationLog
from services.ingestion import ingest_rss_feed
import database

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
    scheduler.add_job(scheduled_ingestion, "interval", minutes=2)
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
async def get_articles(current_user: dict = Depends(get_current_user)):
    """API: Return feed of simplified articles"""
    # Fetch all articles that passed processing
    cursor = articles_collection.find({"processing_status": "PASS"}).sort("_id", -1)
    articles = await cursor.to_list(length=100)
    
    result = []
    for art in articles:
        art = item_helper(art)
        result.append({
            "id": art["id"],
            "headline": art.get("simplified_headline", ""),
            "publisher_name": art.get("original", {}).get("publisher_name", "Unknown"),
            "date": art.get("original", {}).get("published_date", "Unknown")[:10],
            "read_time_min": max(1, round(art.get("word_count", 0) / 150)),
            "readability_score": art.get("readability_score", 0),
            "genre": art.get("genre", "General")
        })
    return result

from bson import ObjectId

@app.get("/api/articles/{article_id}")
async def get_article_detail(article_id: str, current_user: dict = Depends(get_current_user)):
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
    
    return response_data

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
async def get_user_stats(current_user: dict = Depends(get_current_user)):
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
    
    # Build Reading History (limit 15 unique articles)
    reading_history = []
    seen_articles_history = set()
    for m in view_metrics:
        aid = m.get("article_id")
        if aid not in seen_articles_history and aid in article_headlines:
            reading_history.append({
                "article_id": aid,
                "headline": article_headlines[aid],
                "date": m.get("created_at")
            })
            seen_articles_history.add(aid)
            if len(reading_history) >= 15:
                break
                
    # Build Quiz History (limit 15 recent quizzes)
    quiz_history = []
    for m in quiz_metrics:
        aid = m.get("article_id")
        quiz_history.append({
            "article_id": aid,
            "headline": article_headlines.get(aid, "Unknown Article"),
            "score": m.get("quiz_score_pct", 0),
            "date": m.get("created_at")
        })
        if len(quiz_history) >= 15:
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
