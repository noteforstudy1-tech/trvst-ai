from enum import Enum
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

class FindingSeverity(str, Enum):
    CRITICAL = "critical"      # Legal or factual risks that block publication
    MODERATE = "moderate"      # Fact inconsistencies, missing disclosures
    MINOR = "minor"            # Voice, style preference, formatting, accessibility

class FindingCategory(str, Enum):
    LEGAL_COMPLIANCE = "legal_compliance"
    FACT_ACCURACY = "fact_accuracy"
    BRAND_VOICE = "brand_voice"
    ACCESSIBILITY_VISUAL = "accessibility_visual"

class FindingStatus(str, Enum):
    OPEN = "open"
    APPLIED = "applied"
    DISMISSED = "dismissed"

class SubmissionStatus(str, Enum):
    DRAFT = "draft"
    IN_REVIEW = "in_review"
    CHANGES_REQUESTED = "changes_requested"
    ESCALATED_LEGAL = "escalated_legal"
    APPROVED = "approved"

class UserRole(str, Enum):
    CREATOR = "creator"
    BRAND_LEAD = "brand_lead"
    LEGAL_COMPLIANCE = "legal_compliance"
    AGENCY_FREELANCER = "agency_freelancer"

class ReviewFinding(BaseModel):
    id: str
    category: FindingCategory
    severity: FindingSeverity
    title: str
    excerpt: str
    rule_citation: str
    rule_id: Optional[str] = None
    explanation: str
    suggested_revision: str
    status: FindingStatus = FindingStatus.OPEN
    line_number: Optional[int] = None

class ContentSubmission(BaseModel):
    id: str
    title: str
    channel: str = "Social Media"  # Landing Page, Ad Banner, Blog Post, Email, Press Release
    content_text: str
    visual_asset_url: Optional[str] = None
    author: str = "Creator"
    author_role: UserRole = UserRole.CREATOR
    status: SubmissionStatus = SubmissionStatus.DRAFT
    created_at: str
    updated_at: str

class ReviewResult(BaseModel):
    submission_id: str
    title: str
    status: SubmissionStatus
    overall_score: int  # 0 to 100 Brand Alignment Score
    risk_level: str     # "High Risk", "Moderate Attention", "Brand Compliant"
    findings: List[ReviewFinding]
    summary: str
    engine_used: str    # "Gemini 1.5/2.0 API" or "TRVST Semantic Engine"
    evaluated_at: str
    metrics: Dict[str, Any] = Field(default_factory=dict)

class BrandRule(BaseModel):
    id: str
    category: FindingCategory
    title: str
    rule_text: str
    rationale: str
    severity_default: FindingSeverity
    active: bool = True

class ApprovedFact(BaseModel):
    id: str
    topic: str
    claim: str
    verified_source: str
    valid_until: str
    active: bool = True

class TerminologyTerm(BaseModel):
    id: str
    term: str
    status: str  # "forbidden", "preferred", "caution"
    suggested_replacement: Optional[str] = None
    context_note: str

class VisualStandard(BaseModel):
    id: str
    element: str  # "Primary Logo", "Color Contrast", "Typography", "Imagery"
    rule_spec: str
    wcag_standard: Optional[str] = None
    allowed_hex: Optional[List[str]] = None

class ApprovalActionRequest(BaseModel):
    submission_id: str
    role: UserRole
    action: str  # "approve", "request_changes", "escalate", "apply_revision"
    notes: Optional[str] = None
    reviewer_name: str = "Reviewer"
    finding_id: Optional[str] = None
    revised_text: Optional[str] = None

class AuditLogEntry(BaseModel):
    id: str
    timestamp: str
    submission_id: str
    submission_title: str
    user_role: str
    user_name: str
    action_taken: str
    details: str

class ApiKeyUpdateRequest(BaseModel):
    api_key: str

class QuickPreset(BaseModel):
    id: str
    name: str
    channel: str
    description: str
    content_text: str
    expected_findings_summary: str
