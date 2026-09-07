#!/usr/bin/env python3
"""Generate and print the three one-page CEO cross-j audit reports."""

from __future__ import annotations

import argparse
import re
import subprocess
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "output" / "pdf"
TMP = ROOT / "tmp" / "pdfs"
DATE = "06 Sep 2026"
SOURCE = "merge 56275379e | HEAD 02e86c542 | dirty shared tree"


def register_font() -> str:
    candidates = [
        Path("/System/Library/Fonts/Supplemental/Arial Unicode.ttf"),
        Path("/Library/Fonts/Arial Unicode.ttf"),
        Path("/System/Library/Fonts/Supplemental/Arial.ttf"),
        Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"),
    ]
    for path in candidates:
        if path.exists():
            pdfmetrics.registerFont(TTFont("ReportFont", str(path)))
            return "ReportFont"
    raise RuntimeError("No Unicode font found for Cyrillic PDF output")


FONT = register_font()
PAGE_W, PAGE_H = A4
BLACK = colors.HexColor("#111111")
DARK = colors.HexColor("#303030")
MID = colors.HexColor("#777777")
LIGHT = colors.HexColor("#E8E8E8")


def styles() -> dict[str, ParagraphStyle]:
    return {
        "body": ParagraphStyle("body", fontName=FONT, fontSize=8.35, leading=10.1, textColor=BLACK, spaceAfter=2.5),
        "small": ParagraphStyle("small", fontName=FONT, fontSize=7.25, leading=8.6, textColor=DARK),
        "tiny": ParagraphStyle("tiny", fontName=FONT, fontSize=6.6, leading=7.7, textColor=MID),
        "h1": ParagraphStyle("h1", fontName=FONT, fontSize=15.5, leading=17.5, textColor=BLACK, alignment=TA_LEFT, spaceAfter=2),
        "h2": ParagraphStyle("h2", fontName=FONT, fontSize=10.4, leading=12.2, textColor=BLACK, spaceBefore=3, spaceAfter=2),
        "center": ParagraphStyle("center", fontName=FONT, fontSize=8.2, leading=9.5, alignment=TA_CENTER, textColor=BLACK),
        "score": ParagraphStyle("score", fontName=FONT, fontSize=17, leading=18, alignment=TA_CENTER, textColor=BLACK),
    }


def p(text: str, style: ParagraphStyle) -> Paragraph:
    return Paragraph(text, style)


def header(story: list, s: dict[str, ParagraphStyle], mark: str, title: str, subtitle: str) -> None:
    top = Table([
        [p(f"<b>{mark}</b>", ParagraphStyle("mark", fontName=FONT, fontSize=22, leading=23, alignment=TA_CENTER, textColor=colors.white)),
         p(f"<b>{title}</b><br/><font size=8.2>{subtitle}</font>", s["h1"])],
    ],
        colWidths=[18 * mm, 150 * mm], rowHeights=[20 * mm],
    )
    top.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, 0), BLACK),
        ("BACKGROUND", (1, 0), (1, 0), LIGHT),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("BOX", (0, 0), (-1, -1), 0.7, BLACK),
    ]))
    story.extend([top, Spacer(1, 3 * mm)])


def score_table(story: list, s: dict[str, ParagraphStyle], rust: int = 680, ts: int = 720) -> None:
    table = Table([
        [p("<b>Rust cross-j</b>", s["center"]), p("<b>TS cross-j</b>", s["center"]), p("<b>Release verdict</b>", s["center"])],
        [p(f"<b>{rust}/1000</b><br/><font size=7>strong parity core; red full suite</font>", s["center"]),
         p(f"<b>{ts}/1000</b><br/><font size=7>clearer boundary coverage; parity edge</font>", s["center"]),
         p("<b>NO</b><br/><font size=7>not production-ready yet</font>", s["center"])],
    ], colWidths=[58 * mm, 58 * mm, 52 * mm])
    table.setStyle(TableStyle([
        ("GRID", (0, 0), (-1, -1), 0.6, BLACK),
        ("BACKGROUND", (0, 0), (-1, 0), LIGHT),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    story.extend([table, Spacer(1, 2 * mm)])


def section(story: list, s: dict[str, ParagraphStyle], title: str, body: str) -> None:
    story.append(p(f"<b>{title}</b>", s["h2"]))
    story.append(p(body, s["body"]))


def findings_table(story: list, s: dict[str, ParagraphStyle]) -> None:
    rows = [
        [p("<b>Priority</b>", s["small"]), p("<b>Finding</b>", s["small"]), p("<b>Impact</b>", s["small"])],
        [p("P1", s["small"]), p("Rust matcher inserts a cross-j order into <font name='Courier'>resolving_offers</font> even when the fill is intentionally absorbed below one uint16 ladder step; TS leaves it live.", s["small"]), p("Liveness / possible order freeze; add regression and prove next-fill recovery.", s["small"])],
        [p("P1", s["small"]), p("Canonical-domain parity edge: TS preserves a supplied <font name='Courier'>sourceStackId/targetStackId</font>; Rust rewrites them from leg jurisdictions.", s["small"]), p("Different route hash or rejection across engines when an override is supplied.", s["small"])],
        [p("P1", s["small"]), p("Full Rust workspace is red in the current tree: <b>294 passed, 13 failed</b>, mostly recovery and authenticated transport paths.", s["small"]), p("No release claim until failures are attributed and fixed or excluded with evidence.", s["small"])],
    ]
    table = Table(rows, colWidths=[14 * mm, 105 * mm, 49 * mm], repeatRows=1)
    table.setStyle(TableStyle([
        ("GRID", (0, 0), (-1, -1), 0.45, MID),
        ("BACKGROUND", (0, 0), (-1, 0), LIGHT),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]))
    story.append(table)


def footer(canvas, _doc) -> None:
    canvas.saveState()
    canvas.setStrokeColor(MID)
    canvas.setLineWidth(0.4)
    canvas.line(17 * mm, 12 * mm, PAGE_W - 17 * mm, 12 * mm)
    canvas.setFont(FONT, 6.5)
    canvas.setFillColor(MID)
    canvas.drawString(17 * mm, 7.5 * mm, SOURCE)
    canvas.drawRightString(PAGE_W - 17 * mm, 7.5 * mm, DATE)
    canvas.restoreState()


def report_a(path: Path) -> None:
    s = styles(); story: list = []
    header(story, s, "A", "CEO CROSS-J AUDIT | DECISION MEMO", "Rust rscore vs canonical TypeScript | high-level decision with protocol evidence")
    score_table(story, s)
    section(story, s, "Executive verdict", "The design is materially stronger than a typical cross-chain swap: both implementations use one collateralized route, exact route binding, monotonic uint16 progress, Keccak hash-ladder evidence, and role-restricted sibling routing. The current answer is still <b>NO for production</b>: the full Rust workspace has 13 failures, and one Rust/TS liveness behavior diverges on absorbed sub-step fills.")
    section(story, s, "What is actually protected", "<b>Hash ladder:</b> full secret or 130-byte partial witness is verified against the committed root; the close ratio, binary hash, pull IDs, route hash, and chain-proportional amounts are cross-checked. <b>Collateral:</b> pull admission creates a hold before publication and releases it on close. <b>Authority:</b> source user authorization, source/target hub roles, exact sibling edges, and fully-collateralized risk mode are enforced. A hub cannot directly spend a user's held balance through the reviewed path.")
    findings_table(story, s)
    section(story, s, "Score rationale", "TS scores higher on explicit boundary and adversarial scenario coverage. Rust scores high on typed canonicalization and parity vectors, but loses points for the unresolved matcher divergence and the red recovery/transport suite. Scores are an engineering judgment, not a formal certification or probability of exploit.")
    section(story, s, "Release gate", "Before mainnet: fix the Rust absorbed-fill state transition; make domain override semantics identical; get the full workspace green; replay one immutable mixed WAL through TS W1/W4 and Rust W1/W4 with per-frame roots and ordered outputs; then prove live two-chain finality, reorg behavior, transport loss/reconnect, and economic limits under the stand lock.")
    story.append(p("<b>Bottom line:</b> good protocol foundation, not yet a safe production cross-EVM release.", s["h2"]))
    SimpleDocTemplate(str(path), pagesize=A4, rightMargin=17 * mm, leftMargin=17 * mm, topMargin=13 * mm, bottomMargin=16 * mm).build(story, onFirstPage=footer)


def report_b(path: Path) -> None:
    s = styles(); story: list = []
    header(story, s, "B", "CEO CROSS-J RISK DASHBOARD", "Three questions: can it steal, can it grief, can we operate it safely?")
    score_table(story, s, rust=680, ts=720)
    dashboard = Table([
        [p("<b>Security property</b>", s["center"]), p("<b>Evidence read</b>", s["center"]), p("<b>Status</b>", s["center"])],
        [p("No unilateral hub/user theft", s["small"]), p("Exact account route/binding, capacity hold, signed role and counterparty checks; targeted TS and Rust tests pass.", s["small"]), p("PASS - scoped", s["center"])],
        [p("No double claim / forged close", s["small"]), p("Hash ladder verification, binary hash, ratio and chain-proportional economics; terminal replay is idempotent.", s["small"]), p("PASS - tested", s["center"])],
        [p("No diagonal or remote-hop abuse", s["small"]), p("Two sibling edges only; boundary tests reject Account edges, diagonals, split cohorts and self-cycles.", s["small"]), p("PASS - tested", s["center"])],
        [p("No liveness grief", s["small"]), p("Rust marks every cross-j trade as resolving, including a deliberately absorbed sub-step with no fill instruction.", s["small"]), p("FAIL - P1", s["center"])],
        [p("Recoverable production operation", s["small"]), p("Full Rust workspace: 294 passed / 13 failed in recovery, replay and transport tests in the current dirty tree.", s["small"]), p("FAIL - gate", s["center"])],
    ], colWidths=[48 * mm, 100 * mm, 20 * mm])
    dashboard.setStyle(TableStyle([
        ("GRID", (0, 0), (-1, -1), 0.45, MID), ("BACKGROUND", (0, 0), (-1, 0), LIGHT),
        ("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4), ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]))
    story.extend([dashboard, Spacer(1, 2 * mm)])
    section(story, s, "Flow readout", "<b>Open:</b> user intent -> source hub -> exact prepared route -> two hub registrations -> two Account pull locks. <b>Trade:</b> hub-local orderbook progress, exact fill economics, route sequence. <b>Close:</b> source-side ladder reveal -> source close -> target close -> both holds released. The cryptographic evidence is coherent; the operational state machine still needs its negative-path proof.")
    section(story, s, "Two parity hazards", "1) TS keeps a caller-supplied domain stack override while Rust canonicalization replaces it with the leg stack. This must become one explicit rule. 2) Rust and TS treat absorbed uint16 sub-steps differently: TS logs and continues; Rust additionally blocks the offer as resolving. Neither finding demonstrates asset theft, but both can break cross-engine agreement or progress.")
    section(story, s, "Recommended order", "<b>1.</b> Add a minimal regression where a fill moves economic lots but not the uint16 ratio; assert the row remains matchable. <b>2.</b> Add a route-hash vector with conflicting domain stack IDs and choose reject-or-normalize identically. <b>3.</b> Attribute all 13 full-suite failures on a clean immutable SHA. <b>4.</b> Only then run cross-engine WAL parity and live two-EVM adversarial tests.")
    story.append(p("<b>Decision:</b> continue hardening; do not deploy with real value yet.", s["h2"]))
    SimpleDocTemplate(str(path), pagesize=A4, rightMargin=17 * mm, leftMargin=17 * mm, topMargin=13 * mm, bottomMargin=16 * mm).build(story, onFirstPage=footer)


def report_c(path: Path) -> None:
    s = styles(); story: list = []
    header(story, s, "C", "CEO CROSS-JURISDICTION REVIEW", "Rust and TypeScript implementation comparison | executive security brief")
    score_table(story, s, rust=680, ts=720)
    section(story, s, "Executive assessment", "The cross-j protocol has a credible security shape: bilateral collateral holds, deterministic route hashing, hash-ladder settlement evidence, and narrow sibling-only routing. The reviewed implementation is <b>not ready for production value</b>. The limiting evidence is operational, not merely cosmetic: the complete Rust workspace is red and the two engines have a material liveness mismatch.")
    section(story, s, "Security model in one paragraph", "A route commits both jurisdictions, entities, hubs, assets, amounts, policies and signers. Opening requires exact user authorization and matching pulls on both legs. A close is accepted only when the binary witness hashes to the committed ladder and its ratio reproduces the proof economics. The source hub may coordinate, but it does not replace the Account hold authority. Target-side salvage is also tied to the target pull commitment. This materially limits hub/user unilateral theft in the tested flow.")
    story.append(p("<b>Evidence snapshot</b>", s["h2"]))
    evidence = Table([
        [p("Rust focused cross-j", s["small"]), p("42/42 pass", s["center"]), p("Engine + entity kernel tests and parity vectors", s["small"])],
        [p("TypeScript boundary/security", s["small"]), p("20/20 pass", s["center"]), p("Topology, clock, route binding, dispute and proposer-lane tests", s["small"])],
        [p("Rust full workspace", s["small"]), p("294/307 pass", s["center"]), p("13 failures: recovery, replay and authenticated transport", s["small"])],
    ], colWidths=[50 * mm, 30 * mm, 88 * mm])
    evidence.setStyle(TableStyle([("GRID", (0, 0), (-1, -1), 0.45, MID), ("VALIGN", (0, 0), (-1, -1), "MIDDLE"), ("LEFTPADDING", (0, 0), (-1, -1), 4), ("RIGHTPADDING", (0, 0), (-1, -1), 4), ("TOPPADDING", (0, 0), (-1, -1), 3), ("BOTTOMPADDING", (0, 0), (-1, -1), 3)]))
    story.extend([evidence, Spacer(1, 2 * mm)])
    section(story, s, "Top release risks", "<b>1. Rust liveness:</b> an absorbed sub-step can be marked resolving without an emitted progress instruction, potentially freezing future matching. <b>2. Canonicality:</b> TS and Rust disagree when a route supplies domain stack IDs that differ from its leg jurisdictions. <b>3. Operations:</b> recovery/transport failures mean we have not yet demonstrated lossless reconnect, replay determinism, or durable outbox behavior end to end.")
    section(story, s, "Scores and decision", "TS 720/1000: broader explicit boundary coverage and clearer adversarial assertions, reduced for the domain parity edge and absent production proof. Rust 680/1000: strong typed route and hash-ladder parity, reduced for the matcher divergence and red full suite. These are calibrated engineering scores, not audit certification. <b>Decision: NO-GO for mainnet funds; GO for targeted hardening and parity work.</b>")
    story.append(p("<b>Next proof package:</b> clean-SHA green suite -> mixed WAL root parity -> two-EVM live/finality/reorg drill -> lossless reconnect -> capped economic canary.", s["h2"]))
    SimpleDocTemplate(str(path), pagesize=A4, rightMargin=17 * mm, leftMargin=17 * mm, topMargin=13 * mm, bottomMargin=16 * mm).build(story, onFirstPage=footer)


def printer_name() -> str:
    result = subprocess.run(["lpstat", "-p", "-d"], check=True, capture_output=True, text=True)
    lines = result.stdout.splitlines()
    default = next((line.split(":", 1)[1].strip() for line in lines if line.startswith("system default destination:")), "")
    names = [line.split()[1] for line in lines if line.startswith("printer ") and len(line.split()) > 1]
    for name in names:
        if "m15" in name.lower() or "laserjet" in name.lower():
            return name
    if default:
        return default
    if len(names) == 1:
        return names[0]
    raise RuntimeError("HP LaserJet printer queue not found; set XLN_PRINTER explicitly")


def verify_one_page(path: Path) -> None:
    result = subprocess.run(["pdfinfo", str(path)], check=True, capture_output=True, text=True)
    match = re.search(r"^Pages:\s+(\d+)", result.stdout, re.MULTILINE)
    if not match or match.group(1) != "1":
        raise RuntimeError(f"{path.name} is not exactly one page")
    TMP.mkdir(parents=True, exist_ok=True)
    subprocess.run(["pdftoppm", "-f", "1", "-singlefile", "-png", str(path), str(TMP / path.stem)], check=True, capture_output=True)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--no-print", action="store_true")
    args = parser.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)
    paths = [OUT / "ceo-cross-j-audit-A.pdf", OUT / "ceo-cross-j-audit-B.pdf", OUT / "ceo-cross-j-audit-C.pdf"]
    report_a(paths[0]); report_b(paths[1]); report_c(paths[2])
    for path in paths: verify_one_page(path)
    if not args.no_print:
        printer = printer_name()
        for path in paths:
            subprocess.run(["lp", "-d", printer, "-o", "media=A4", "-o", "sides=one-sided", "-o", "ColorModel=Gray", str(path)], check=True)
        print(f"printed={len(paths)} printer={printer}")
    else:
        print("verified=3 pages=1 each")


if __name__ == "__main__":
    main()
