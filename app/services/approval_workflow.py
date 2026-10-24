import json
import uuid
import datetime
from pathlib import Path
from typing import List, Dict, Optional, Any
from app.models.schemas import (
    ContentSubmission, ReviewResult, ReviewFinding,
    SubmissionStatus, UserRole, FindingStatus,
    ApprovalActionRequest, AuditLogEntry
)
from app.config import settings

WORKFLOW_FILE = settings.data_dir / "workflow_store.json"

class ApprovalWorkflowService:
    def __init__(self):
        self.submissions: Dict[str, ContentSubmission] = {}
        self.latest_reviews: Dict[str, ReviewResult] = {}
        self.audit_log: List[AuditLogEntry] = []
        self._load_data()

    def _load_data(self):
        if WORKFLOW_FILE.exists():
            try:
                with open(WORKFLOW_FILE, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    self.submissions = {k: ContentSubmission(**v) for k, v in data.get("submissions", {}).items()}
                    self.latest_reviews = {k: ReviewResult(**v) for k, v in data.get("reviews", {}).items()}
                    self.audit_log = [AuditLogEntry(**a) for a in data.get("audit_log", [])]
                    return
            except Exception as e:
                print(f"[Workflow] Error reading workflow cache: {e}")
        self._seed_initial_history()

    def _seed_initial_history(self):
        now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        self.audit_log = [
            AuditLogEntry(
                id="LOG-001",
                timestamp=now,
                submission_id="SUB-INIT-1",
                submission_title="Q4 Product Roadmap One-Pager",
                user_role="Brand Lead",
                user_name="Vritika Sheth",
                action_taken="Approved with Tone Revision",
                details="Approved after creator applied suggested enterprise tone rewrite."
            ),
            AuditLogEntry(
                id="LOG-002",
                timestamp=now,
                submission_id="SUB-INIT-2",
                submission_title="LinkedIn Ad: Growth Accelerator",
                user_role="Legal & Compliance",
                user_name="Raghav Parashar",
                action_taken="Critical Risk Overridden & Redacted",
                details="Flagged unqualified guarantee; replaced with compliant SLA qualification."
            )
        ]
        self.save()

    def save(self):
        try:
            settings.data_dir.mkdir(parents=True, exist_ok=True)
            data = {
                "submissions": {k: v.model_dump() for k, v in self.submissions.items()},
                "reviews": {k: v.model_dump() for k, v in self.latest_reviews.items()},
                "audit_log": [a.model_dump() for a in self.audit_log]
            }
            with open(WORKFLOW_FILE, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2)
        except Exception as e:
            print(f"[Workflow] Read-only environment, keeping state in memory: {e}")

    def register_submission(self, sub: ContentSubmission, review: ReviewResult):
        self.submissions[sub.id] = sub
        self.latest_reviews[sub.id] = review
        self.log_action(
            submission_id=sub.id,
            submission_title=sub.title,
            user_role=sub.author_role.value if isinstance(sub.author_role, UserRole) else str(sub.author_role),
            user_name=sub.author,
            action_taken="Content Submitted for Review",
            details=f"Evaluated against Knowledge Vault: Score {review.overall_score}/100, {len(review.findings)} flags."
        )
        self.save()

    def handle_action(self, req: ApprovalActionRequest) -> Dict[str, Any]:
        sub = self.submissions.get(req.submission_id)
        review = self.latest_reviews.get(req.submission_id)
        if not sub or not review:
            raise ValueError(f"Submission {req.submission_id} not found")

        role_str = req.role.value if isinstance(req.role, UserRole) else str(req.role)

        if req.action == "apply_revision":
            # Apply 1-click suggested rewrite
            if req.finding_id:
                for f in review.findings:
                    if f.id == req.finding_id:
                        f.status = FindingStatus.APPLIED
                        # Replace excerpt in submission text
                        if f.excerpt in sub.content_text:
                            sub.content_text = sub.content_text.replace(f.excerpt, f.suggested_revision, 1)
                        self.log_action(
                            submission_id=sub.id,
                            submission_title=sub.title,
                            user_role=role_str,
                            user_name=req.reviewer_name,
                            action_taken="Applied 1-Click Rewrite",
                            details=f"Replaced '{f.excerpt}' with compliant revision '{f.suggested_revision}'."
                        )
                        break

        elif req.action == "dismiss_finding":
            if req.finding_id:
                for f in review.findings:
                    if f.id == req.finding_id:
                        f.status = FindingStatus.DISMISSED
                        self.log_action(
                            submission_id=sub.id,
                            submission_title=sub.title,
                            user_role=role_str,
                            user_name=req.reviewer_name,
                            action_taken="Dismissed Flag",
                            details=f"Finding '{f.title}' marked as dismissed by {role_str}."
                        )
                        break

        elif req.action == "approve":
            sub.status = SubmissionStatus.APPROVED
            review.status = SubmissionStatus.APPROVED
            self.log_action(
                submission_id=sub.id,
                submission_title=sub.title,
                user_role=role_str,
                user_name=req.reviewer_name,
                action_taken="Official Human Approval Granted",
                details=f"Approved for publication across {sub.channel}." + (f" Notes: {req.notes}" if req.notes else "")
            )

        elif req.action == "request_changes":
            sub.status = SubmissionStatus.CHANGES_REQUESTED
            review.status = SubmissionStatus.CHANGES_REQUESTED
            self.log_action(
                submission_id=sub.id,
                submission_title=sub.title,
                user_role=role_str,
                user_name=req.reviewer_name,
                action_taken="Changes Requested",
                details=f"Returned to creator with comments: {req.notes or 'Please address open compliance flags.'}"
            )

        elif req.action == "escalate":
            sub.status = SubmissionStatus.ESCALATED_LEGAL
            review.status = SubmissionStatus.ESCALATED_LEGAL
            self.log_action(
                submission_id=sub.id,
                submission_title=sub.title,
                user_role=role_str,
                user_name=req.reviewer_name,
                action_taken="Escalated to Legal & Compliance",
                details=f"Critical flags escalated for legal department sign-off. Reason: {req.notes or 'High regulatory risk'}"
            )

        self.save()
        return {
            "submission": sub,
            "review": review,
            "audit_trail": self.get_audit_log(sub.id)
        }

    def log_action(self, submission_id: str, submission_title: str, user_role: str, user_name: str, action_taken: str, details: str):
        entry = AuditLogEntry(
            id=f"LOG-{uuid.uuid4().hex[:6].upper()}",
            timestamp=datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            submission_id=submission_id,
            submission_title=submission_title,
            user_role=user_role,
            user_name=user_name,
            action_taken=action_taken,
            details=details
        )
        self.audit_log.insert(0, entry)

    def get_audit_log(self, submission_id: Optional[str] = None) -> List[AuditLogEntry]:
        if submission_id:
            return [e for e in self.audit_log if e.submission_id == submission_id]
        return self.audit_log

approval_service = ApprovalWorkflowService()
