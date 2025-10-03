import os
import logging
import re
from typing import List, Dict, Optional
from datetime import datetime
import google.generativeai as genai
import pypdf
from sqlalchemy.orm import Session
from database import SessionLocal
from models import Chatbot, Document as DocModel, DocumentChunk, ChatbotType, DocumentStatus
from config import settings

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class SimplifiedRAGSystem:
    """Lightweight RAG system that works within free hosting constraints"""
    
    def __init__(self):
        self._initialize_gemini()
    
    def _initialize_gemini(self):
        """Initialize Gemini API client"""
        try:
            genai.configure(api_key=settings.gemini_api_key)
            self.model = genai.GenerativeModel('gemini-pro')
            logger.info("✅ Gemini API initialized")
        except Exception as e:
            logger.error(f"❌ Error initializing Gemini: {e}")
            raise
    
    async def process_pdf(self, file_path: str, filename: str, chatbot_id: int) -> Dict:
        """Process PDF and store in database with simple text extraction"""
        db = SessionLocal()
        doc_record = None
        
        try:
            # Create document record
            doc_record = DocModel(
                chatbot_id=chatbot_id,
                filename=f"student_{int(datetime.now().timestamp())}_{filename}",
                original_filename=filename,
                file_path=file_path,
                file_size=os.path.getsize(file_path),
                status=DocumentStatus.PROCESSING
            )
            db.add(doc_record)
            db.commit()
            db.refresh(doc_record)
            
            logger.info(f"📄 Processing PDF: {filename}")
            
            # Extract text from PDF using pypdf
            text_content = ""
            page_count = 0
            
            with open(file_path, 'rb') as file:
                pdf_reader = pypdf.PdfReader(file)
                page_count = len(pdf_reader.pages)
                
                for page_num, page in enumerate(pdf_reader.pages):
                    try:
                        page_text = page.extract_text()
                        if page_text.strip():
                            text_content += f"\n--- Page {page_num + 1} ---\n{page_text}\n"
                    except Exception as e:
                        logger.warning(f"Could not extract text from page {page_num + 1}: {e}")
            
            if not text_content.strip():
                raise ValueError("No text content extracted from PDF")
            
            # Simple text chunking (split by pages or size)
            chunks = self._create_text_chunks(text_content, filename)
            
            # Save chunks to database
            for i, chunk_data in enumerate(chunks):
                chunk_record = DocumentChunk(
                    document_id=doc_record.id,
                    chunk_index=i,
                    text_content=chunk_data['text'],
                    page_number=chunk_data['page'],
                    embedding_id=f"chunk_{doc_record.id}_{i}"
                )
                db.add(chunk_record)
            
            # Update document record
            doc_record.status = DocumentStatus.READY
            doc_record.page_count = page_count
            doc_record.chunk_count = len(chunks)
            doc_record.processed_at = datetime.utcnow()
            
            db.commit()
            
            # Clean up file
            if os.path.exists(file_path):
                os.remove(file_path)
            
            result = {
                "status": "success",
                "document_id": doc_record.id,
                "filename": filename,
                "pages": page_count,
                "chunks": len(chunks),
                "message": f"Successfully processed {filename}"
            }
            
            logger.info(f"✅ PDF processing completed: {filename}")
            return result
            
        except Exception as e:
            logger.error(f"❌ Error processing PDF {filename}: {e}")
            
            # Update document status to failed
            if doc_record:
                doc_record.status = DocumentStatus.FAILED
                doc_record.processing_error = str(e)
                db.commit()
            
            # Clean up file
            if os.path.exists(file_path):
                os.remove(file_path)
            
            return {
                "status": "error",
                "filename": filename,
                "error": str(e)
            }
        
        finally:
            db.close()
    
    def _create_text_chunks(self, text_content: str, filename: str) -> List[Dict]:
        """Create simple text chunks without vector embeddings"""
        chunks = []
        lines = text_content.split('\n')
        current_chunk = ""
        current_page = 1
        
        for line in lines:
            # Check for page markers
            if line.strip().startswith("--- Page "):
                if current_chunk.strip():
                    chunks.append({
                        'text': current_chunk.strip(),
                        'page': current_page,
                        'filename': filename
                    })
                    current_chunk = ""
                
                # Extract page number
                try:
                    current_page = int(line.split("Page ")[1].split(" ---")[0])
                except:
                    current_page += 1
                continue
            
            current_chunk += line + "\n"
            
            # Create chunk if it gets too long
            if len(current_chunk) > settings.chunk_size:
                chunks.append({
                    'text': current_chunk.strip(),
                    'page': current_page,
                    'filename': filename
                })
                current_chunk = ""
        
        # Add final chunk
        if current_chunk.strip():
            chunks.append({
                'text': current_chunk.strip(),
                'page': current_page,
                'filename': filename
            })
        
        return chunks
    
    async def query_student_bot(self, question: str, session_id: str = None) -> Dict:
        """Answer questions using simple keyword search + Gemini with natural conversation handling"""
        try:
            logger.info(f"🤔 Student question: {question}")
            start_time = datetime.now()
            
            # Handle conversational messages before document search
            question_lower = question.lower().strip()
            
            # Handle greetings
            greetings = ['hello', 'hi', 'hey', 'good morning', 'good afternoon', 'good evening', 'howdy']
            if any(greeting in question_lower for greeting in greetings):
                return {
                    "answer": "Hello! I'm here to help you with your academic questions. You can ask me about courses, policies, deadlines, graduation requirements, and more. What would you like to know?",
                    "sources": [],
                    "response_time_ms": 50,
                    "session_id": session_id
                }
            
            # Handle thanks/gratitude
            thanks_words = ['thank', 'thanks', 'appreciate', 'grateful']
            if any(word in question_lower for word in thanks_words):
                return {
                    "answer": "You're very welcome! I'm glad I could help. Feel free to ask if you have any other questions about your studies or academic matters.",
                    "sources": [],
                    "response_time_ms": 50,
                    "session_id": session_id
                }
            
            # Handle goodbyes
            goodbye_words = ['bye', 'goodbye', 'see you', 'farewell', 'take care']
            if any(word in question_lower for word in goodbye_words):
                return {
                    "answer": "Goodbye! Have a great day with your studies. Remember, I'm here whenever you need help with academic questions.",
                    "sources": [],
                    "response_time_ms": 50,
                    "session_id": session_id
                }
            
            # Handle how are you / status questions
            status_questions = ['how are you', 'how do you do', 'what are you', 'who are you']
            if any(phrase in question_lower for phrase in status_questions):
                return {
                    "answer": "I'm your PUPQC student support assistant! I'm still learning and growing to help students better. I can assist you with academic questions using information from official documents. What can I help you with today?",
                    "sources": [],
                    "response_time_ms": 50,
                    "session_id": session_id
                }
            
            # For actual academic questions, search documents
            relevant_chunks = self._search_documents(question)
            
            if not relevant_chunks:
                return {
                    "answer": "I'm still learning about that topic! For the most current information, you might want to check the PUPQC student portal, visit the registrar's office, or ask your academic advisor. Is there something else about student life or academics I can help with?",
                    "sources": [],
                    "response_time_ms": 0,
                    "session_id": session_id
                }
            
            # Create context from relevant chunks
            context = self._build_context(relevant_chunks)
            
            # Generate response using Gemini with natural instructions
            prompt = f"""
You are a friendly PUPQC student support assistant. Answer the question based on the provided context from official student documents.

Guidelines:
- Write in a natural, conversational tone like a helpful student assistant
- NEVER mention page numbers, document names, or technical references
- Use bullet points (•) for lists, not asterisks (*)
- If information seems incomplete, acknowledge you're still learning
- Keep answers clear, friendly, and helpful for students
- Focus on being genuinely helpful rather than robotic

Context:
{context}

Question: {question}

Please provide a helpful, natural answer without any technical references:
"""
            
            response = self.model.generate_content(prompt)
            answer = response.text
            
            # Additional cleaning of technical artifacts that might slip through
            answer = self._clean_response(answer)
            
            # Format sources (but don't include in answer)
            sources = [
                {
                    "page": chunk['page'],
                    "filename": chunk['filename'],
                    "chunk_id": chunk['document_id']
                }
                for chunk in relevant_chunks
            ]
            
            response_time = (datetime.now() - start_time).total_seconds() * 1000
            
            # Log conversation
            await self._log_conversation(question, answer, sources, response_time, session_id)
            
            result = {
                "answer": answer,
                "sources": sources,
                "response_time_ms": int(response_time),
                "session_id": session_id
            }
            
            logger.info(f"✅ Response generated in {response_time:.0f}ms")
            return result
            
        except Exception as e:
            logger.error(f"❌ Error answering question: {e}")
            return {
                "answer": "I'm having trouble processing that right now - let me try again! You could also try rephrasing your question or asking about something else related to PUPQC academics.",
                "sources": [],
                "response_time_ms": 0,
                "session_id": session_id,
                "error": str(e)
            }
    
    def _clean_response(self, answer: str) -> str:
        """Clean response to remove technical artifacts and improve formatting"""
        # Remove technical references that Gemini might still include
        answer = re.sub(r'page\s+\d+(?:[-–]\d+)?', '', answer, flags=re.IGNORECASE)
        answer = re.sub(r'pages?\s+\d+(?:,\s*\d+)*(?:,?\s*and\s*\d+)?', '', answer, flags=re.IGNORECASE)
        answer = re.sub(r'document\s+\d+', '', answer, flags=re.IGNORECASE)
        answer = re.sub(r'section\s+\d+(?:\.\d+)*', '', answer, flags=re.IGNORECASE)
        answer = re.sub(r'\*\s*', '• ', answer)  # Convert asterisks to bullets
        answer = re.sub(r'\s+', ' ', answer).strip()  # Clean extra whitespace
        
        return answer
    
    def _search_documents(self, question: str, limit: int = 5) -> List[Dict]:
        """Simple keyword-based document search using PostgreSQL full-text search"""
        db = SessionLocal()
        try:
            # Get student chatbot
            student_bot = db.query(Chatbot).filter(Chatbot.type == ChatbotType.STUDENT).first()
            if not student_bot:
                logger.warning("No student chatbot found in database")
                return []
            
            # Simple keyword search in document chunks
            search_terms = question.lower().split()
            
            # Query document chunks
            chunks = db.query(DocumentChunk).join(DocModel).filter(
                DocModel.chatbot_id == student_bot.id,
                DocModel.status == DocumentStatus.READY
            ).all()
            
            # Score chunks based on keyword matches
            scored_chunks = []
            for chunk in chunks:
                text_lower = chunk.text_content.lower()
                score = sum(1 for term in search_terms if term in text_lower)
                
                if score > 0:
                    scored_chunks.append({
                        'score': score,
                        'text': chunk.text_content,
                        'page': chunk.page_number,
                        'document_id': chunk.document_id,
                        'filename': chunk.document.original_filename
                    })
            
            # Sort by score and return top results
            scored_chunks.sort(key=lambda x: x['score'], reverse=True)
            return scored_chunks[:limit]
        
        except Exception as e:
            logger.error(f"Error searching documents: {e}")
            return []
        finally:
            db.close()
    
    def _build_context(self, chunks: List[Dict]) -> str:
        """Build context string from relevant chunks"""
        context_parts = []
        for chunk in chunks:
            context_parts.append(f"[Page {chunk['page']} - {chunk['filename']}]\n{chunk['text']}\n")
        
        return "\n---\n".join(context_parts)
    
    async def _log_conversation(self, question: str, answer: str, sources: List, response_time: float, session_id: str):
        """Log conversation for analytics"""
        if not settings.analytics_enabled:
            return
        
        db = SessionLocal()
        try:
            student_bot = db.query(Chatbot).filter(Chatbot.type == ChatbotType.STUDENT).first()
            if student_bot:
                from models import Conversation
                conversation = Conversation(
                    chatbot_id=student_bot.id,
                    session_id=session_id or "anonymous",
                    user_message=question,
                    bot_response=answer,
                    response_time_ms=int(response_time),
                    sources_used=str(sources)
                )
                db.add(conversation)
                db.commit()
        except Exception as e:
            logger.error(f"Error logging conversation: {e}")
        finally:
            db.close()
    
    def get_student_documents(self) -> List[Dict]:
        """Get list of documents in student knowledge base"""
        db = SessionLocal()
        try:
            student_bot = db.query(Chatbot).filter(Chatbot.type == ChatbotType.STUDENT).first()
            if not student_bot:
                logger.warning("No student chatbot found")
                return []
            
            documents = db.query(DocModel).filter(DocModel.chatbot_id == student_bot.id).all()
            
            return [
                {
                    "id": doc.id,
                    "filename": doc.original_filename,
                    "status": doc.status.value,
                    "pages": doc.page_count,
                    "chunks": doc.chunk_count,
                    "uploaded_at": doc.created_at.isoformat() if doc.created_at else None,
                    "processed_at": doc.processed_at.isoformat() if doc.processed_at else None
                }
                for doc in documents
            ]
        except Exception as e:
            logger.error(f"Error getting student documents: {e}")
            return []
        finally:
            db.close()
    
    def delete_document(self, document_id: int) -> bool:
        """Delete document from knowledge base"""
        db = SessionLocal()
        try:
            doc = db.query(DocModel).filter(DocModel.id == document_id).first()
            if not doc:
                logger.warning(f"Document {document_id} not found")
                return False
            
            # Delete associated chunks
            db.query(DocumentChunk).filter(DocumentChunk.document_id == document_id).delete()
            
            # Delete document record
            db.delete(doc)
            db.commit()
            
            logger.info(f"🗑️ Deleted document: {doc.original_filename}")
            return True
        
        except Exception as e:
            logger.error(f"Error deleting document: {e}")
            db.rollback()
            return False
        finally:
            db.close()
    
    def health_check(self) -> Dict:
        """Check if simplified RAG system is working"""
        try:
            # Test Gemini API
            test_response = self.model.generate_content("Test")
            
            # Count documents
            doc_count = len(self.get_student_documents())
            
            return {
                "status": "healthy",
                "llm": "gemini-ready",
                "search": "keyword-based",
                "documents": doc_count,
                "type": "simplified"
            }
        except Exception as e:
            return {
                "status": "error",
                "error": str(e)
            }

# Global simplified RAG system
simplified_rag = None

def get_student_rag() -> SimplifiedRAGSystem:
    """Get or create simplified RAG system instance"""
    global simplified_rag
    if simplified_rag is None:
        simplified_rag = SimplifiedRAGSystem()
    return simplified_rag