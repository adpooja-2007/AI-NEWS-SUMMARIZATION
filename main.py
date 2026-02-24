from fastapi import FastAPI, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from apscheduler.schedulers.background import BackgroundScheduler
import uvicorn
import os

from database import get_db, ArticleSimplified, Metric, Quiz, QuizAnswer, ArticleOriginal, FactVerificationLog
from services.ingestion import ingest_rss_feed
import database

app = FastAPI(title="AI Simplified News Platform API")

# Setup Background Auto-Ingest Scheduler
scheduler = BackgroundScheduler()

def scheduled_ingestion():
    print("Running scheduled auto-ingestion...")
    db = next(get_db())
    try:
        ingest_rss_feed(db)
    finally:
        db.close()

@app.on_event("startup")
def startup_event():
    scheduler.add_job(scheduled_ingestion, "interval", minutes=2)
    scheduler.start()

@app.on_event("shutdown")
def shutdown_event():
    scheduler.shutdown()

# Add CORS middleware to allow React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # For hackathon demo purposes
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/articles")
async def get_articles(db: Session = Depends(get_db)):
    """API: Return feed of simplified articles"""
    articles = db.query(ArticleSimplified).filter(ArticleSimplified.processing_status == "PASS").order_by(ArticleSimplified.id.desc()).all()
    
    result = []
    for art in articles:
        result.append({
            "id": art.id,
            "headline": art.simplified_headline,
            "publisher_name": art.original.publisher_name if art.original else "Unknown",
            "date": art.original.published_date[:10] if art.original else "Unknown",
            "read_time_min": max(1, round(art.word_count / 150)),
            "readability_score": art.readability_score,
            "genre": getattr(art, "genre", "General")
        })
    return result

@app.get("/api/articles/{article_id}")
async def get_article_detail(article_id: int, db: Session = Depends(get_db)):
    """API: Return full article detail, fact verification, and quizzes"""
    article = db.query(ArticleSimplified).filter(ArticleSimplified.id == article_id).first()
    if not article:
        return {"error": "Article not found"}
    
    # DEBUG: Log what's in the database
    simplified_text_length = len(article.simplified_text) if article.simplified_text else 0
    simplified_word_count = len(article.simplified_text.split()) if article.simplified_text else 0
    original_text_length = len(article.original.raw_text) if article.original and article.original.raw_text else 0
    
    print(f"API DEBUG - Article ID {article_id}:")
    print(f"  Simplified text length: {simplified_text_length} chars, {simplified_word_count} words")
    print(f"  Original text length: {original_text_length} chars")
    print(f"  Simplified text preview (first 200 chars): {article.simplified_text[:200] if article.simplified_text else 'None'}")
        
    formatted_quizzes = []
    for q in article.quizzes:
        formatted_quizzes.append({
            "id": q.id,
            "question_text": q.question_text,
            "answers": [{"id": a.id, "text": a.answer_text} for a in q.answers]
        })
    
    response_data = {
        "id": article.id,
        "headline": article.simplified_headline,
        "publisher_name": article.original.publisher_name if article.original else "Unknown",
        "simplified_text": article.simplified_text,
        "original_text": article.original.raw_text if article.original else "",
        "original_url": article.original.source_url if article.original else "",
        "fact_confidence": article.fact_verification.confidence_pct if article.fact_verification else 0,
        "matched_entities": article.fact_verification.matched_entities_count if article.fact_verification else 0,
        "quizzes": formatted_quizzes
    }
    
    # DEBUG: Log what we're returning
    response_simplified_length = len(response_data["simplified_text"]) if response_data["simplified_text"] else 0
    print(f"  Response simplified_text length: {response_simplified_length} chars")
    
    return response_data

@app.post("/api/quiz/{article_id}")
async def submit_quiz(article_id: int, request: Request, db: Session = Depends(get_db)):
    """API: Submit quiz answers and return score"""
    payload = await request.json()
    answers = payload.get("answers", {}) # dict of {quiz_id: selected_answer_id}
    
    article = db.query(ArticleSimplified).filter(ArticleSimplified.id == article_id).first()
    if not article:
        return {"error": "Article not found"}
        
    correct_count = 0
    total_count = len(article.quizzes)
    
    if total_count > 0:
        correct_answers_map = {}
        for quiz in article.quizzes:
            selected_id = answers.get(str(quiz.id))
            
            # Find the correct answer for this question
            correct_ans = next((a for a in quiz.answers if a.is_correct), None)
            if correct_ans:
                correct_answers_map[quiz.id] = {
                    "id": correct_ans.id,
                    "text": correct_ans.answer_text
                }
                
            if selected_id:
                answer = db.query(QuizAnswer).filter(QuizAnswer.id == selected_id).first()
                if answer and answer.is_correct:
                    correct_count += 1
                    
        score_pct = (correct_count / total_count) * 100
        
        # Save metric
        metric = Metric(
            article_id=article_id,
            quiz_score_pct=score_pct,
            time_on_page_seconds=120,
            viewed_original=payload.get("viewed_original", False)
        )
        db.add(metric)
        db.commit()
        
        return {
            "score": score_pct, 
            "correct": correct_count, 
            "total": total_count,
            "correct_answers": correct_answers_map
        }
    return {"score": 0, "correct": 0, "total": 0, "correct_answers": {}}

@app.get("/api/admin/stats")
async def get_admin_stats(db: Session = Depends(get_db)):
    """API: Get dashboard metrics"""
    total = db.query(ArticleSimplified).count()
    successful = db.query(ArticleSimplified).filter(ArticleSimplified.processing_status == "PASS").count()
    
    metrics = db.query(Metric).all()
    avg_score = sum(m.quiz_score_pct for m in metrics) / len(metrics) if metrics else 0
    
    success_arts = db.query(ArticleSimplified).filter(ArticleSimplified.processing_status == "PASS").all()
    avg_readability = sum(a.readability_score for a in success_arts) / len(success_arts) if success_arts else 0
    
    return {
        "total_processed": total,
        "successful": successful,
        "avg_score": round(avg_score, 1),
        "avg_readability": round(avg_readability, 2)
    }

@app.post("/api/admin/ingest")
async def trigger_ingestion(db: Session = Depends(get_db)):
    """API: Trigger mock ingestion"""
    result = ingest_rss_feed(db)
    return result

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8080, reload=True)
