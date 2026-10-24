import uuid
import datetime
from pathlib import Path
from typing import Dict, Any, List, Optional
from fastapi import FastAPI, APIRouter, HTTPException, Body, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse

from app.config import settings
from app.models.schemas import (
    ContentSubmission, ReviewResult, BrandRule, ApprovedFact,
    TerminologyTerm, ApprovalActionRequest, ApiKeyUpdateRequest, UserRole
)
from app.services.knowledge_vault import knowledge_vault
from app.services.ai_analyzer import ai_analyzer
from app.services.approval_workflow import approval_service
from app.services.analytics import analytics_service

app = FastAPI(
    title="TRVST AI — Intelligent Brand Governance Platform",
    description="Team Spider Round 1 Proposal Implementation. Practical review layer connecting guidelines, AI review, and human approval.",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Vercel Serverless Path Resolver Middleware
@app.middleware("http")
async def vercel_path_resolver(request: Request, call_next):
    # 1. Check for explicit _path query param passed by Vercel rewrite
    target_path = request.query_params.get("_path")
    if target_path:
        clean_path = target_path.split("?")[0]
        if not clean_path.startswith("/"):
            clean_path = "/" + clean_path
        request.scope["path"] = clean_path
    else:
        # 2. Check for Vercel gateway matched path header
        matched_path = request.headers.get("x-matched-path") or request.headers.get("x-forwarded-uri")
        if matched_path and request.scope.get("path") in ["/api/index.py", "/index.py", "/api"]:
            request.scope["path"] = matched_path

    response = await call_next(request)
    return response

api_router = APIRouter()

@api_router.get("/health")
def health_check():
    key = settings.gemini_api_key.strip()
    return {
        "status": "healthy",
        "app": "TRVST AI",
        "team": "Spider",
        "version": "1.0.0",
        "gemini_configured": bool(key and len(key) > 5),
        "active_engine": "Gemini 2.5 Flash (Live)" if bool(key and len(key) > 5) else "TRVST Semantic Engine (Local)"
    }

@api_router.get("/settings/status")
def get_settings_status():
    key = settings.gemini_api_key.strip()
    masked = f"{key[:7]}...{key[-4:]}" if len(key) > 11 else ("configured" if key else "not configured")
    return {
        "gemini_configured": bool(key),
        "masked_key": masked,
        "app_env": settings.app_env
    }

@api_router.post("/settings/gemini-key")
def update_gemini_key(req: ApiKeyUpdateRequest):
    settings.update_gemini_key(req.api_key)
    return {
        "success": True,
        "message": "Gemini API key updated successfully",
        "masked_key": f"{req.api_key[:7]}...{req.api_key[-4:]}" if len(req.api_key) > 11 else "updated"
    }

@api_router.get("/presets")
def get_presets():
    return knowledge_vault.get_presets()

@api_router.post("/review", response_model=ReviewResult)
def run_review(payload: Dict[str, Any] = Body(...)):
    text = payload.get("content_text", "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="Content text cannot be empty.")
    
    title = payload.get("title", "Draft Campaign Review").strip()
    channel = payload.get("channel", "Social Media").strip()
    role_val = payload.get("author_role", "creator")
    author = payload.get("author", "Creator")

    submission_id = payload.get("id") or f"SUB-{uuid.uuid4().hex[:6].upper()}"
    now_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    submission = ContentSubmission(
        id=submission_id,
        title=title,
        channel=channel,
        content_text=text,
        author=author,
        author_role=UserRole(role_val) if role_val in [r.value for r in UserRole] else UserRole.CREATOR,
        created_at=now_str,
        updated_at=now_str
    )

    review_result = ai_analyzer.analyze_content(submission)
    approval_service.register_submission(submission, review_result)

    return review_result

@api_router.post("/workflow/action")
def workflow_action(req: ApprovalActionRequest):
    try:
        res = approval_service.handle_action(req)
        return {
            "success": True,
            "data": res
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@api_router.get("/workflow/audit-log")
def get_audit_log(submission_id: str = None):
    return approval_service.get_audit_log(submission_id)

@api_router.get("/knowledge-vault/rules")
def get_rules():
    return knowledge_vault.get_rules()

@api_router.post("/knowledge-vault/rules")
def add_rule(rule: BrandRule):
    return knowledge_vault.add_rule(rule)

@api_router.get("/knowledge-vault/facts")
def get_facts():
    return knowledge_vault.get_facts()

@api_router.post("/knowledge-vault/facts")
def add_fact(fact: ApprovedFact):
    return knowledge_vault.add_fact(fact)

@api_router.get("/knowledge-vault/terms")
def get_terms():
    return knowledge_vault.get_terms()

@api_router.post("/knowledge-vault/terms")
def add_term(term: TerminologyTerm):
    return knowledge_vault.add_term(term)

@api_router.get("/knowledge-vault/visuals")
def get_visuals():
    return knowledge_vault.get_visuals()

@api_router.get("/analytics/dashboard")
def get_dashboard():
    return analytics_service.get_dashboard_metrics()

# Include router for BOTH "/api" AND "" prefixes to guarantee Vercel & local compatibility
app.include_router(api_router, prefix="/api")
app.include_router(api_router, prefix="")

# Static file serving (for local development)
STATIC_DIR = Path(__file__).parent / "static"
PUBLIC_DIR = Path(__file__).parent.parent / "public"

if STATIC_DIR.exists():
    app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

    @app.get("/")
    def serve_index():
        return FileResponse(STATIC_DIR / "index.html")
