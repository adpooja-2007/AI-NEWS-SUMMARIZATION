import datetime
import random
import feedparser
from bs4 import BeautifulSoup
from services.nlp_engine import run_nlp_pipeline
from mongodb import articles_collection
import os
import uuid
from datetime import datetime
import asyncio
import urllib.request
import copy # Added for deepcopy

# Public RSS feeds - English only, no Hindi or other non-English feeds
LIVE_RSS_FEEDS = [
    "http://feeds.bbci.co.uk/news/world/rss.xml",
    "https://feeds.bbci.co.uk/news/technology/rss.xml",
    "https://www.thehindu.com/news/national/feeder/default.rss"
]

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
    """Scrapes the full article body from the source URL intelligently while ignoring noise."""
    try:
        import requests
        headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'}
        response = requests.get(url, headers=headers, timeout=15)
        soup = BeautifulSoup(response.text, "html.parser")
        
        # Actively destroy noise elements before parsing
        for noise in soup.find_all(['nav', 'footer', 'header', 'aside']):
            noise.decompose()
            
        # Destroy elements with common noise classes
        for noise in soup.find_all(class_=lambda x: x and any(word in x.lower() for word in ['menu', 'sidebar', 'cookie', 'popup', 'newsletter', 'sponsor'])):
            noise.decompose()

        article_tags = soup.find_all('article') or soup.find_all(role='main') or soup.find_all('main')
        extracted_text = ""
        
        def is_boilerplate(text):
            junk_phrases = [
                "published -", "comments have to be in english",
                "abide by our community guidelines", "migrated to a new commenting platform",
                "registered user of the hindu", "access their older comments", "vuukle",
                "copyright", "all rights reserved", "subscribe to our newsletter"
            ]
            t_lower = text.lower()
            return any(phrase in t_lower for phrase in junk_phrases)

        if article_tags:
            for tag in article_tags:
                for p in tag.find_all('p'):
                    p_text = p.get_text(strip=True)
                    if len(p_text) > 20 and not is_boilerplate(p_text):
                        extracted_text += p_text + "\n"
        else:
            # Fallback
            main_content = soup.find('div', {'id': 'content'}) or soup.find('div', {'class': 'article-body'}) or soup.find('body')
            if main_content:
                for p in main_content.find_all('p'):
                    p_text = p.get_text(separator=' ', strip=True)
                    if len(p_text) > 30 and not is_boilerplate(p_text):
                        extracted_text += p_text + "\n"
        
        return extracted_text.strip()
    except Exception as e:
        print(f"Failed to fetch full article {url}: {e}")
        return ""

async def process_article_logic(article_data, parsed_feed):
    """
    Core logic to process a single article data item.
    """
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
    print(f"RSS Feed Content for '{headline}':")
    print(f"  full_text (scraped) length: {len(full_text) if full_text else 0}")
    
    # Combine ALL RSS feed fields
    rss_content_parts = []
    seen_texts = set()
    
    for text_part in [cleaned_desc, cleaned_encoded, cleaned_summary, cleaned_content, cleaned_media, cleaned_itunes, cleaned_subtitle]:
        if text_part and text_part not in seen_texts:
            rss_content_parts.append(text_part)
            seen_texts.add(text_part)
    
    rss_combined = " ".join(rss_content_parts).strip()
    
    # Decide which content to use as primary source
    if full_text and len(full_text) > 500:
        if rss_combined and len(rss_combined) > 200:
            raw_text = rss_combined + " " + full_text
        else:
            raw_text = full_text
            if rss_combined:
                raw_text = rss_combined + " " + raw_text
    elif rss_combined and len(rss_combined) > 200:
        raw_text = rss_combined
        if full_text:
            raw_text = raw_text + " " + full_text
    else:
        raw_text = full_text if full_text else rss_combined
        if full_text and rss_combined:
            raw_text = rss_combined + " " + full_text
    
    # Final fallback
    if len(raw_text) < 100:
        all_sources = [rss_combined, full_text, cleaned_content, cleaned_desc, cleaned_summary, cleaned_subtitle, cleaned_encoded, cleaned_media, cleaned_itunes]
        all_sources = [s for s in all_sources if s and len(s) > 5]
        if all_sources:
            raw_text = " ".join(all_sources)
    
    print(f"Total content length: {len(raw_text)} characters")
    
    # Detect language and skip non-English articles
    def detect_language_simple(text):
        if not text or len(text) < 50:
            return "unknown"
        if any('\u0900' <= char <= '\u097F' for char in text[:500]): return "hindi"
        if any('\u4E00' <= char <= '\u9FFF' for char in text[:500]): return "chinese"
        if any('\u0600' <= char <= '\u06FF' for char in text[:500]): return "arabic"
        if any('\u0400' <= char <= '\u04FF' for char in text[:500]): return "russian"
        
        if translator:
            try:
                detection = translator.detect(text[:500])
                if detection and detection.lang:
                    return detection.lang
            except:
                pass
        return "en"
    
    detected_lang = detect_language_simple(raw_text)
    
    if detected_lang not in ["en", "unknown"]:
        print(f"Skipping article '{headline}' - language is {detected_lang}, not English")
        return {"status": "SKIPPED", "msg": f"Article is in {detected_lang}, only English articles are processed."}
    
    # If text is too short, try to fetch more aggressively using smart HTML parsing
    if len(raw_text) < 100:
        if not full_text or len(full_text) < 100:
            try:
                import requests
                headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'}
                response = requests.get(url, headers=headers, timeout=15)
                soup = BeautifulSoup(response.text, "html.parser")
                
                article_tags = soup.find_all('article') or soup.find_all(role='main') or soup.find_all('main')
                extracted_text = ""
                
                def is_boilerplate(text):
                    junk_phrases = [
                        "published -", "comments have to be in english",
                        "abide by our community guidelines", "migrated to a new commenting platform",
                        "registered user of the hindu", "access their older comments", "vuukle",
                        "copyright", "all rights reserved", "subscribe to our newsletter"
                    ]
                    t_lower = text.lower()
                    return any(phrase in t_lower for phrase in junk_phrases)
                
                if article_tags:
                    for tag in article_tags:
                        for p in tag.find_all('p'):
                            p_text = p.get_text(strip=True)
                            if len(p_text) > 20 and not is_boilerplate(p_text):
                                extracted_text += p_text + "\n"
                else:
                    # Fallback
                    main_content = soup.find('div', {'id': 'content'}) or soup.find('div', {'class': 'article-body'})
                    if main_content:
                        for p in main_content.find_all(['p', 'div']):
                            p_text = p.get_text(strip=True)
                            if len(p_text) > 30 and not is_boilerplate(p_text):
                                extracted_text += p_text + "\n"
                
                if len(extracted_text) > len(raw_text):
                    raw_text = extracted_text
            except Exception as e:
                print(f"Aggressive parsing failed: {e}")
        
        if len(raw_text) < 100:
            print(f"Skipping article '{headline}' - insufficient content (only {len(raw_text)} chars)")
            return {"status": "SKIPPED", "msg": f"Article has insufficient content ({len(raw_text)} chars). Minimum 100 chars required."}
        
    print(f"Ingesting real article from {publisher}: {headline}")
    
    # Run NLP Pipeline
    pipeline_result = run_nlp_pipeline(raw_text)
    
    if pipeline_result["status"] == "FAIL_MAX_RETRIES":
        failed_doc = {
            "original": {
                "source_url": url,
                "publisher_name": publisher,
                "headline": headline,
                "raw_text": raw_text,
                "published_date": datetime.now().isoformat()
            },
            "simplified_headline": "Processing Failed",
            "simplified_text": "The AI pipeline could not generate a verifiable simplified version.",
            "processing_status": "FAIL",
            "created_at": datetime.now().isoformat()
        }
        await articles_collection.insert_one(failed_doc)
        return {"status": "FAILED", "msg": "Pipeline failed max retries."}
        
    simplified_text_to_save = pipeline_result["simplified_text"]
    
    quizzes = []
    for q_data in pipeline_result["quiz_data"]:
        quiz = {
            "id": str(uuid.uuid4()),
            "question_text": q_data["question_text"],
            "question_type": q_data.get("question_type", "multiple_choice"),
            "answers": []
        }
        for ans_data in q_data["answers"]:
            quiz["answers"].append({
                "id": str(uuid.uuid4()),
                "answer_text": ans_data["text"],
                "is_correct": ans_data["is_correct"]
            })
        quizzes.append(quiz)
    
    # Pre-translate payloads
    translations = {"hi": {}, "ta": {}}
    from deep_translator import GoogleTranslator
    try:
        genre_val = pipeline_result.get("genre", "General")
        texts_to_translate = [headline, simplified_text_to_save, raw_text, genre_val]
        
        quiz_refs = []
        for q_idx, q in enumerate(quizzes):
            texts_to_translate.append(q["question_text"])
            quiz_refs.append({"type": "q", "q_idx": q_idx})
            for a_idx, a in enumerate(q["answers"]):
                texts_to_translate.append(a["answer_text"])
                quiz_refs.append({"type": "a", "q_idx": q_idx, "a_idx": a_idx})
                
        for t_lang in ["hi", "ta"]:
            translator_client = GoogleTranslator(source='en', target=t_lang)
            
            async def safe_translate(texts):
                translated_results = []
                for text_item in texts:
                    text_str = str(text_item) if text_item else ""
                    if not text_str:
                        translated_results.append("")
                        continue
                    chunk_size = 4800
                    chunks = [text_str[j:j+chunk_size] for j in range(0, len(text_str), chunk_size)]
                    stitched_translation = ""
                    for chunk in chunks:
                        t_res = None
                        max_retries = 3
                        for attempt in range(max_retries):
                            try:
                                t_res = await asyncio.wait_for(asyncio.to_thread(translator_client.translate, chunk), timeout=15.0)
                                break
                            except (asyncio.TimeoutError, TimeoutError):
                                print(f"Timeout on attempt {attempt+1} for {t_lang}")
                                if attempt < max_retries - 1:
                                    await asyncio.sleep(2 * (attempt + 1))
                            except asyncio.CancelledError:
                                print(f"Task cancelled during translation for {t_lang}. Aborting.")
                                return None
                            except Exception as err:
                                err_str = str(err).lower()
                                if "try another translator" in err_str or "length" in err_str or "429" in err_str:
                                    print(f"API Block/Limit on attempt {attempt+1} for {t_lang}: {err}")
                                    if attempt < max_retries - 1:
                                        await asyncio.sleep(2 * (attempt + 1))
                                else:
                                    print(f"Translation error for {t_lang}: {err}")
                                    break
                        
                        if t_res:
                            stitched_translation += t_res
                        else:
                            print(f"Fallback triggered for {t_lang} chunk due to API failures. Aborting translation.")
                            return None
                            
                        await asyncio.sleep(0.3)
                    translated_results.append(stitched_translation)
                return translated_results
                
            t_array = await safe_translate(texts_to_translate)
            
            if t_array and len(t_array) >= 4:
                translations[t_lang]["headline"] = t_array[0]
                translations[t_lang]["simplified_text"] = t_array[1]
                translations[t_lang]["original_text"] = t_array[2]
                translations[t_lang]["genre"] = t_array[3]
                translations[t_lang]["is_available"] = True
                
                translated_quizzes = copy.deepcopy(quizzes)
                offset = 4
                for ref in quiz_refs:
                    if offset < len(t_array):
                        if ref["type"] == "q":
                            translated_quizzes[ref["q_idx"]]["question_text"] = t_array[offset]
                        elif ref["type"] == "a":
                            translated_quizzes[ref["q_idx"]]["answers"][ref["a_idx"]]["answer_text"] = t_array[offset]
                    offset += 1
                translations[t_lang]["quizzes"] = translated_quizzes
            else:
                translations[t_lang] = {"is_available": False}
    except Exception as e:
        print(f"Error pre-translating article: {e}")

    success_doc = {
        "original": {
            "source_url": url,
            "publisher_name": publisher,
            "headline": headline,
            "raw_text": raw_text,
            "published_date": datetime.now().isoformat()
        },
        "simplified_headline": headline,
        "simplified_text": simplified_text_to_save,
        "readability_score": pipeline_result["readability_score"],
        "word_count": pipeline_result["word_count"],
        "genre": pipeline_result.get("genre", "General"),
        "processing_status": "PASS",
        "fact_verification": {
            "confidence_pct": pipeline_result["fact_result"]["confidence_pct"],
            "matched_entities_count": pipeline_result["fact_result"]["matched_entities_count"],
            "failure_reason": pipeline_result["fact_result"]["failure_reason"]
        },
        "quizzes": quizzes,
        "translations": translations,
        "created_at": datetime.now().isoformat()
    }
    
    await articles_collection.insert_one(success_doc)
    return {"status": "SUCCESS", "msg": f"Ingested & Processed: {headline[:30]}..."}

async def ingest_rss_feed():
    """
    Pulls a real live RSS feed URL.
    Fetches MULTIPLE unprocessed articles per run (Batch Processing).
    """
    # Process up to 3 NEW successfully ingested articles per run to increase throughput
    MAX_ARTICLES_PER_RUN = 3
    processed_count = 0
    successful_insertions = 0
    skipped_existing = 0
    results = []
    
    feeds_to_try = list(LIVE_RSS_FEEDS)
    random.shuffle(feeds_to_try)
    
    for target_feed in feeds_to_try:
        if successful_insertions >= MAX_ARTICLES_PER_RUN:
            break
            
        print(f"Fetching live RSS feed: {target_feed}")
        
        if "hindi" in target_feed.lower():
            print(f"Skipping feed: {target_feed} - contains 'hindi'")
            continue
        
        try:
            parsed_feed = feedparser.parse(target_feed)
        except Exception as e:
            print(f"Feed parsing failed for {target_feed}: {e}")
            continue
        
        feed_title = parsed_feed.feed.get("title", "").lower()
        if "hindi" in feed_title:
            print(f"Skipping feed: {target_feed} - feed title contains 'hindi': {feed_title}")
            continue
        
        if not parsed_feed.entries:
            print(f"No entries found in RSS feed: {target_feed}")
            continue
            
        print(f"Found {len(parsed_feed.entries)} entries in feed: {target_feed}")
        
        for item in parsed_feed.entries:
            if successful_insertions >= MAX_ARTICLES_PER_RUN:
                break
                
            link = item.get("link", "")
            # Check if already processed
            existing = await articles_collection.find_one({"original.source_url": link})
            if existing:
                skipped_existing += 1
                continue
                
            print(f"Processing new article: {item.get('title', 'Unknown')}")
            
            # Process this single article
            try:
                result = await process_article_logic(item, parsed_feed)
                results.append(result)
                
                if result.get("status") == "SUCCESS":
                    successful_insertions += 1
                    processed_count += 1
                elif result.get("status") != "SKIPPED":
                    # Failed pipeline or some other error but it was processed
                    processed_count += 1
                    
            except Exception as e:
                print(f"Critical error processing article item: {e}")
                results.append({"status": "ERROR", "msg": str(e)})
                
    print(f"Finished auto-ingestion cycle. Successfully Ingested: {successful_insertions}, Skipped (already in DB): {skipped_existing}")
            
    if not results:
        return {"status": "SKIPPED", "msg": "No new valid articles found across any feeds in this batch."}
        
    return {"status": "BATCH_COMPLETE", "processed": processed_count, "results": results}
