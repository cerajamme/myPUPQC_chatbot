import os
import logging
from typing import List, Dict, Optional
from datetime import datetime
from urllib.parse import urlparse

# LlamaIndex imports
from llama_index.core import VectorStoreIndex, SimpleDirectoryReader, Document
from llama_index.vector_stores.postgres import PGVectorStore
from llama_index.llms.gemini import Gemini
from llama_index.embeddings.huggingface import HuggingFaceEmbedding
from llama_index.core.node_parser import SimpleNodeParser
from llama_index.core import Settings

# Database imports
from sqlalchemy.orm import Session
from database import SessionLocal
from models import Chatbot, Document as DocModel, DocumentChunk, ChatbotType, DocumentStatus
from config import settings, STUDENT_SYSTEM_PROMPT, STUDENT_NO_CONTEXT_RESPONSE

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class StudentRAGSystem:
    """RAG system specifically designed for student support chatbot using LlamaIndex"""
    
    def __init__(self):
        self.embeddings = None
        self.vector_store = None
        self.llm = None
        self.index = None
        self.query_engine = None
        self.node_parser = None
        self._initialize_components()
    
    def _initialize_components(self):
        """Initialize LlamaIndex components"""
        try:
            # Initialize embeddings model
            self.embeddings = HuggingFaceEmbedding(
                model_name=settings.embedding_model,
                device='cpu'
            )
            logger.info(f"✅ Embeddings model loaded: {settings.embedding_model}")
            
            # Initialize node parser (text splitter)
            self.node_parser = SimpleNodeParser.from_defaults(
                chunk_size=settings.chunk_size,
                chunk_overlap=settings.chunk_overlap
            )
            logger.info(f"✅ Node parser configured: {settings.chunk_size} chars")
            
            # Initialize Gemini LLM
            self.llm = Gemini(
                api_key=settings.gemini_api_key,
                model="gemini-1.5-flash",
                temperature=0.1
            )
            logger.info("✅ Gemini LLM initialized")
            
            # Set global settings
            Settings.embed_model = self.embeddings
            Settings.llm = self.llm
            Settings.node_parser = self.node_parser
            
            # Initialize vector store connection
            self._setup_vectorstore()
            
        except Exception as e:
            logger.error(f"❌ Error initializing RAG components: {e}")
            raise
    
    def _setup_vectorstore(self):
        """Setup PGVector connection for student documents"""
        try:
            # Parse database URL
            db_url = urlparse(settings.database_url.replace("postgresql+psycopg://", "postgresql://"))
            
            # Create vectorstore connection
            self.vector_store = PGVectorStore.from_params(
                database=db_url.path[1:],  # Remove leading '/'
                host=db_url.hostname,
                password=db_url.password,
                port=db_url.port or 5432,
                user=db_url.username,
                table_name="student_vectors",
                embed_dim=384,  # Dimension for all-MiniLM-L6-v2
                hnsw_kwargs={"hnsw_m": 16, "hnsw_ef_construction": 64, "hnsw_ef_search": 40}
            )
            logger.info("✅ Vector store connected")
            
            # Create index from vector store
            self.index = VectorStoreIndex.from_vector_store(
                vector_store=self.vector_store,
                embed_model=self.embeddings
            )
            
            # Create query engine
            self.query_engine = self.index.as_query_engine(
                llm=self.llm,
                similarity_top_k=settings.similarity_top_k,
                response_mode="compact"
            )
            logger.info("✅ Query engine created")
            
        except Exception as e:
            logger.error(f"❌ Error setting up vector store: {e}")
            raise
    
    async def process_pdf(self, file_path: str, filename: str, chatbot_id: int) -> Dict:
        """Process PDF and add to student knowledge base"""
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
            
            # Load PDF with LlamaIndex
            documents = SimpleDirectoryReader(input_files=[file_path]).load_data()
            
            if not documents:
                raise ValueError("No content extracted from PDF")
            
            # Update page count
            doc_record.page_count = len(documents)
            
            # Parse documents into nodes
            nodes = self.node_parser.get_nodes_from_documents(documents)
            logger.info(f"📝 Created {len(nodes)} chunks from {len(documents)} pages")
            
            # Add metadata to nodes
            for i, node in enumerate(nodes):
                node.metadata.update({
                    "document_id": doc_record.id,
                    "chatbot_id": chatbot_id,
                    "chatbot_type": "student",
                    "filename": filename,
                    "chunk_index": i,
                    "page": node.metadata.get("page_label", 1)
                })
            
            # Add to vector store
            self.index.insert_nodes(nodes)
            logger.info(f"🔍 Added {len(nodes)} chunks to vector store")
            
            # Save chunk records to database
            for i, node in enumerate(nodes):
                chunk_record = DocumentChunk(
                    document_id=doc_record.id,
                    chunk_index=i,
                    text_content=node.text,
                    page_number=node.metadata.get("page", 1),
                    embedding_id=node.node_id
                )
                db.add(chunk_record)
            
            # Update document status
            doc_record.status = DocumentStatus.READY
            doc_record.chunk_count = len(nodes)
            doc_record.processed_at = datetime.utcnow()
            
            db.commit()
            
            # Clean up file
            if os.path.exists(file_path):
                os.remove(file_path)
            
            result = {
                "status": "success",
                "document_id": doc_record.id,
                "filename": filename,
                "pages": len(documents),
                "chunks": len(nodes),
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
    
    async def query_student_bot(self, question: str, session_id: str = None) -> Dict:
        """Answer student questions using RAG"""
        try:
            logger.info(f"🤔 Student question: {question}")
            
            if not self.query_engine:
                raise ValueError("Query engine not initialized")
            
            # Query the RAG system
            start_time = datetime.now()
            response = self.query_engine.query(question)
            response_time = (datetime.now() - start_time).total_seconds() * 1000
            
            # Extract answer and sources
            answer = str(response)
            source_nodes = response.source_nodes if hasattr(response, 'source_nodes') else []
            
            # Format sources with page numbers
            sources = []
            for node in source_nodes:
                sources.append({
                    "page": node.metadata.get("page", "Unknown"),
                    "filename": node.metadata.get("filename", "Unknown"),
                    "chunk_id": node.metadata.get("document_id", "Unknown"),
                    "confidence": node.score if hasattr(node, 'score') else 0.8
                })
            
            # Log the interaction
            await self._log_conversation(question, answer, sources, response_time, session_id)
            
            response_dict = {
                "answer": answer,
                "sources": sources,
                "response_time_ms": int(response_time),
                "session_id": session_id
            }
            
            logger.info(f"✅ Response generated in {response_time:.0f}ms")
            return response_dict
            
        except Exception as e:
            logger.error(f"❌ Error answering question: {e}")
            return {
                "answer": STUDENT_NO_CONTEXT_RESPONSE,
                "sources": [],
                "response_time_ms": 0,
                "error": str(e)
            }
    
    async def _log_conversation(self, question: str, answer: str, sources: List, response_time: float, session_id: str):
        """Log conversation for analytics"""
        if not settings.analytics_enabled:
            return
        
        db = SessionLocal()
        try:
            # Get student chatbot
            student_bot = db.query(Chatbot).filter(
                Chatbot.type == ChatbotType.STUDENT
            ).first()
            
            if student_bot:
                from models import Conversation
                conversation = Conversation(
                    chatbot_id=student_bot.id,
                    session_id=session_id or "anonymous",
                    user_message=question,
                    bot_response=answer,
                    response_time_ms=int(response_time),
                    sources_used=str(sources)  # JSON string
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
            student_bot = db.query(Chatbot).filter(
                Chatbot.type == ChatbotType.STUDENT
            ).first()
            
            if not student_bot:
                return []
            
            documents = db.query(DocModel).filter(
                DocModel.chatbot_id == student_bot.id
            ).all()
            
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
        
        finally:
            db.close()
    
    def delete_document(self, document_id: int) -> bool:
        """Delete document from knowledge base"""
        db = SessionLocal()
        try:
            doc = db.query(DocModel).filter(DocModel.id == document_id).first()
            if not doc:
                return False
            
            # TODO: Remove from vector store using node IDs
            # For now, just mark as deleted in database
            
            db.delete(doc)
            db.commit()
            logger.info(f"🗑️ Deleted document: {doc.original_filename}")
            return True
        
        except Exception as e:
            logger.error(f"Error deleting document: {e}")
            return False
        
        finally:
            db.close()
    
    def health_check(self) -> Dict:
        """Check if RAG system is working properly"""
        try:
            # Test embedding
            test_text = "This is a test"
            embedding = self.embeddings.get_text_embedding(test_text)
            
            # Test query engine
            if self.query_engine:
                test_response = self.query_engine.query("test")
            
            return {
                "status": "healthy",
                "embeddings": "working",
                "vectorstore": "connected",
                "llm": "ready",
                "documents": len(self.get_student_documents())
            }
        
        except Exception as e:
            return {
                "status": "error",
                "error": str(e)
            }

# Global RAG system instance
student_rag = None

def get_student_rag() -> StudentRAGSystem:
    """Get or create student RAG system instance"""
    global student_rag
    if student_rag is None:
        student_rag = StudentRAGSystem()
    return student_rag

if __name__ == "__main__":
    """Test the RAG system"""
    async def test_rag():
        rag = StudentRAGSystem()
        
        # Health check
        health = rag.health_check()
        print(f"Health: {health}")
        
        # Test query
        result = await rag.query_student_bot("What are the graduation requirements?")
        print(f"Test query result: {result}")
    
    # Run test
    import asyncio
    asyncio.run(test_rag())