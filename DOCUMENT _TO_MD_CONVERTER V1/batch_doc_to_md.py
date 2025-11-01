
import os
import re
import sys
import argparse
import logging
import json
from pathlib import Path
from datetime import datetime

try:
    import openai
except ImportError:
    openai = None

try:
    from dotenv import load_dotenv
    load_dotenv()  # Load environment variables from .env file
except ImportError:
    pass  # dotenv is optional

try:
    import PyPDF2
except ImportError:
    PyPDF2 = None
try:
    from pdfminer.high_level import extract_text as pdfminer_extract_text
except ImportError:
    pdfminer_extract_text = None
try:
    import docx
except ImportError:
    docx = None
try:
    from odf import text as odf_text, teletype
    from odf.opendocument import load as odf_load
except ImportError:
    odf_text = None
    teletype = None
    odf_load = None
try:
    import ebooklib
    from ebooklib import epub
except ImportError:
    ebooklib = None
    epub = None

AUDIO_EXTENSIONS = {'.mp3', '.wav', '.m4a', '.aac', '.flac', '.ogg'}
VIDEO_EXTENSIONS = {'.mp4', '.m4v', '.mov', '.wmv', '.webm', '.mkv', '.avi'}
ARCHIVE_EXTENSIONS = {'.zip'}
MEDIA_EXTENSIONS = AUDIO_EXTENSIONS | VIDEO_EXTENSIONS


def extract_zip_archive(zip_path: Path, output_dir: Path) -> list[Path]:
    """Extract ZIP archive and return list of extractable files."""
    import zipfile
    import tempfile

    extractable_files = []
    temp_dir = None

    try:
        # Create temporary directory for extraction
        temp_dir = Path(tempfile.mkdtemp(prefix="zip_extract_"))
        logging.info("Extracting ZIP: %s to temporary directory", zip_path.name)

        with zipfile.ZipFile(zip_path, 'r') as zip_ref:
            zip_ref.extractall(temp_dir)

        # Find all extractable files recursively
        for extracted_file in temp_dir.rglob('*'):
            if extracted_file.is_file() and extracted_file.suffix.lower() in {'.pdf', '.txt', '.doc', '.docx', '.odt', '.epub'} | MEDIA_EXTENSIONS:
                extractable_files.append(extracted_file)

        logging.info("Found %d extractable files in ZIP: %s", len(extractable_files), zip_path.name)
        return extractable_files, temp_dir

    except Exception as e:
        logging.error("Failed to extract ZIP %s: %s", zip_path.name, e)
        if temp_dir and temp_dir.exists():
            import shutil
            shutil.rmtree(temp_dir, ignore_errors=True)
        return [], None


def transcribe_media(file_path: Path, openai_client, model: str = "whisper-1", language: str | None = None):
    """Use OpenAI Whisper API to transcribe audio or video to text."""
    if not openai_client:
        logging.error("Cannot transcribe %s: OpenAI client not configured", file_path.name)
        return None, {}

    import subprocess
    import tempfile
    import os

    temp_audio_file = None
    try:
        # Check if this is a video file that needs audio extraction
        is_video = file_path.suffix.lower() in VIDEO_EXTENSIONS

        if is_video:
            # Extract audio from video to temporary MP3 file
            logging.info("Extracting audio from video: %s", file_path.name)
            with tempfile.NamedTemporaryFile(suffix='.mp3', delete=False) as temp_file:
                temp_audio_file = temp_file.name

            # Use FFmpeg to extract audio
            ffmpeg_cmd = [
                r"C:\Users\scott\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-8.0-full_build\bin\ffmpeg.exe",
                "-i", str(file_path),
                "-vn",  # No video
                "-acodec", "libmp3lame",
                "-q:a", "2",  # High quality
                "-y",  # Overwrite output
                temp_audio_file
            ]

            result = subprocess.run(ffmpeg_cmd, capture_output=True, text=True)
            if result.returncode != 0:
                logging.error("FFmpeg audio extraction failed for %s: %s", file_path.name, result.stderr)
                return None, {"error": "audio_extraction_failed"}

            # Check the size of the extracted audio
            audio_size = os.path.getsize(temp_audio_file)
            if audio_size > 25 * 1024 * 1024:  # 25MB limit
                audio_size_mb = audio_size / (1024 * 1024)
                logging.error("Extracted audio for %s is still too large (%.1fMB). Video may be too long.",
                             file_path.name, audio_size_mb)
                return None, {"error": "audio_too_large", "size_mb": audio_size_mb}

            transcription_file = temp_audio_file
            logging.info("Audio extracted successfully: %s (%.1fMB)", file_path.name, audio_size / (1024 * 1024))
        else:
            # For audio files, use directly
            transcription_file = file_path

        # Check file size for transcription
        file_size = os.path.getsize(transcription_file)
        max_size = 25 * 1024 * 1024  # 25MB limit for Whisper API

        if file_size > max_size:
            size_mb = file_size / (1024 * 1024)
            logging.error("Cannot transcribe %s: File size (%.1fMB) exceeds OpenAI Whisper limit (25MB). "
                         "Consider using a shorter clip.",
                         file_path.name, size_mb)
            return None, {"error": "file_too_large", "size_mb": size_mb}

        with open(transcription_file, 'rb') as media_file:
            kwargs = {
                "model": model,
                "file": media_file,
            }
            if language:
                kwargs["language"] = language
            response = openai_client.audio.transcriptions.create(**kwargs)
        text = getattr(response, "text", None)
        if not text:
            # Fallback if response behaves like dict
            text = response.get("text") if isinstance(response, dict) else None
        if not text:
            logging.error("Transcription response missing text for %s", file_path.name)
            return None, {}

        logging.info("Transcription completed for %s", file_path.name)
        meta = {}
        return text, meta
    except Exception as exc:
        error_msg = str(exc)
        if "413" in error_msg or "Payload Too Large" in error_msg or "content size limit" in error_msg:
            file_size = os.path.getsize(transcription_file if 'transcription_file' in locals() else file_path) / (1024 * 1024)
            logging.error("Cannot transcribe %s: File size (%.1fMB) exceeds OpenAI Whisper limit (25MB). "
                         "Consider using a shorter clip.",
                         file_path.name, file_size)
            return None, {"error": "file_too_large", "size_mb": file_size}
        elif "401" in error_msg or "Unauthorized" in error_msg:
            logging.error("Cannot transcribe %s: Invalid OpenAI API key. Check your .env file.", file_path.name)
            return None, {"error": "auth_error"}
        elif "429" in error_msg or "rate limit" in error_msg.lower():
            logging.error("Cannot transcribe %s: OpenAI API rate limit exceeded. Try again later.", file_path.name)
            return None, {"error": "rate_limit"}
        else:
            logging.error("Transcription failed for %s: %s", file_path.name, exc)
            return None, {"error": "unknown"}
    finally:
        # Clean up temporary audio file
        if temp_audio_file and os.path.exists(temp_audio_file):
            try:
                os.unlink(temp_audio_file)
                logging.debug("Cleaned up temporary audio file: %s", temp_audio_file)
            except Exception as e:
                logging.warning("Failed to clean up temporary file %s: %s", temp_audio_file, e)


def extract_text(file_path, openai_client=None, transcription_model: str = "whisper-1", transcription_language: str | None = None):
    """Return (text, meta) where meta may include 'doc_title'."""
    meta = {}
    ext = file_path.suffix.lower()
    if ext in MEDIA_EXTENSIONS:
        return transcribe_media(file_path, openai_client, transcription_model, transcription_language)
    if ext == '.pdf':
        if PyPDF2:
            try:
                with open(file_path, 'rb') as f:
                    reader = PyPDF2.PdfReader(f)
                    text = '\n'.join(page.extract_text() or '' for page in reader.pages)
                return text, meta
            except Exception as e:
                logging.error("PyPDF2 failed for %s: %s", file_path.name, e)
        if pdfminer_extract_text:
            try:
                return pdfminer_extract_text(str(file_path)), meta
            except Exception as e:
                logging.error("pdfminer.six failed for %s: %s", file_path.name, e)
        logging.error("No PDF backend available for %s", file_path.name)
        return None, meta
    if ext == '.txt':
        try:
            return file_path.read_text(encoding='utf-8', errors='ignore'), meta
        except Exception as e:
            logging.error("Failed to read TXT %s: %s", file_path.name, e)
            return None, meta
    if ext in {'.docx', '.doc'}:
        if docx:
            try:
                doc_obj = docx.Document(str(file_path))
                text = '\n'.join(p.text for p in doc_obj.paragraphs)
                # core properties
                try:
                    core = doc_obj.core_properties
                    if core and core.title:
                        meta['doc_title'] = core.title.strip()
                except Exception:
                    pass
                return text, meta
            except Exception as e:
                logging.error("python-docx failed for %s: %s", file_path.name, e)
                return None, meta
        logging.error("python-docx not installed for %s", file_path.name)
        return None, meta
    if ext == '.odt':
        if odf_load and teletype:
            try:
                odt_doc = odf_load(str(file_path))
                allparas = odt_doc.getElementsByType(odf_text.P)
                text = '\n'.join(teletype.extractText(p) for p in allparas)
                return text, meta
            except Exception as e:
                logging.error("odfpy failed for %s: %s", file_path.name, e)
                return None, meta
        logging.error("odfpy not installed for %s", file_path.name)
        return None, meta
    if ext == '.epub':
        if epub:
            try:
                book = epub.read_epub(str(file_path))

                # Extract metadata
                if book.get_metadata('DC', 'title'):
                    meta['doc_title'] = book.get_metadata('DC', 'title')[0][0]
                if book.get_metadata('DC', 'creator'):
                    meta['author'] = book.get_metadata('DC', 'creator')[0][0]
                if book.get_metadata('DC', 'publisher'):
                    meta['publisher'] = book.get_metadata('DC', 'publisher')[0][0]
                if book.get_metadata('DC', 'date'):
                    meta['publication_date'] = book.get_metadata('DC', 'date')[0][0]
                if book.get_metadata('DC', 'language'):
                    meta['language'] = book.get_metadata('DC', 'language')[0][0]

                # Extract text from chapters
                text_parts = []
                for item in book.get_items():
                    if item.get_type() == ebooklib.ITEM_DOCUMENT:
                        # Get the content and clean HTML tags
                        content = item.get_content().decode('utf-8')
                        # Simple HTML tag removal - keep basic formatting
                        content = re.sub(r'<[^>]+>', '', content)
                        # Clean up extra whitespace
                        content = re.sub(r'\s+', ' ', content)
                        text_parts.append(content)

                text = '\n\n'.join(text_parts)
                return text, meta
            except Exception as e:
                logging.error("ebooklib failed for %s: %s", file_path.name, e)
                return None, meta
        logging.error("ebooklib not installed for %s", file_path.name)
        return None, meta
    logging.info("Unsupported file type skipped: %s", file_path.name)
    return None, meta

def clean_text(text):
    text = re.sub(r'(?m)^\s*(Page \d+|\d+)\s*$', '', text)
    text = re.sub(r'\n{3,}', '\n\n', text)
    text = re.sub(r'\x0c', '', text)
    text = '\n'.join(line.rstrip() for line in text.splitlines())
    return text.strip()

DATE_PATTERNS = [
    re.compile(r'(20\d{2})[-_](0?[1-9]|1[0-2])[-_](0?[1-9]|[12]\d|3[01])'),
    re.compile(r'(20\d{2})(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])')
]

def detect_date_from_filename(name: str) -> str | None:
    """Enhanced date detection from filenames including Gmail-style dates."""
    base = name.lower()
    
    # First try existing patterns
    for pat in DATE_PATTERNS:
        m = pat.search(base)
        if m:
            try:
                y, mo, d = m.groups()
            except ValueError:
                # second pattern returns 3 groups already split
                y, mo, d = m.group(1), m.group(2), m.group(3)
            date_str = f"{int(y):04d}-{int(mo):02d}-{int(d):02d}"
            return date_str
    
    # Try Gmail style dates like "May 4, 2025"
    gmail_pattern = r'(?i)(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+(\d{1,2}),?\s+(\d{4})'
    match = re.search(gmail_pattern, base)
    if match:
        month_name, day, year = match.groups()
        try:
            month_num = {
                'jan': 1, 'feb': 2, 'mar': 3, 'apr': 4, 'may': 5, 'jun': 6,
                'jul': 7, 'aug': 8, 'sep': 9, 'oct': 10, 'nov': 11, 'dec': 12
            }[month_name.lower()[:3]]
            return f"{year}-{month_num:02d}-{int(day):02d}"
        except (ValueError, KeyError):
            pass
    
    # Try to extract just year as fallback
    year_pattern = r'\b(20\d{2})\b'  # Years from 2000-2099
    match = re.search(year_pattern, base)
    if match:
        year = match.group(1)
        return f"{year}-01-01"  # Default to January 1st
    
    return None

def detect_date_from_content(text: str) -> str | None:
    """Extract date from document content, particularly Gmail-style timestamps."""
    # Look for Gmail timestamp patterns like "Sun, May 4, 2025 at 3:59 PM"
    gmail_timestamp = r'(?i)\w+,?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+(\d{1,2}),?\s+(\d{4})\s+at'
    match = re.search(gmail_timestamp, text)
    if match:
        month_name, day, year = match.groups()
        try:
            month_num = {
                'jan': 1, 'feb': 2, 'mar': 3, 'apr': 4, 'may': 5, 'jun': 6,
                'jul': 7, 'aug': 8, 'sep': 9, 'oct': 10, 'nov': 11, 'dec': 12
            }[month_name.lower()[:3]]
            return f"{year}-{month_num:02d}-{int(day):02d}"
        except (ValueError, KeyError):
            pass
    
    return None

def clean_filename_for_archive(filename: str, detected_type: str = None) -> str:
    """Enhanced filename cleaning for better archiving."""
    
    # Remove file extension
    name = Path(filename).stem
    
    # Common prefixes to remove
    prefixes_to_remove = [
        r'^\d{4}-\d{2}-\d{2}[_\-\s]*',  # Date prefixes
        r'^Gmail\s*[-:]\s*',            # Gmail exports
        r'^Email\s*[-:]\s*',            # Email exports
        r'^Newsletter\s*[-:]\s*',       # Newsletter prefix
        r'^Blog\s*[-:]\s*',             # Blog prefix
        r'^Final\s+Assessment\s+Prep\s+', # Course material
        r'^Week\s+\d+\s*[-:]\s*',       # Week numbers
        r'^Chapter\s+\d+\s*[-:]\s*',    # Chapter numbers
        r'^Section\s+\d+\s*[-:]\s*',    # Section numbers
    ]
    
    # Common suffixes to remove
    suffixes_to_remove = [
        r'\s*[-\(\[]*(draft|final|v\d+|version\s*\d+)[-\)\]]*\s*$',  # Version markers
        r'\s*[-\(\[]*(\d+)[-\)\]]*\s*$',  # Trailing numbers like (1), [2], -3
        r'\s*(blog|post|article|newsletter|guide|document)s?\s*$',  # Document type suffixes
    ]
    
    # Apply prefix removals
    for prefix_pattern in prefixes_to_remove:
        name = re.sub(prefix_pattern, '', name, flags=re.IGNORECASE)
    
    # Apply suffix removals
    for suffix_pattern in suffixes_to_remove:
        name = re.sub(suffix_pattern, '', name, flags=re.IGNORECASE)
    
    # Remove special characters and normalize
    # Keep letters, numbers, spaces, and basic punctuation
    name = re.sub(r'[^\w\s\-]', ' ', name)  # Replace special chars with spaces
    name = re.sub(r'[-_]+', ' ', name)      # Replace dashes/underscores with spaces
    name = re.sub(r'\s+', ' ', name)        # Collapse multiple spaces
    name = name.strip()
    
    # Remove redundant words based on detected document type
    if detected_type:
        type_words = ['blog', 'newsletter', 'guide', 'course', 'exercise', 'reference']
        if detected_type.lower() in type_words:
            # Remove the document type word if it appears in filename
            pattern = r'\b' + re.escape(detected_type.lower()) + r's?\b'
            name = re.sub(pattern, '', name, flags=re.IGNORECASE)
            name = re.sub(r'\s+', ' ', name).strip()
    
    # Title case for better readability
    name = ' '.join(word.capitalize() for word in name.split())
    
    # Truncate if too long (keep under 50 chars for better filesystem compatibility)
    if len(name) > 50:
        words = name.split()
        truncated = ''
        for word in words:
            if len(truncated + ' ' + word) <= 47:  # Leave room for "..."
                truncated = (truncated + ' ' + word).strip()
            else:
                break
        if truncated:
            name = truncated + '...'
        else:
            name = name[:47] + '...'
    
    # Fallback if name becomes empty
    if not name or name == '...':
        name = 'Document'
    
    return name

def infer_headings(text: str) -> str:
    lines = text.splitlines()
    out = []
    for line in lines:
        stripped = line.strip()
        if stripped and not stripped.startswith('#') and 4 <= len(stripped) <= 80:
            if re.fullmatch(r'[A-Z0-9 &\-]+', stripped) and any(c.isalpha() for c in stripped):
                out.append('# ' + stripped.title())
                continue
        out.append(line)
    return '\n'.join(out)

def detect_title(meta, text, file_stem):
    """Enhanced title detection that looks for actual document titles."""
    if meta.get('doc_title'):
        return meta['doc_title']
    
    lines = text.splitlines()
    
    # Skip email headers and look for actual content title
    title_candidates = []
    
    for i, line in enumerate(lines):
        l = line.strip()
        if not l:
            continue
            
        # Skip obvious email headers
        if any(header in l.lower() for header in ['@', 'reply-to:', 'to:', 'from:', 'subject:', 'message']):
            continue
            
        # Skip sender/recipient information
        if re.match(r'^[^<]*<[^>]+@[^>]+>$', l):  # Email format like "Name <email@domain.com>"
            continue
            
        # Look for markdown headers first
        if l.startswith('#'):
            return l.lstrip('#').strip()
            
        # Look for title-like content (not too long, not too short)
        if 5 <= len(l) <= 100:
            # Check if it looks like a title (not a sentence, proper case, etc.)
            words = l.split()
            if len(words) >= 2:
                # Skip lines that look like dates or technical content
                if not re.search(r'\d{1,2}[-/]\d{1,2}[-/]\d{2,4}', l) and not l.lower().startswith('http'):
                    # Prefer lines that are in title case or all caps
                    if l.isupper() or l.istitle() or (words[0].isupper() and any(w.isupper() for w in words[1:])):
                        title_candidates.append((i, l, len(l)))
    
    # If we found title candidates, pick the first one that's not too early in the document
    # (to skip headers) and not too late (to avoid picking content)
    if title_candidates:
        # Sort by position, prefer titles that appear early but after headers
        for pos, title, length in sorted(title_candidates):
            if pos >= 2:  # Skip first few lines which are likely headers
                return title
        
        # If no good positioned title, take the first candidate
        return title_candidates[0][1]
    
    # Fallback: look for any reasonably short line that might be a title
    for line in lines:
        l = line.strip()
        if l and 5 <= len(l) <= 120 and not any(header in l.lower() for header in ['@', 'reply-to:', 'to:', 'from:']):
            return l
    
    # Final fallback: use cleaned filename
    return file_stem

def generate_ai_metadata(text: str, title: str, openai_api_key: str = None, metadata_hint: str = None) -> dict:
    """Generate AI-powered metadata from document content."""
    metadata = {
        'summary': '',
        'tags': [],
        'category': 'unknown',
        'content_type': 'unknown',
        'reading_time': estimate_reading_time(text),
        'word_count': len(text.split()),
        'key_topics': []
    }
    
    if not openai_api_key or not openai:
        # Fallback to rule-based analysis
        return generate_fallback_metadata(text, title)
    
    try:
        client = openai.OpenAI(api_key=openai_api_key)
        
        # Truncate text for API if too long (keep first 3000 chars for context)
        sample_text = text[:3000] + ('...' if len(text) > 3000 else '')
        
        prompt = f"""Analyze this document and provide metadata in JSON format. Focus on the actual document content, not email headers or metadata.

Title: {title}
Content: {sample_text}
{f'Additional Context: {metadata_hint}' if metadata_hint else ''}

IMPORTANT: 
- If the content appears to be an email newsletter, identify the ACTUAL article title within the content, not the sender/email headers
- Look for the main subject or headline of the document content itself
- Ignore email addresses, "Reply-To" lines, sender names, and email metadata
- Focus on the substantive content and its main theme
- Extract the actual author(s) from the document content (look for "By", "Author:", "Contributors", etc.)
- Look for copyright information (© symbol, "Copyright", publication dates, publishers)

Return JSON with these fields:
- title: The actual document/article title (ignore email headers, look for the main content title)
- author: The actual author(s) from the document content (not email senders)
- copyright: Copyright information if found (format: "© YEAR HOLDER" or "Published by PUBLISHER")
- summary: 2-sentence summary of main content
- tags: array of 3-6 relevant tags (lowercase, single words or short phrases)
- category: one of [Newsletter, Blog, Course, Guide, Exercise, Reference, Personal]
- content_type: one of [fitness, nutrition, coaching, business, education, personal-development, health]
- key_topics: array of 2-4 main topics discussed

Example format:
{{"title": "The Real Article Title", "author": "John Smith, Jane Doe", "copyright": "© 2021 ISSA LLC", "summary": "Brief description of content...", "tags": ["fitness", "motivation", "coaching"], "category": "Newsletter", "content_type": "fitness", "key_topics": ["workout planning", "mindset"]}}
"""
        
        response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=300,
            temperature=0.3
        )
        
        ai_metadata = json.loads(response.choices[0].message.content)
        metadata.update(ai_metadata)
        logging.info("AI metadata generated successfully for %s", title)
        
    except Exception as e:
        logging.warning("AI metadata generation failed for %s: %s. Using fallback.", title, e)
        return generate_fallback_metadata(text, title)
    
    return metadata

def generate_fallback_metadata(text: str, title: str) -> dict:
    """Generate metadata using rule-based analysis when AI is unavailable."""
    
    # Basic categorization based on keywords
    text_lower = text.lower()
    title_lower = title.lower()
    
    # Determine category
    if any(word in title_lower for word in ['newsletter', 'weekly', 'monthly']):
        category = 'Newsletter'
    elif any(word in title_lower for word in ['week', 'assessment', 'prep', 'course']):
        category = 'Course'
    elif any(word in text_lower for word in ['coach', 'training', 'exercise']):
        category = 'Guide'
    else:
        category = 'Reference'
    
    # Determine content type
    if any(word in text_lower for word in ['workout', 'training', 'exercise', 'fitness']):
        content_type = 'fitness'
    elif any(word in text_lower for word in ['nutrition', 'diet', 'eating', 'food']):
        content_type = 'nutrition'
    elif any(word in text_lower for word in ['coach', 'mindset', 'motivation', 'goal']):
        content_type = 'coaching'
    elif any(word in text_lower for word in ['health', 'wellness', 'recovery']):
        content_type = 'health'
    else:
        content_type = 'personal-development'
    
    # Generate basic tags
    potential_tags = []
    keywords = ['fitness', 'nutrition', 'coaching', 'training', 'mindset', 'motivation', 
               'goals', 'health', 'wellness', 'recovery', 'performance', 'community']
    
    for keyword in keywords:
        if keyword in text_lower:
            potential_tags.append(keyword)
    
    tags = potential_tags[:5] if potential_tags else ['general']
    
    # Simple summary (first sentence or title-based)
    sentences = re.split(r'[.!?]+', text.strip())
    first_sentence = sentences[0].strip() if sentences else title
    summary = f"Document about {content_type}. {first_sentence[:100]}..." if len(first_sentence) > 100 else first_sentence
    
    return {
        'summary': summary,
        'tags': tags,
        'category': category,
        'content_type': content_type,
        'reading_time': estimate_reading_time(text),
        'word_count': len(text.split()),
        'key_topics': tags[:3]
    }

def detect_author(text: str) -> str:
    """Extract author information from document content."""
    lines = text.splitlines()
    
    # Look for common author patterns
    author_patterns = [
        r'(?i)by\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]*\.?)*(?:\s+[A-Z][a-z]+)*)',  # "By John Smith"
        r'(?i)author[s]?:\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]*\.?)*(?:\s+[A-Z][a-z]+)*)',  # "Author: John Smith"
        r'(?i)written\s+by\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]*\.?)*(?:\s+[A-Z][a-z]+)*)',  # "Written by John Smith"
    ]
    
    # Check first 50 lines for author information
    for i, line in enumerate(lines[:50]):
        line = line.strip()
        if not line:
            continue
            
        # Try author patterns
        for pattern in author_patterns:
            match = re.search(pattern, line)
            if match:
                return match.group(1).strip()
        
        # Look for standalone names (likely authors) in early lines
        # Skip lines that look like email headers or technical content
        if not any(x in line.lower() for x in ['@', 'http', 'www', 'reply-to', 'subject:', 'message']):
            # Look for lines that might be author names (format: "FirstName LastName, Credentials")
            name_pattern = r'^([A-Z][a-z]+(?:\s+[A-Z][a-z]*\.?)*(?:\s+[A-Z][a-z]+)*),?\s*(?:[A-Z]{1,4})?$'
            match = re.match(name_pattern, line)
            if match and len(match.group(1).split()) >= 2:  # At least first and last name
                return match.group(1).strip()
    
    # Look for "Contributors" section
    contributors = []
    in_contributors = False
    for line in lines[:100]:  # Check first 100 lines
        if 'contributors' in line.lower() or 'authors' in line.lower():
            in_contributors = True
            continue
        if in_contributors:
            # Stop if we hit a major section
            if line.startswith('#') and len(line.strip()) > 10:
                break
            # Extract names from contributor lines
            name_match = re.search(r'^([A-Z][a-z]+(?:\s+[A-Z][a-z]*\.?)*(?:\s+[A-Z][a-z]+)*)', line.strip())
            if name_match and len(name_match.group(1).split()) >= 2:
                contributors.append(name_match.group(1))
            if len(contributors) >= 3:  # Don't get too many
                break
    
    if contributors:
        if len(contributors) == 1:
            return contributors[0]
        elif len(contributors) <= 3:
            return ', '.join(contributors)
        else:
            return f"{contributors[0]} et al."
    
    return "unknown"

def detect_copyright(text: str, author: str = None) -> str:
    """Extract copyright information from document content."""
    lines = text.splitlines()
    
    # Look for copyright patterns in first 200 lines (usually near the beginning)
    copyright_patterns = [
        r'(?i)copyright\s*©\s*(\d{4}(?:-\d{4})?)\s+(.+?)(?:\n|$)',  # Copyright © 2021 ISSA LLC
        r'(?i)©\s*(\d{4}(?:-\d{4})?)\s+(.+?)(?:\n|$)',  # © 2021 ISSA LLC
        r'(?i)copyright\s+(\d{4}(?:-\d{4})?)\s+(.+?)(?:\n|$)',  # Copyright 2021 ISSA LLC
        r'(?i)\(c\)\s*(\d{4}(?:-\d{4})?)\s+(.+?)(?:\n|$)',  # (c) 2021 ISSA LLC
    ]
    
    for i, line in enumerate(lines[:200]):
        line = line.strip()
        if not line:
            continue
            
        for pattern in copyright_patterns:
            match = re.search(pattern, line)
            if match:
                year = match.group(1)
                holder = match.group(2).strip()
                
                # Clean up the copyright holder
                # Remove trailing punctuation and common suffixes
                holder = re.sub(r'[,.\s]+$', '', holder)
                holder = re.sub(r'\s+All rights reserved.*$', '', holder, flags=re.IGNORECASE)
                holder = re.sub(r'\s+Produced by.*$', '', holder, flags=re.IGNORECASE)
                
                if holder and len(holder) > 2:  # Valid copyright holder
                    return f"© {year} {holder}"
    
    # Look for alternative patterns like "Published by" or "Publisher:"
    publisher_patterns = [
        r'(?i)published\s+by\s+(.+?)(?:\n|,|\.|$)',
        r'(?i)publisher:\s*(.+?)(?:\n|,|\.|$)',
    ]
    
    for i, line in enumerate(lines[:100]):
        line = line.strip()
        for pattern in publisher_patterns:
            match = re.search(pattern, line)
            if match:
                publisher = match.group(1).strip()
                publisher = re.sub(r'[,.\s]+$', '', publisher)
                if publisher and len(publisher) > 2:
                    return f"Published by {publisher}"
    
    # If no copyright found and we have an author, default to author
    if author and author != "unknown":
        return author
    
    return "unknown"

def estimate_reading_time(text: str) -> int:
    """Estimate reading time in minutes (average 200 words per minute)."""
    word_count = len(text.split())
    return max(1, round(word_count / 200))

def write_markdown(md_path, title, source_ext, body, date_original, ai_metadata=None):
    # Detect author first, then copyright (which may fall back to author)
    detected_author = detect_author(body)
    detected_copyright = detect_copyright(body, detected_author)
    
    # Use AI metadata if available, otherwise defaults
    if ai_metadata:
        # Use AI-generated values if available, otherwise fall back to detected ones
        final_title = ai_metadata.get('title', title)
        author = ai_metadata.get('author', detected_author)
        # If AI didn't find copyright, use detected copyright (which may fall back to author)
        copyright_info = ai_metadata.get('copyright', detected_copyright)
        # If copyright falls back to author but we have an AI-detected author, use that instead
        if copyright_info == detected_author and author != detected_author:
            copyright_info = author
        doc_type = ai_metadata.get('category', 'unknown')
        tags = ai_metadata.get('tags', [])
        summary = ai_metadata.get('summary', '')
        content_type = ai_metadata.get('content_type', 'unknown')
        word_count = ai_metadata.get('word_count', len(body.split()))
        reading_time = ai_metadata.get('reading_time', 1)
        key_topics = ai_metadata.get('key_topics', [])
    else:
        final_title = title
        author = detected_author
        copyright_info = detected_copyright
        doc_type = "unknown"
        tags = []
        summary = ""
        content_type = "unknown"
        word_count = len(body.split())
        reading_time = max(1, round(word_count / 200))
        key_topics = []
    
    yaml = (
        '---\n'
        f'title: "{final_title}"\n'
        f'author: "{author}"\n'
        f'copyright: "{copyright_info}"\n'
        f'type: "{doc_type}"\n'
        f'content_type: "{content_type}"\n'
        f'source: "{source_ext}"\n'
        f'tags: {json.dumps(tags)}\n'
        f'date_original: "{date_original or "unknown"}"\n'
        f'summary: "{summary}"\n'
        f'word_count: {word_count}\n'
        f'reading_time: {reading_time}\n'
        f'key_topics: {json.dumps(key_topics)}\n'
        'archived: true\n'
        'version: 1.0\n'
        '---\n\n'
    )
    md_path.write_text(yaml + body, encoding='utf-8')

def parse_args(argv=None):
    p = argparse.ArgumentParser(description="Batch convert documents (PDF, TXT, DOCX, DOC, ODT, EPUB) and transcribe audio/video (MP3, WAV, MP4, etc.) to Markdown with YAML front matter.")
    p.add_argument('--input', '-i', default='input_docs', help='Input folder (default: input_docs)')
    p.add_argument('--output', '-o', default='output_md', help='Output folder (default: output_md)')
    p.add_argument('--date', help='Override date prefix (YYYY-MM-DD) for all output files')
    p.add_argument('--force', action='store_true', help='Overwrite / re-generate existing markdown files')
    p.add_argument('--log-file', help='Optional log file path')
    p.add_argument('--prefix', help='Optional filename prefix before date')
    p.add_argument('--openai-key', help='OpenAI API key for AI-powered metadata generation and transcription')
    p.add_argument('--no-ai', action='store_true', help='Disable AI metadata generation (use fallback only)')
    p.add_argument('--no-clean-filenames', action='store_true', help='Disable enhanced filename cleaning (keep original names)')
    p.add_argument('--transcribe-model', default='whisper-1', help='OpenAI model to use for audio/video transcription (default: whisper-1)')
    p.add_argument('--transcribe-language', help='Optional language hint for transcription (e.g., en)')
    p.add_argument('--recursive', '-r', action='store_true', help='Recursively search subfolders for files to convert')
    p.add_argument('--metadata-hint', help='Optional context to improve AI metadata generation (e.g., "Author: John Doe, Series: Podcast Name")')
    return p.parse_args(argv)

def configure_logging(log_file: str | None):
    handlers = [logging.StreamHandler(sys.stdout)]
    if log_file:
        handlers.append(logging.FileHandler(log_file, encoding='utf-8'))
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s [%(levelname)s] %(message)s',
        handlers=handlers
    )

def main(argv=None):
    args = parse_args(argv)
    configure_logging(args.log_file)
    input_dir = Path(args.input)
    output_dir = Path(args.output)
    output_dir.mkdir(parents=True, exist_ok=True)
    if not input_dir.exists():
        logging.error("Input folder %s does not exist", input_dir)
        sys.exit(1)

    override_date = None
    if args.date:
        try:
            override_date = datetime.strptime(args.date, '%Y-%m-%d').strftime('%Y-%m-%d')
        except ValueError:
            logging.error("--date must be in YYYY-MM-DD format")
            sys.exit(2)

    supported = {'.pdf', '.txt', '.doc', '.docx', '.odt', '.epub'} | MEDIA_EXTENSIONS | ARCHIVE_EXTENSIONS

    openai_key = args.openai_key or os.environ.get('OPENAI_API_KEY')
    openai_client = None
    if openai_key and openai:
        try:
            openai_client = openai.OpenAI(api_key=openai_key)
        except Exception as exc:
            logging.error("Failed to initialize OpenAI client: %s", exc)
            openai_client = None
    elif any(ext in MEDIA_EXTENSIONS for ext in supported):
        if not args.no_transcription:
            logging.info("Media transcription requires an OpenAI API key. Provide --openai-key or set OPENAI_API_KEY.")

    # Get all files to process
    if args.recursive:
        all_files = sorted(input_dir.rglob('*'))
        logging.info("Recursive mode: searching %d total items in %s", len(all_files), input_dir)
    else:
        all_files = sorted(input_dir.iterdir())
        logging.info("Processing %d items in %s", len(all_files), input_dir)

    # Track temporary directories for cleanup
    temp_dirs = []

    for file_path in all_files:
        # Skip directories
        if file_path.is_dir():
            continue
        if file_path.suffix.lower() not in supported:
            continue
        if file_path.suffix.lower() in MEDIA_EXTENSIONS and args.no_transcription:
            logging.info("Skipping %s (transcription disabled)", file_path.name)
            continue

        # Handle ZIP archives
        if file_path.suffix.lower() in ARCHIVE_EXTENSIONS:
            logging.info("Processing ZIP archive: %s", file_path.name)
            extracted_files, temp_dir = extract_zip_archive(file_path, output_dir)
            if temp_dir:
                temp_dirs.append(temp_dir)

            # Process each extracted file
            for extracted_file in extracted_files:
                logging.info("Processing extracted file: %s", extracted_file.name)
                text, meta = extract_text(
                    extracted_file,
                    openai_client=openai_client,
                    transcription_model=args.transcribe_model,
                    transcription_language=args.transcribe_language
                )
                if not text:
                    error_type = meta.get("error")
                    if error_type == "file_too_large":
                        size_mb = meta.get("size_mb", "unknown")
                        logging.error("Skipping %s: File too large (%.1fMB). OpenAI Whisper has a 25MB limit. "
                                     "Try compressing the video or using a shorter clip.", extracted_file.name, size_mb)
                    elif error_type == "audio_too_large":
                        size_mb = meta.get("size_mb", "unknown")
                        logging.error("Skipping %s: Extracted audio is too large (%.1fMB). Video may be too long. "
                                     "Try using a shorter video clip.", extracted_file.name, size_mb)
                    elif error_type == "audio_extraction_failed":
                        logging.error("Skipping %s: Failed to extract audio from video. Check FFmpeg installation.", extracted_file.name)
                    elif error_type == "auth_error":
                        logging.error("Skipping %s: OpenAI API authentication failed. Check your API key in .env file.", extracted_file.name)
                    elif error_type == "rate_limit":
                        logging.error("Skipping %s: OpenAI API rate limit exceeded. Try again later.", extracted_file.name)
                    else:
                        logging.warning("Skipping %s (no text extracted)", extracted_file.name)
                    continue

                # Process the extracted file (same logic as regular files)
                clean = clean_text(text)
                clean = infer_headings(clean)
                title = detect_title(meta, clean, extracted_file.stem)

                # Generate AI metadata if enabled and API key provided
                ai_metadata = None
                metadata_type = "fallback"

                if not args.no_ai and openai_client:
                    logging.info("Generating AI metadata for %s", title)
                    ai_metadata = generate_ai_metadata(clean, title, openai_client.api_key, getattr(args, 'metadata_hint', None))
                    metadata_type = "AI-generated"
                else:
                    if args.no_ai:
                        logging.info("AI metadata disabled, using fallback for %s", title)

                # Create output filename with relative path structure
                relative_path = extracted_file.relative_to(temp_dir)
                base_filename = str(relative_path).replace(extracted_file.suffix, '').replace('/', '_').replace('\\', '_')
                md_name = f"{base_filename}.md"
                md_path = output_dir / md_name

                # Check if output already exists
                if md_path.exists() and not args.force:
                    logging.info("Skipping existing (use --force to overwrite): %s", md_path.name)
                    continue

                detected_date = detect_date_from_filename(extracted_file.name)
                write_markdown(md_path, title, extracted_file.suffix[1:], clean, override_date or detected_date, ai_metadata)
                logging.info("Saved %s with %s metadata", md_path.name, metadata_type)
            continue

        # Handle regular files (non-ZIP)
        logging.info("Processing %s", file_path.name)
        text, meta = extract_text(
            file_path,
            openai_client=openai_client,
            transcription_model=args.transcribe_model,
            transcription_language=args.transcribe_language
        )
        if not text:
            error_type = meta.get("error")
            if error_type == "file_too_large":
                size_mb = meta.get("size_mb", "unknown")
                logging.error("Skipping %s: File too large (%.1fMB). OpenAI Whisper has a 25MB limit. "
                             "Try compressing the video or using a shorter clip.", file_path.name, size_mb)
            elif error_type == "audio_too_large":
                size_mb = meta.get("size_mb", "unknown")
                logging.error("Skipping %s: Extracted audio is too large (%.1fMB). Video may be too long. "
                             "Try using a shorter video clip.", file_path.name, size_mb)
            elif error_type == "audio_extraction_failed":
                logging.error("Skipping %s: Failed to extract audio from video. Check FFmpeg installation.", file_path.name)
            elif error_type == "auth_error":
                logging.error("Skipping %s: OpenAI API authentication failed. Check your API key in .env file.", file_path.name)
            elif error_type == "rate_limit":
                logging.error("Skipping %s: OpenAI API rate limit exceeded. Try again later.", file_path.name)
            else:
                logging.warning("Skipping %s (no text extracted)", file_path.name)
            continue
        clean = clean_text(text)
        clean = infer_headings(clean)
        title = detect_title(meta, clean, file_path.stem)
        
        # Generate AI metadata if enabled and API key provided
        ai_metadata = None
        metadata_type = "fallback"
        
        if not args.no_ai and openai_client:
            logging.info("Generating AI metadata for %s", title)
            ai_metadata = generate_ai_metadata(clean, title, openai_client.api_key, getattr(args, 'metadata_hint', None))
            metadata_type = "AI-generated"
        else:
            if args.no_ai:
                logging.info("AI metadata disabled, using fallback for %s", title)
            else:
                logging.info("No OpenAI API key provided, using fallback metadata for %s", title)
            ai_metadata = generate_fallback_metadata(clean, title)
        
        detected_date = detect_date_from_filename(file_path.name)
        if not detected_date:
            detected_date = detect_date_from_content(clean)
        
        # Clean filename for better archiving (unless disabled)
        if args.no_clean_filenames:
            clean_name = file_path.stem
            logging.info("Using original filename: %s", clean_name)
        else:
            doc_type = ai_metadata.get('category', 'unknown') if ai_metadata else 'unknown'
            clean_name = clean_filename_for_archive(file_path.stem, doc_type)
            logging.info("Cleaned filename: '%s' -> '%s'", file_path.stem, clean_name)
        
        # Use cleaned filename directly without date prefix (date goes in metadata)
        pieces = []
        if args.prefix:
            pieces.append(args.prefix)
        pieces.append(clean_name)
        base_filename = '_'.join(pieces) if pieces else clean_name
        md_name = f"{base_filename}.md"
        md_path = output_dir / md_name
        if md_path.exists() and not args.force:
            logging.info("Skipping existing (use --force to overwrite): %s", md_path.name)
            continue
        write_markdown(md_path, title, file_path.suffix[1:], clean, detected_date, ai_metadata)
        logging.info("Saved %s with %s metadata", md_path.name, metadata_type)

    # Clean up temporary directories from ZIP extraction
    import shutil
    for temp_dir in temp_dirs:
        try:
            if temp_dir.exists():
                shutil.rmtree(temp_dir, ignore_errors=True)
                logging.debug("Cleaned up temporary directory: %s", temp_dir)
        except Exception as e:
            logging.warning("Failed to clean up temporary directory %s: %s", temp_dir, e)

if __name__ == '__main__':
    main()
