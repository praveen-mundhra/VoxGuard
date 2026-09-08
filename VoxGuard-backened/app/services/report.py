from reportlab.lib.pagesizes import A4
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet
from io import BytesIO
import json

def build_report_pdf(incident):
    out = BytesIO()
    doc = SimpleDocTemplate(out, pagesize=A4)
    styles = getSampleStyleSheet()
    story = [
        Paragraph("VoxGuard Security Incident Report", styles["Title"]),
        Spacer(1, 12),
        Paragraph(f"Incident #{incident.id}", styles["Heading2"]),
        Paragraph(f"Title: {incident.title}", styles["BodyText"]),
        Paragraph(f"Category: {incident.category}", styles["BodyText"]),
        Paragraph(f"Risk score: {incident.risk_score}/100", styles["BodyText"]),
        Spacer(1, 12),
        Paragraph("Evidence / details", styles["Heading2"]),
        Paragraph(incident.details_json.replace("&", "&amp;").replace("<", "&lt;"), styles["BodyText"]),
    ]
    doc.build(story)
    return out.getvalue()
