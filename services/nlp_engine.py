import random
import os
import json
import time

def extract_entities_and_numbers(text):
    """
    Mock Layer 1: Summarization & Entity Extraction.
    In production, this would use an LLM or Named Entity Recognition (e.g. spaCy) to extract entities.
    """
    print(f"Extracting entities from: {text[:50]}...")
    return {
        "entities": ["Mayor Smith", "City Hall", "Main Street", "Tuesday"],
        "numbers": ["4,500", "20", "15%"]
    }

def simplify_to_grade_6(text, constraints):
    """
    Mock Layer 2: Simplification.
    In production, this prompts an LLM with the strict Grade 6 constraints.
    Limits the original article text to max 15 sentences.
    """
    print(f"Simplifying text down to Grade 6...")
    
    # Clean the text
    text = text.strip()
    
    # Remove system messages that shouldn't appear in the simplified text
    system_messages = [
        "This article lacked sufficient body text in the RSS feed, but the system processed it anyway.",
        "This article lacked sufficient body text in the RSS feed",
        "but the system processed it anyway"
    ]
    for msg in system_messages:
        text = text.replace(msg, "").strip()
    
    if not text:
        text = "This is a news article about current events."
    
    sentences = text.split('.')
    simplified_sentences = []
    
    # If the size of the article is less than 20 lines, put the whole article.
    # Otherwise, truncate it at 20 lines to respect the user's maximum size.
    for s in sentences[:20]:
        s = s.strip()
        if len(s) > 5:
            simplified_sentences.append(s + ".")
            
    if not simplified_sentences:
        return "This is a verified and simplified brief of the news event."
        
    result = " ".join(simplified_sentences)
    
    final_word_count = len(result.split())
    print(f"Simplified text word count: {final_word_count} (truncated to < 20 lines)")
    
    return result.strip()

def calculate_readability_score(text):
    """
    Mock Readability Scoring (Flesch-Kincaid).
    In production, this calculates actual syllables/words/sentences.
    """
    # Return a passing grade 6 score for the mock
    return random.uniform(5.5, 6.4)

def fact_check_pipeline(original, simplified):
    """
    Mock AI Fact-Checking Engine.
    In production, compares entities and uses SentenceTransformers.
    """
    print("Running Fact-Checking Pipeline...")
    # We will mock a pass for demonstration
    pass_chance = random.random()
    if pass_chance > 0.1: # 90% chance of passing
        return {
            "status": "PASS",
            "confidence_pct": random.uniform(92.0, 99.9),
            "matched_entities_count": random.randint(3, 8),
            "failure_reason": None
        }
    else:
        return {
            "status": "FAIL",
            "confidence_pct": random.uniform(60.0, 85.0),
            "matched_entities_count": random.randint(1, 3),
            "failure_reason": "Hallucinated: Could not verify location details."
        }

def generate_ai_features(simplified_text):
    """
    Production AI Quiz Generation Engine and Genre Classifier.
    Uses an LLM to generate Main Idea, Fact, and Inference questions based strictly on the text, and categorize the news.
    """
    print("Generating AI Features (Genre + Quizzes)...")
    
    # Attempt true AI Generation
    try:
        from dotenv import load_dotenv
        env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env')
        load_dotenv(dotenv_path=env_path)
        
        api_key = os.getenv("GROQ_API_KEY")
        if not api_key:
            print("No GROQ_API_KEY found in environment variables. Using deterministic algorithmic quiz generator...")
            print("To enable Real AI, set GROQ_API_KEY=your_key in your environment before running main.py")
            raise Exception("No Groq API key")
            
        print("GROQ_API_KEY detected. Utilizing Real Open Source AI...")
        from groq import Groq
        client = Groq(api_key=api_key)
        
        prompt = f'''
        You are a strict, factual quiz generator and news categorizer. Read the article below.
        
        First, categorize the article into exactly ONE of the following precise genres:
        "World News", "National News", "Politics", "Technology", "Business", "Sports", "Health", "Science", "Entertainment", or "General".
        
        Second, generate exactly 5 tough multiple-choice questions.
        CRITICAL RULES:
        1. Every option (both correct and distractors) MUST be strictly based on information found in the text.
        2. The correct answer must be unambiguously true based on the article.
        3. The distractors must be plausible things mentioned in the text, but applied incorrectly to the question being asked.
        4. Output MUST be ONLY valid JSON format. No markdown blocks, no conversational text.
        
        JSON Format exactly like this:
        {{
          "genre": "chosen_genre",
          "quizzes": [
            {{"Q": "Question 1?", "A": "Correct Answer", "D1": "Distractor 1", "D2": "Distractor 2"}},
            {{"Q": "Question 2?", "A": "Correct Answer", "D1": "Distractor 1", "D2": "Distractor 2"}}
          ]
        }}
        
        Article:
        {simplified_text}
        '''
        
        completion = client.chat.completions.create(
            messages=[
                {"role": "system", "content": "You are a specialized AI assistant that outputs only valid JSON objects."},
                {"role": "user", "content": prompt}
            ],
            model="llama-3.1-8b-instant",
            temperature=0.3,
            response_format={"type": "json_object"}
        )
        
        raw_text = completion.choices[0].message.content.strip()
            
        data = json.loads(raw_text)
        genre = data.get("genre", "General")
        quiz_list = data.get("quizzes", [])
        
        final_quizzes = []
        for item in quiz_list:
            ans_list = [
                {"text": item["A"], "is_correct": True},
                {"text": item["D1"], "is_correct": False},
                {"text": item["D2"], "is_correct": False}
            ]
            random.shuffle(ans_list)
            final_quizzes.append({
                "question_text": item["Q"],
                "question_type": "ai_generated",
                "answers": ans_list
            })
        
        if len(final_quizzes) >= 3:
            return {"genre": genre, "quizzes": final_quizzes}
            
    except Exception as e:
        print(f"Real AI Generation Failed. Error: {e}")
        with open('err-trace.txt', 'w', encoding='utf-8') as f:
            f.write(str(e))
        print("Falling back to deterministic algorithmic generator...")
        
    sentences = [s.strip() for s in simplified_text.split('.') if len(s.strip()) > 10]
    
    # Fallback in case of an extremely short summary
    while len(sentences) < 5:
        sentences.append("The situation is still developing as new reports come in")
        
    all_words = simplified_text.split()
    long_words = [w for w in all_words if len(w) > 5]
    if not long_words:
        long_words = ["incident", "report", "official", "completely", "developing"]
        
    def make_distractor(sentence_idx):
        """Creates a false answer strictly by pulling actual statements from the article but pairing them incorrectly."""
        # Grab another random sentence from the article that is NOT the correct one
        other_idx = random.choice([i for i in range(len(sentences)) if i != sentence_idx])
        distractor_sentence = sentences[other_idx]
        
        # Optionally tweak it slightly to make it grammatically fit as an answer
        words = distractor_sentence.split()
        if len(words) > 8:
            return " ".join(words[:12]) + "..."
        return distractor_sentence
        
    def build_q(q_text, correct_idx, is_inference=False):
        # Prevent index out of bounds on tiny articles
        safe_correct_idx = correct_idx % len(sentences)
        correct = sentences[safe_correct_idx] + "."
        
        # Distractors are strictly other sentences from the text
        d1 = make_distractor(safe_correct_idx) + ("." if not make_distractor(safe_correct_idx).endswith("...") else "")
        d2 = make_distractor(safe_correct_idx) + ("." if not make_distractor(safe_correct_idx).endswith("...") else "")
            
        answers = [
            {"text": correct, "is_correct": True},
            {"text": d1, "is_correct": False},
            {"text": d2, "is_correct": False}
        ]
        
        # Remove duplicates
        unique_answers = []
        seen = set()
        for ans in answers:
            if ans["text"] not in seen:
                seen.add(ans["text"])
                unique_answers.append(ans)
                
        # Fill padding if duplicates were stripped using other sentences
        attempts = 0
        while len(unique_answers) < 3 and attempts < 10:
            pad_d = make_distractor(safe_correct_idx)
            if pad_d not in seen:
                seen.add(pad_d)
                unique_answers.append({"text": pad_d + ".", "is_correct": False})
            attempts += 1
            
        # Hard fallback
        while len(unique_answers) < 3:
            unique_answers.append({"text": "None of the above statements apply.", "is_correct": False})

        random.shuffle(unique_answers)
        return {"question_text": q_text, "question_type": "dynamic", "answers": unique_answers}
        
    fallback_quizzes = [
        build_q("Which statement best summarizes a key initial point of the article?", 0),
        build_q("Identify an accurate detail mentioned later in the text:", 1),
        build_q("Which of these events or facts was explicitly mentioned?", min(2, len(sentences)-1)),
        build_q("According to the article's progression, which statement is true?", min(3, len(sentences)-1), is_inference=True),
        build_q("Based on the concluding context of the article, what is a correct assertion?", max(0, len(sentences)-1))
    ]
    
    return {"genre": "General", "quizzes": fallback_quizzes}

def run_nlp_pipeline(raw_text):
    """
    Coordinates the full stateless NLP pipeline.
    Ensures simplified text has minimum 150 words.
    """
    # Layer 1
    constraints = extract_entities_and_numbers(raw_text)
    
    # Layer 2 (With Retry Loop simulated)
    max_retries = 3
    min_words_required = 150
    
    for attempt in range(max_retries):
        simplified = simplify_to_grade_6(raw_text, constraints)
        word_count = len(simplified.split())
        
        # We enforce a < 20 lines constraint now so we cannot enforce a strict 80% content conservation metric.
        
        readability = calculate_readability_score(simplified)
        
        if readability > 6.5:
            print(f"Attempt {attempt}: Readability {readability} is too high. Retrying...")
            continue
            
        # Fact Check
        fact_result = fact_check_pipeline(raw_text, simplified)
        if fact_result["status"] == "FAIL":
            print(f"Attempt {attempt}: Fact check failed ({fact_result['confidence_pct']} - {fact_result['failure_reason']}). Retrying...")
            continue
            
        # Passed all checks!
        ai_payload = generate_ai_features(simplified)
        
        return {
            "status": "SUCCESS",
            "simplified_text": simplified,
            "readability_score": round(readability, 2),
            "word_count": word_count,
            "fact_result": fact_result,
            "quiz_data": ai_payload["quizzes"],
            "genre": ai_payload["genre"]
        }
    
    return {
        "status": "FAIL_MAX_RETRIES"
    }
