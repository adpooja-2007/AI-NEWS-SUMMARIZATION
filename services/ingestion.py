import datetime
import random
import feedparser
from bs4 import BeautifulSoup
from sqlalchemy.orm import Session
from database import ArticleOriginal, ArticleSimplified, FactVerificationLog, Quiz, QuizAnswer
from services.nlp_engine import run_nlp_pipeline

# Public RSS feeds - English only, no Hindi or other non-English feeds
LIVE_RSS_FEEDS = [
    "http://feeds.bbci.co.uk/news/world/rss.xml",
    "https://feeds.bbci.co.uk/news/technology/rss.xml",
    "https://www.thehindu.com/news/national/feeder/default.rss"
    # Removed: Times of India (may contain Hindi content)
    # Removed: Any BBC Hindi feeds
]

import urllib.request

def clean_html(raw_html):
    """Utility to strip HTML tags from RSS item descriptions - PRESERVE ALL TEXT."""
    if not raw_html:
        return ""
    # If it's already plain text, return as is
    if not ('<' in raw_html and '>' in raw_html):
        return raw_html.strip()
    
    soup = BeautifulSoup(raw_html, "html.parser")
    # Get ALL text including from nested tags, preserve spacing
    text = soup.get_text(separator=' ', strip=True)
    # Clean up multiple spaces but preserve content
    import re
    text = re.sub(r'\s+', ' ', text)
    return text.strip()

def fetch_full_article_text(url):
    """Scrapes the full article body from the source URL - NO FILTERING."""
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'})
        html = urllib.request.urlopen(req, timeout=15).read()
        soup = BeautifulSoup(html, "html.parser")
        
        # Get ALL paragraphs - NO LENGTH FILTERING
        paragraphs = soup.find_all('p')
        
        # Also try article-specific tags
        article_body = soup.find('article') or soup.find('main') or soup.find('div', {'id': 'content'}) or soup.find('div', class_=lambda x: x and ('article' in x.lower() or 'content' in x.lower() or 'story' in x.lower() if x else False))
        if article_body:
            paragraphs.extend(article_body.find_all(['p', 'div', 'span']))
        
        # Get text from ALL paragraphs - NO FILTERING
        text = ' '.join([p.get_text(separator=' ', strip=True) for p in paragraphs if p.get_text(strip=True)])
        
        return text if text else ""
    except Exception as e:
        print(f"Failed to fetch full article {url}: {e}")
        return ""

def ingest_rss_feed(db: Session):
    """
    Pulls a real live RSS feed URL.
    Fetches the first unprocessed article, saves it, and triggers pipeline.
    """
    target_feed = random.choice(LIVE_RSS_FEEDS)
    print(f"Fetching live RSS feed: {target_feed}")
    
    # Skip if feed URL contains "hindi" (case-insensitive)
    if "hindi" in target_feed.lower():
        print(f"Skipping feed: {target_feed} - contains 'hindi'")
        return {"status": "SKIPPED", "msg": "Hindi feed excluded."}
    
    parsed_feed = feedparser.parse(target_feed)
    
    # Check feed title for Hindi
    feed_title = parsed_feed.feed.get("title", "").lower()
    if "hindi" in feed_title:
        print(f"Skipping feed: {target_feed} - feed title contains 'hindi': {feed_title}")
        return {"status": "SKIPPED", "msg": f"Feed is Hindi: {feed_title}"}
    
    if not parsed_feed.entries:
        return {"status": "FAILED", "msg": "No entries found in RSS feed."}
        
    # Find the newest article we haven't processed yet
    article_data = None
    for item in parsed_feed.entries:
        link = item.get("link", "")
        existing = db.query(ArticleOriginal).filter(ArticleOriginal.source_url == link).first()
        if not existing:
            article_data = item
            break
            
    if not article_data:
        return {"status": "SKIPPED", "msg": "All available articles in this feed are already ingested."}
        
    headline = article_data.get("title", "No Title")
    url = article_data.get("link", "")
    publisher = parsed_feed.feed.get("title", "Unknown Source")
    
    # Quick check: Skip if headline contains non-Latin scripts (Hindi, Chinese, Arabic, etc.)
    def has_non_latin_script(text):
        """Check if text contains non-Latin scripts"""
        if not text:
            return False
        sample = text[:200]  # Check first 200 chars
        # Devanagari (Hindi)
        if any('\u0900' <= char <= '\u097F' for char in sample):
            return True
        # Chinese, Japanese, Korean
        if any('\u4E00' <= char <= '\u9FFF' for char in sample):
            return True
        # Arabic
        if any('\u0600' <= char <= '\u06FF' for char in sample):
            return True
        # Cyrillic
        if any('\u0400' <= char <= '\u04FF' for char in sample):
            return True
        return False
    
    # Check headline first - skip early if non-English
    if has_non_latin_script(headline):
        print(f"Skipping article '{headline}' - headline contains non-Latin script (likely non-English)")
        return {"status": "SKIPPED", "msg": "Article headline is not in English/Latin script."}
    
    # Fetch full article text
    full_text = fetch_full_article_text(url)
    
    # Handle the raw text extraction - GET EVERYTHING FROM RSS FEED
    # Get ALL possible content fields from RSS (different feeds use different field names)
    
    # Standard RSS fields - check multiple possible field names
    # Some feeds use "description", others use "summary" (like BBC)
    raw_html_desc = article_data.get("description", "") or article_data.get("desc", "") or article_data.get("summary", "")
    raw_summary = article_data.get("summary", "") or article_data.get("description", "")
    subtitle = article_data.get("subtitle", "")
    
    # Early check: Skip if RSS description/summary contains non-Latin scripts
    if has_non_latin_script(raw_html_desc) or has_non_latin_script(raw_summary):
        print(f"Skipping article '{headline}' - RSS content contains non-Latin script (likely non-English)")
        return {"status": "SKIPPED", "msg": "RSS feed content is not in English/Latin script."}
    
    # Get content field - can be a list or dict - extract ALL values
    content_parts = []
    if "content" in article_data:
        if isinstance(article_data["content"], list):
            for item in article_data["content"]:
                if isinstance(item, dict) and "value" in item:
                    content_parts.append(item.get("value", ""))
                elif isinstance(item, str):
                    content_parts.append(item)
        elif isinstance(article_data["content"], dict):
            if "value" in article_data["content"]:
                content_parts.append(article_data["content"].get("value", ""))
        elif isinstance(article_data["content"], str):
            content_parts.append(article_data["content"])
    
    # Check for encoded content (some RSS feeds use this)
    encoded_content = ""
    if hasattr(article_data, 'content') or 'content' in article_data:
        try:
            # Try to get encoded content
            if hasattr(article_data, 'content_encoded'):
                encoded_content = article_data.content_encoded
            elif 'content_encoded' in article_data:
                encoded_content = article_data['content_encoded']
        except:
            pass
    
    # Check for other common RSS fields
    media_description = ""
    itunes_summary = ""
    try:
        if hasattr(article_data, 'media_description'):
            media_description = article_data.media_description
        if hasattr(article_data, 'itunes_summary'):
            itunes_summary = article_data.itunes_summary
        # Also check dict access
        if 'media_description' in article_data:
            media_description = article_data.get('media_description', '')
        if 'itunes_summary' in article_data:
            itunes_summary = article_data.get('itunes_summary', '')
    except:
        pass
    
    content = " ".join([c for c in content_parts if c])
    
    # DEBUG: Print ALL available fields in the RSS entry
    print(f"Available RSS entry keys: {list(article_data.keys())}")
    print(f"RSS entry has content attribute: {hasattr(article_data, 'content')}")
    
    # DEBUG: Show raw description length before cleaning
    print(f"Raw RSS description length: {len(raw_html_desc)} characters")
    if raw_html_desc:
        print(f"Raw RSS description preview (first 200 chars): {raw_html_desc[:200]}")
    
    # Try to import translator, but handle if it's not available
    translator = None
    try:
        from googletrans import Translator
        translator = Translator()
    except ImportError:
        print("WARNING: googletrans not installed. Skipping translation. Install with: pip install googletrans==4.0.0rc1")
        translator = None
    
    # Clean ALL text sources - NO FILTERING
    cleaned_desc = clean_html(raw_html_desc)
    cleaned_summary = clean_html(raw_summary)
    cleaned_content = clean_html(content)
    cleaned_subtitle = clean_html(subtitle) if subtitle else ""
    cleaned_encoded = clean_html(encoded_content) if encoded_content else ""
    cleaned_media = clean_html(media_description) if media_description else ""
    cleaned_itunes = clean_html(itunes_summary) if itunes_summary else ""
    
    # DEBUG: Print what we're getting from RSS feed
    print(f"RSS Feed Content:")
    print(f"  description length: {len(cleaned_desc) if cleaned_desc else 0}")
    print(f"  summary length: {len(cleaned_summary) if cleaned_summary else 0}")
    print(f"  content length: {len(cleaned_content) if cleaned_content else 0}")
    print(f"  subtitle length: {len(cleaned_subtitle) if cleaned_subtitle else 0}")
    print(f"  encoded_content length: {len(cleaned_encoded) if cleaned_encoded else 0}")
    print(f"  media_description length: {len(cleaned_media) if cleaned_media else 0}")
    print(f"  itunes_summary length: {len(cleaned_itunes) if cleaned_itunes else 0}")
    print(f"  full_text (scraped) length: {len(full_text) if full_text else 0}")
    
    # PRIORITIZE RSS FEED CONTENT - it usually has the full article
    # Combine ALL RSS feed fields - APPEND EVERYTHING, minimal duplicate checking
    rss_content_parts = []
    seen_texts = set()
    
    # Add RSS description first (most RSS feeds put full content here)
    if cleaned_desc and cleaned_desc not in seen_texts:
        rss_content_parts.append(cleaned_desc)
        seen_texts.add(cleaned_desc)
    
    # Add encoded content (often has full article)
    if cleaned_encoded and cleaned_encoded not in seen_texts:
        rss_content_parts.append(cleaned_encoded)
        seen_texts.add(cleaned_encoded)
    
    # Add summary
    if cleaned_summary and cleaned_summary not in seen_texts:
        rss_content_parts.append(cleaned_summary)
        seen_texts.add(cleaned_summary)
    
    # Add content field
    if cleaned_content and cleaned_content not in seen_texts:
        rss_content_parts.append(cleaned_content)
        seen_texts.add(cleaned_content)
    
    # Add media description
    if cleaned_media and cleaned_media not in seen_texts:
        rss_content_parts.append(cleaned_media)
        seen_texts.add(cleaned_media)
    
    # Add itunes summary
    if cleaned_itunes and cleaned_itunes not in seen_texts:
        rss_content_parts.append(cleaned_itunes)
        seen_texts.add(cleaned_itunes)
    
    # Add subtitle
    if cleaned_subtitle and cleaned_subtitle not in seen_texts:
        rss_content_parts.append(cleaned_subtitle)
        seen_texts.add(cleaned_subtitle)
    
    # Combine RSS feed content - just append with space separator
    rss_combined = " ".join(rss_content_parts).strip()
    
    print(f"Combined RSS content length: {len(rss_combined)} characters, {len(rss_combined.split())} words")
    
    # Decide which content to use as primary source
    # If RSS content is very short (< 500 chars), prioritize scraped full article
    # If RSS content is substantial, use it as primary
    if full_text and len(full_text) > 500:
        # Scraped full article is substantial - use it as primary
        if rss_combined and len(rss_combined) > 200:
            # Both are substantial - combine them (RSS first, then full article)
            raw_text = rss_combined + " " + full_text
        else:
            # RSS is too short, use scraped full article
            raw_text = full_text
            if rss_combined:
                # Prepend RSS summary for context
                raw_text = rss_combined + " " + raw_text
    elif rss_combined and len(rss_combined) > 200:
        # RSS content is substantial, use it
        raw_text = rss_combined
        if full_text:
            # Append scraped content if available
            raw_text = raw_text + " " + full_text
    else:
        # Use whatever we have
        raw_text = full_text if full_text else rss_combined
        if full_text and rss_combined:
            raw_text = rss_combined + " " + full_text
    
    # Final fallback: if we still don't have much, combine ALL sources
    if len(raw_text) < 100:
        all_sources = [rss_combined, full_text, cleaned_content, cleaned_desc, cleaned_summary, cleaned_subtitle, cleaned_encoded, cleaned_media, cleaned_itunes]
        all_sources = [s for s in all_sources if s and len(s) > 5]  # Only non-empty
        if all_sources:
            raw_text = " ".join(all_sources)
    
    # NO CHARACTER LIMIT - USE ENTIRE TEXT
    print(f"Total content length: {len(raw_text)} characters, {len(raw_text.split())} words")
    print(f"Sources: full_text={len(full_text) if full_text else 0}, desc={len(cleaned_desc) if cleaned_desc else 0}, content={len(cleaned_content) if cleaned_content else 0}, summary={len(cleaned_summary) if cleaned_summary else 0}")
    
    # Detect language and skip non-English articles
    def detect_language_simple(text):
        """Simple language detection - check for non-Latin scripts"""
        if not text or len(text) < 50:
            return "unknown"
        
        # Check for common non-English scripts
        # Devanagari (Hindi, Sanskrit, etc.)
        if any('\u0900' <= char <= '\u097F' for char in text[:500]):
            return "hindi"
        # Chinese, Japanese, Korean
        if any('\u4E00' <= char <= '\u9FFF' for char in text[:500]):
            return "chinese"
        # Arabic
        if any('\u0600' <= char <= '\u06FF' for char in text[:500]):
            return "arabic"
        # Cyrillic (Russian, etc.)
        if any('\u0400' <= char <= '\u04FF' for char in text[:500]):
            return "russian"
        
        # If we have translator, use it for more accurate detection
        if translator:
            try:
                detection = translator.detect(text[:500])
                if detection and detection.lang:
                    return detection.lang
            except:
                pass
        
        # Default to English if no non-Latin scripts found
        return "en"
    
    # Detect language
    detected_lang = detect_language_simple(raw_text)
    print(f"Detected language: {detected_lang}")
    
    # Skip non-English articles
    if detected_lang not in ["en", "unknown"]:
        print(f"Skipping article '{headline}' - language is {detected_lang}, not English")
        return {"status": "SKIPPED", "msg": f"Article is in {detected_lang}, only English articles are processed."}
    
    # Article is already filtered to be English only, no translation needed
    if detected_lang == "en":
        print("Article is in English, proceeding with processing")
    elif detected_lang == "unknown":
        print("Language detection uncertain, but no non-Latin scripts detected - proceeding")
    else:
        # This shouldn't happen as we already filtered above, but just in case
        print(f"Unexpected language {detected_lang}, skipping")
        return {"status": "SKIPPED", "msg": f"Article is in {detected_lang}, only English articles are processed."}
    
    # If text is too short, try to get more content or skip
    if len(raw_text) < 100:
        # Try to fetch more aggressively
        if not full_text or len(full_text) < 100:
            # Try fetching again with different approach
            try:
                req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'})
                html = urllib.request.urlopen(req, timeout=15).read()
                soup = BeautifulSoup(html, "html.parser")
                
                # Try to find main content area
                main_content = soup.find('main') or soup.find('div', {'id': 'content'}) or soup.find('div', {'class': 'article-body'})
                if main_content:
                    paragraphs = main_content.find_all(['p', 'div'])
                    additional_text = ' '.join([p.get_text(separator=' ', strip=True) for p in paragraphs if len(p.get_text(strip=True)) > 30])
                    if len(additional_text) > len(raw_text):
                        raw_text = additional_text
            except:
                pass
        
        # If still too short, skip this article
        if len(raw_text) < 100:
            print(f"Skipping article '{headline}' - insufficient content (only {len(raw_text)} chars)")
            return {"status": "SKIPPED", "msg": f"Article has insufficient content ({len(raw_text)} chars). Minimum 100 chars required."}
        
    print(f"Ingesting real article from {publisher}: {headline}")
    
    # Save original
    original = ArticleOriginal(
        source_url=url,
        publisher_name=publisher,
        headline=headline,
        raw_text=raw_text,
        published_date=datetime.datetime.now().isoformat()
    )
    db.add(original)
    db.commit()
    db.refresh(original)
    
    # Run NLP Pipeline
    pipeline_result = run_nlp_pipeline(original.raw_text)
    
    if pipeline_result["status"] == "FAIL_MAX_RETRIES":
        # Save as failed
        simplified = ArticleSimplified(
            original_id=original.id,
            simplified_headline="Processing Failed",
            simplified_text="The AI pipeline could not generate a verifiable simplified version.",
            processing_status="FAIL" # Fact-check or readability failed
        )
        db.add(simplified)
        db.commit()
        return {"status": "FAILED", "msg": "Pipeline failed max retries."}
        
    # Successfully processed! Save Simplified
    simplified_text_to_save = pipeline_result["simplified_text"]
    
    # DEBUG: Log what we're saving
    print(f"SAVING TO DATABASE:")
    print(f"  Simplified text length: {len(simplified_text_to_save)} characters")
    print(f"  Simplified text word count: {len(simplified_text_to_save.split())} words")
    print(f"  Original text length: {len(original.raw_text)} characters")
    print(f"  Original text word count: {len(original.raw_text.split())} words")
    print(f"  Simplified text preview (first 300 chars): {simplified_text_to_save[:300]}")
    print(f"  Simplified text preview (last 300 chars): {simplified_text_to_save[-300:]}")
    
    simplified = ArticleSimplified(
        original_id=original.id,
        simplified_headline=original.headline, # Keeping original headline for simplicity
        simplified_text=simplified_text_to_save,
        readability_score=pipeline_result["readability_score"],
        word_count=pipeline_result["word_count"],
        processing_status="PASS",
        genre=pipeline_result.get("genre", "General")
    )
    db.add(simplified)
    db.commit()
    
    # DEBUG: Verify what was saved
    db.refresh(simplified)
    saved_text_length = len(simplified.simplified_text) if simplified.simplified_text else 0
    print(f"  VERIFIED SAVED: {saved_text_length} characters in database")
    if saved_text_length != len(simplified_text_to_save):
        print(f"  WARNING: Text length mismatch! Saved {saved_text_length} but tried to save {len(simplified_text_to_save)}")
    db.refresh(simplified)
    
    # Save Fact Check Logs
    fact_data = pipeline_result["fact_result"]
    fact_log = FactVerificationLog(
        simplified_id=simplified.id,
        confidence_pct=fact_data["confidence_pct"],
        matched_entities_count=fact_data["matched_entities_count"],
        failure_reason=fact_data["failure_reason"]
    )
    db.add(fact_log)
    
    # Save Quizzes
    for q_data in pipeline_result["quiz_data"]:
        quiz_model = Quiz(
            simplified_id=simplified.id,
            question_text=q_data["question_text"],
            question_type=q_data["question_type"]
        )
        db.add(quiz_model)
        db.commit()
        db.refresh(quiz_model)
        
        for ans_data in q_data["answers"]:
            ans_model = QuizAnswer(
                quiz_id=quiz_model.id,
                answer_text=ans_data["text"],
                is_correct=ans_data["is_correct"]
            )
            db.add(ans_model)
            
    db.commit()
    return {"status": "SUCCESS", "msg": f"Ingested & Processed: {headline[:30]}..."}
