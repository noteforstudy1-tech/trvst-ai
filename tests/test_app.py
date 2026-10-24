import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.services.knowledge_vault import knowledge_vault

client = TestClient(app)

def test_health():
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["app"] == "TRVST AI"
    assert data["team"] == "Spider"

def test_presets():
    response = client.get("/api/presets")
    assert response.status_code == 200
    presets = response.json()
    assert len(presets) >= 3
    assert any("High-Risk" in p["name"] for p in presets)
    assert any("Compliant" in p["name"] for p in presets)

def test_review_high_risk_scenario():
    high_risk_text = (
        "Upgrade to our new Enterprise Plan for only $29/mo! We guarantee 100% risk-free compliance "
        "with zero errors forever. Act immediately before it's gone - our unmatched AI is the world's greatest."
    )
    payload = {
        "title": "Fintech Ad Banner",
        "channel": "Ad Banner & Social",
        "content_text": high_risk_text,
        "author": "Raghav Parashar",
        "author_role": "creator"
    }
    response = client.post("/api/review", json=payload)
    assert response.status_code == 200
    result = response.json()

    assert "submission_id" in result
    assert result["overall_score"] < 80
    assert len(result["findings"]) > 0

    # Verify explainable findings
    first_finding = result["findings"][0]
    assert "severity" in first_finding
    assert "rule_citation" in first_finding
    assert "explanation" in first_finding
    assert "suggested_revision" in first_finding

def test_review_compliant_scenario():
    compliant_text = (
        "Introducing TRVST AI Starter: available for $49/month billed annually. "
        "Engineered to help teams publish on-brand, accurate, and accessible content with people in control. "
        "Backed by our 99.95% uptime SLA, SOC2 Type II compliance, and human-in-the-loop governance."
    )
    payload = {
        "title": "Official Launch Press Release",
        "channel": "Launch Announcement",
        "content_text": compliant_text,
        "author": "Vritika Sheth",
        "author_role": "brand_lead"
    }
    response = client.post("/api/review", json=payload)
    assert response.status_code == 200
    result = response.json()

    assert result["overall_score"] >= 90
    assert "Compliant" in result["risk_level"]

def test_apply_rewrite_workflow():
    sample_text = "We promise 100% risk-free compliance for all users."
    payload = {
        "title": "Workflow Test Draft",
        "content_text": sample_text,
        "author": "Tatvagna Tandel"
    }
    rev_resp = client.post("/api/review", json=payload)
    rev_data = rev_resp.json()
    sub_id = rev_data["submission_id"]
    findings = rev_data["findings"]
    assert len(findings) > 0
    target_finding = findings[0]

    # Apply 1-click rewrite
    action_payload = {
        "submission_id": sub_id,
        "role": "creator",
        "action": "apply_revision",
        "reviewer_name": "Tatvagna Tandel",
        "finding_id": target_finding["id"]
    }
    action_resp = client.post("/api/workflow/action", json=action_payload)
    assert action_resp.status_code == 200
    res = action_resp.json()
    updated_sub = res["data"]["submission"]
    assert updated_sub["content_text"] != sample_text

def test_analytics_dashboard():
    response = client.get("/api/analytics/dashboard")
    assert response.status_code == 200
    data = response.json()
    assert "kpis" in data
    assert "risk_reduction_rate" in data["kpis"]
    assert "turnaround_velocity" in data["kpis"]
    assert "rule_violation_breakdown" in data
