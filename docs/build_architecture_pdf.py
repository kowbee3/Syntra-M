"""Builds docs/Syntra-Architecture.pdf (architecture overview with flowcharts).

Run from the project root:   python docs/build_architecture_pdf.py
Requires: reportlab
"""
import os
from datetime import date

from reportlab.graphics.shapes import Drawing, Rect, Polygon, PolyLine, String, Line
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import inch
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (BaseDocTemplate, Frame, KeepTogether, PageBreak, PageTemplate,
                                Paragraph, Spacer, Table, TableStyle)

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "Syntra-Architecture.pdf")

# ---------------------------------------------------------------- fonts
FONT, BOLD, MONO = "Helvetica", "Helvetica-Bold", "Courier"
for name, file in (("Segoe", "segoeui.ttf"), ("Segoe-Bold", "segoeuib.ttf"), ("Consolas", "consola.ttf")):
    path = os.path.join(os.environ.get("WINDIR", r"C:\Windows"), "Fonts", file)
    if os.path.exists(path):
        pdfmetrics.registerFont(TTFont(name, path))
if "Segoe" in pdfmetrics.getRegisteredFontNames():
    FONT, BOLD = "Segoe", "Segoe-Bold"
    pdfmetrics.registerFontFamily("Segoe", normal="Segoe", bold="Segoe-Bold", italic="Segoe", boldItalic="Segoe-Bold")
if "Consolas" in pdfmetrics.getRegisteredFontNames():
    MONO = "Consolas"

# ---------------------------------------------------------------- palette
ACCENT = colors.HexColor("#2f6b4f")
ACCENT_SOFT = colors.HexColor("#e3efe8")
INK = colors.HexColor("#17201b")
INK2 = colors.HexColor("#56605a")
LINE = colors.HexColor("#c9d1cc")
PANEL = colors.HexColor("#f4f6f4")
BLUE_SOFT = colors.HexColor("#e6eef8")
BLUE = colors.HexColor("#2f5f9e")
AMBER_SOFT = colors.HexColor("#fbf1df")
AMBER = colors.HexColor("#b0781a")
RED_SOFT = colors.HexColor("#f8e5e5")
RED = colors.HexColor("#b03a3a")
PURPLE_SOFT = colors.HexColor("#efe8f8")
PURPLE = colors.HexColor("#6a4aa0")
GREY_SOFT = colors.HexColor("#eef0ef")

PAGE_W, PAGE_H = letter
MARGIN = 0.75 * inch
CONTENT_W = PAGE_W - 2 * MARGIN


# ================================================================ diagram helpers
def wrap(text, font, size, width):
    lines = []
    for para in text.split("\n"):
        cur = ""
        for word in para.split():
            trial = (cur + " " + word).strip()
            if stringWidth(trial, font, size) <= width or not cur:
                cur = trial
            else:
                lines.append(cur)
                cur = word
        lines.append(cur)
    return lines


STYLES = {
    #            fill         stroke   text   font
    "start":    (ACCENT,      ACCENT,  colors.white, BOLD),
    "end":      (ACCENT,      ACCENT,  colors.white, BOLD),
    "process":  (colors.white, LINE,   INK,   FONT),
    "accent":   (ACCENT_SOFT, ACCENT,  INK,   BOLD),
    "decision": (AMBER_SOFT,  AMBER,   INK,   BOLD),
    "store":    (BLUE_SOFT,   BLUE,    INK,   FONT),
    "deny":     (RED_SOFT,    RED,     INK,   FONT),
    "allow":    (ACCENT_SOFT, ACCENT,  INK,   BOLD),
    "admin":    (PURPLE_SOFT, PURPLE,  INK,   FONT),
    "ghost":    (PANEL,       LINE,    INK2,  FONT),
}


class Diagram:
    """Flowchart canvas using top-left coordinates."""

    def __init__(self, w, h):
        self.w, self.h = w, h
        self.d = Drawing(w, h)

    def Y(self, y):
        return self.h - y

    def text_block(self, cx, cy, lines, font, size, color, lead=None):
        lead = lead or size * 1.22
        top = cy + (len(lines) - 1) * lead / 2
        for i, ln in enumerate(lines):
            self.d.add(String(cx, self.Y(top - i * lead) - size * 0.35, ln, fontName=font, fontSize=size,
                              fillColor=color, textAnchor="middle"))

    def node(self, x, y, w, h, text, kind="process", sub=None, size=8.6):
        fill, stroke, tcol, font = STYLES[kind]
        if kind == "decision":
            cx, cy = x + w / 2, y + h / 2
            pts = [cx, self.Y(y), x + w, self.Y(cy), cx, self.Y(y + h), x, self.Y(cy)]
            self.d.add(Polygon(pts, fillColor=fill, strokeColor=stroke, strokeWidth=1))
            lines = wrap(text, font, size, w * 0.62)
        else:
            r = h / 2 if kind in ("start", "end") else 6
            self.d.add(Rect(x, self.Y(y + h), w, h, rx=r, ry=r, fillColor=fill, strokeColor=stroke,
                            strokeWidth=1.1 if kind != "process" else 0.9))
            if kind == "store":   # database-style double top line
                self.d.add(Line(x + 6, self.Y(y + 5), x + w - 6, self.Y(y + 5), strokeColor=stroke, strokeWidth=0.6))
            lines = wrap(text, font, size, w - 14)
        sub_lines = wrap(sub, FONT, size - 1.4, w - 14) if sub else []
        lead = size * 1.22
        total = len(lines) * lead + len(sub_lines) * (size - 0.6) * 1.2
        top = y + h / 2 - total / 2 + lead / 2
        for i, ln in enumerate(lines):
            self.d.add(String(x + w / 2, self.Y(top + i * lead) - size * 0.35, ln, fontName=font,
                              fontSize=size, fillColor=tcol, textAnchor="middle"))
        sy = top + len(lines) * lead
        for i, ln in enumerate(sub_lines):
            self.d.add(String(x + w / 2, self.Y(sy + i * (size - 0.6) * 1.2) - size * 0.32, ln, fontName=FONT,
                              fontSize=size - 1.4, fillColor=INK2 if kind not in ("start", "end") else colors.white,
                              textAnchor="middle"))
        return {"x": x, "y": y, "w": w, "h": h,
                "t": (x + w / 2, y), "b": (x + w / 2, y + h), "l": (x, y + h / 2), "r": (x + w, y + h / 2),
                "c": (x + w / 2, y + h / 2)}

    def group(self, x, y, w, h, title):
        self.d.add(Rect(x, self.Y(y + h), w, h, rx=8, ry=8, fillColor=PANEL, strokeColor=LINE,
                        strokeWidth=0.8, strokeDashArray=[3, 2]))
        self.d.add(String(x + 10, self.Y(y + 14), title.upper(), fontName=BOLD, fontSize=7.2, fillColor=INK2))

    def arrow(self, pts, label=None, color=INK2, label_at=0.5, dashed=False, label_dx=0, label_dy=0):
        flat = []
        for (px, py) in pts:
            flat += [px, self.Y(py)]
        self.d.add(PolyLine(flat, strokeColor=color, strokeWidth=1, strokeDashArray=[3, 2] if dashed else None))
        (x1, y1), (x2, y2) = pts[-2], pts[-1]
        dx, dy = x2 - x1, y2 - y1
        ln = max((dx * dx + dy * dy) ** 0.5, 0.001)
        ux, uy = dx / ln, dy / ln
        s = 5.5
        p1 = (x2 - ux * s - uy * s * 0.55, y2 - uy * s + ux * s * 0.55)
        p2 = (x2 - ux * s + uy * s * 0.55, y2 - uy * s - ux * s * 0.55)
        self.d.add(Polygon([x2, self.Y(y2), p1[0], self.Y(p1[1]), p2[0], self.Y(p2[1])],
                           fillColor=color, strokeColor=color, strokeWidth=0.5))
        if label:
            # place the label on the longest segment
            segs = [(pts[i], pts[i + 1]) for i in range(len(pts) - 1)]
            (ax, ay), (bx, by) = max(segs, key=lambda sg: abs(sg[1][0] - sg[0][0]) + abs(sg[1][1] - sg[0][1]))
            lx, ly = ax + (bx - ax) * label_at + label_dx, ay + (by - ay) * label_at + label_dy
            tw = stringWidth(label, FONT, 7.4) + 8
            self.d.add(Rect(lx - tw / 2, self.Y(ly + 5.5), tw, 11, rx=3, ry=3, fillColor=colors.white,
                            strokeColor=None))
            self.d.add(String(lx, self.Y(ly) - 2.6, label, fontName=FONT, fontSize=7.4, fillColor=INK2,
                              textAnchor="middle"))

    def note(self, x, y, text, size=7.6, color=INK2, anchor="start", font=None):
        self.d.add(String(x, self.Y(y), text, fontName=font or FONT, fontSize=size, fillColor=color, textAnchor=anchor))


# ================================================================ diagrams
def diagram_modules():
    D = Diagram(CONTENT_W, 470)
    W = CONTENT_W
    D.group(0, 0, W, 470, "Browser: one static page, no build step, no network dependencies")
    html = D.node(W / 2 - 90, 26, 180, 36, "index.html", "start", sub="markup, icon sprite, loads scripts in order")
    c3 = (W - 40) / 3
    xs = [10, 20 + c3, 30 + 2 * c3]
    s1 = D.node(xs[0], 104, c3, 56, "js/settings.js", "accent", sub="SyntraSettings: schema, validation, migrations, admin policy")
    s2 = D.node(xs[1], 104, c3, 56, "js/data.js", "accent", sub="SyntraData: units, people, chats, channels, audit (mock)")
    s3 = D.node(xs[2], 104, c3, 56, "css/styles.css", "ghost", sub="design tokens, themes, layout, animations, responsive rules")
    core = D.node(60, 206, W - 120, 58, "js/app.js  (core)", "accent",
                  sub="state, sign-in, roles & unit scope, chat list, messages, composer, calls, lock, "
                      "keyed DOM patching; publishes the shared window.Syntra API")
    a1 = D.node(xs[0], 314, c3, 56, "js/admin.js", "admin", sub="SyntraAdmin: Admin console, posters dialog")
    a2 = D.node(xs[1], 314, c3, 56, "js/guide.js", "process", sub="SyntraGuide: searchable user guide")
    a3 = D.node(xs[2], 314, c3, 56, "js/settings-panel.js", "process", sub="settings column, main menu, live preview")
    ls = D.node(40, 410, (W - 110) / 2, 46, "localStorage", "store", sub="settings, policy, theme, dismissed tips, remembered session")
    ss = D.node(70 + (W - 110) / 2, 410, (W - 110) / 2, 46, "sessionStorage", "store", sub="session for this tab only")

    for n in (s1, s2, s3):
        D.arrow([html["b"], (html["b"][0], 84), (n["t"][0], 84), n["t"]], dashed=True)
    D.arrow([s1["b"], (s1["b"][0], 185), (core["t"][0] - 120, 185), (core["t"][0] - 120, core["y"])], label="settings API")
    D.arrow([s2["b"], core["t"]], label="data")
    D.arrow([(core["t"][0] + 120, core["y"]), (core["t"][0] + 120, 185), (s3["b"][0], 185), s3["b"]],
            label="CSS variables + data-* attributes", color=ACCENT)
    for n in (a1, a2, a3):
        D.arrow([core["b"], (core["b"][0], 292), (n["t"][0], 292), n["t"]])
    D.note(core["b"][0] + 6, 288, "window.Syntra", 7.4, ACCENT, font=BOLD)
    # storage lines run through the gaps between boxes, never across them
    gap1 = (a1["x"] + a1["w"] + a2["x"]) / 2
    gap2 = (a2["x"] + a2["w"] + a3["x"]) / 2
    D.arrow([(s1["x"] + 10, s1["y"] + s1["h"]), (s1["x"] + 10, 176), (4, 176), (4, 398),
             (ls["x"] + 30, 398), (ls["x"] + 30, ls["y"])], color=BLUE, dashed=True)
    D.arrow([(gap1, core["y"] + core["h"]), (gap1, ls["y"])], color=BLUE, dashed=True)
    D.arrow([(gap2, core["y"] + core["h"]), (gap2, 398), (ss["t"][0], 398), ss["t"]], color=BLUE, dashed=True)
    return D.d


def diagram_startup():
    D = Diagram(CONTENT_W, 560)
    W = CONTENT_W
    cx = W / 2
    bw = 240
    a = D.node(cx - bw / 2, 0, bw, 30, "Open Syntra (index.html)", "start")
    b = D.node(cx - bw / 2, 46, bw, 36, "Pre-paint: apply saved theme", "process", sub="avoids a light/dark flash")
    c = D.node(cx - bw / 2, 98, bw, 42, "Load settings", "process", sub="migrate old versions, validate every value, apply Super Admin policy")
    d = D.node(cx - bw / 2, 156, bw, 36, "Load data, wire events", "process", sub="doodle pattern, shortcuts, menus")
    e = D.node(cx - 80, 210, 160, 64, "Saved session?", "decision")
    L0 = 14
    f = D.node(L0, 304, 210, 42, "Show sign-in card", "process", sub="Super Admin / Admin / Standard User")
    g = D.node(L0 + 25, 366, 160, 60, "Sign-in method?", "decision")
    h = D.node(L0, 448, 110, 38, "Username + password", "process", size=8.2)
    i = D.node(L0 + 124, 448, 112, 38, "QR code", "process", sub="demo: simulate scan")
    j = D.node(L0, 506, 110, 54, "Fields filled?", "decision", size=8.2)
    l = D.node(L0 + 124, 508, 150, 50, "Save session", "store", sub="'Keep me signed in' \u2192 localStorage, else sessionStorage")
    R0 = 318
    k = D.node(R0, 330, W - R0, 44, "Apply persona & permissions", "accent", sub="name, unit, role \u2192 can(), unit scope")
    m = D.node(R0, 396, W - R0, 40, "Loading screen", "process", sub="keys \u00b7 secure channel \u00b7 sync (simulated)")
    n = D.node(R0, 458, W - R0, 34, "Main interface", "end")
    for p, q in ((a, b), (b, c), (c, d), (d, e)):
        D.arrow([p["b"], q["t"]])
    D.arrow([e["l"], (f["t"][0], e["l"][1]), f["t"]], label="no")
    D.arrow([e["r"], (k["t"][0], e["r"][1]), k["t"]], label="yes")
    D.arrow([f["b"], g["t"]])
    # both methods leave from the diamond's bottom point, then split
    D.d.add(Line(g["b"][0], D.Y(g["b"][1]), g["b"][0], D.Y(437), strokeColor=INK2, strokeWidth=1))
    D.arrow([(g["b"][0], 437), (h["t"][0], 437), h["t"]], label="password")
    D.arrow([(g["b"][0], 437), (i["t"][0], 437), i["t"]], label="QR")
    D.arrow([h["b"], j["t"]])
    D.arrow([i["b"], (i["b"][0], l["y"])])
    D.arrow([j["r"], (l["x"], j["r"][1])])
    D.arrow([j["l"], (4, j["l"][1]), (4, f["l"][1]), f["l"]], color=RED)
    D.note(8, 492, "no", 7.4, RED)
    D.note(j["r"][0] + 1, j["r"][1] + 12, "yes", 7.4)
    D.arrow([l["r"], (300, l["r"][1]), (300, k["l"][1]), k["l"]])
    for p, q in ((k, m), (m, n)):
        D.arrow([p["b"], q["t"]])
    D.note(R0, 520, "Empty fields show a message and shake", 7.6)
    D.note(R0, 532, "the card, then return to sign-in.", 7.6)
    return D.d


def diagram_send():
    D = Diagram(CONTENT_W, 600)
    W = CONTENT_W
    cx = 150
    bw = 200
    a = D.node(cx - bw / 2, 0, bw, 34, "Press Enter / Send", "start")
    b = D.node(cx - 75, 56, 150, 62, "Message empty?", "decision")
    b2 = D.node(cx + 120, 66, 170, 40, "Voice-note hint", "ghost", sub="no message is sent")
    c = D.node(cx - 85, 140, 170, 74, "Flash and confirmation on?", "decision")
    c2 = D.node(cx + 120, 152, 170, 46, "In-app confirm dialog", "accent", sub="works where native confirm() is blocked")
    c3 = D.node(cx + 150, 222, 110, 60, "Confirmed?", "decision")
    c4 = D.node(cx + 290 - 2, 236, 90, 34, "Back to composer", "ghost")
    d = D.node(cx - bw / 2, 300, bw, 44, "Create message", "process", sub="id, time, precedence, reply-to · status: pending")
    e = D.node(cx - bw / 2, 366, bw, 46, "Patch the message list", "accent", sub="only the new row is added, then it animates in")
    f = D.node(cx - bw / 2, 434, bw, 46, "Delivery updates (simulated)", "process", sub="sent → delivered → read (if receipts on)")
    g = D.node(cx - bw / 2, 502, bw, 40, "Typing indicator, then reply", "process", sub="simulated contact")
    h = D.node(cx + 150, 492, 120, 60, "Chat open?", "decision")
    i = D.node(cx + 150 - 40 - 6, 572, 104, 28, "Smooth-scroll", "end")
    j = D.node(cx + 290, 572, 120, 28, "Unread + toast", "end")

    D.arrow([a["b"], b["t"]])
    D.arrow([b["r"], b2["l"]], label="yes")
    D.arrow([b["b"], c["t"]], label="no")
    D.arrow([c["r"], c2["l"]], label="yes")
    D.arrow([c2["b"], c3["t"]])
    D.arrow([c3["r"], c4["l"]], label="no")
    D.arrow([c3["b"], (c3["b"][0], 322), d["r"]], label="yes")
    D.arrow([c["b"], d["t"]], label="no")
    for p, q in ((d, e), (e, f), (f, g)):
        D.arrow([p["b"], q["t"]])
    D.arrow([g["r"], h["l"]])
    D.arrow([h["b"], (h["b"][0], 562), (i["t"][0], 562), i["t"]], label="yes")
    D.arrow([h["r"], (j["t"][0], h["r"][1]), j["t"]], label="no")
    return D.d


def diagram_render():
    D = Diagram(CONTENT_W, 262)
    W = CONTENT_W
    a = D.node(0, 0, 150, 40, "Something changed", "start", sub="tick, typing, new message")
    b = D.node(176, 0, 150, 40, "Build HTML string", "process", sub="for the list or messages")
    c = D.node(352, 0, W - 352, 40, "morph(): match rows by key", "accent", sub="message id, chat id, …")
    y = 86
    cw = (W - 30) / 4
    o1 = D.node(0, y, cw, 52, "Unchanged", "ghost", sub="keep the existing node")
    o2 = D.node(cw + 10, y, cw, 52, "Only attributes changed", "process", sub="patch in place, CSS transitions run")
    o3 = D.node(2 * (cw + 10), y, cw, 52, "Content changed", "process", sub="replace that one node")
    o4 = D.node(3 * (cw + 10), y, cw, 52, "New row", "allow", sub="insert and animate in")
    D.arrow([a["r"], b["l"]])
    D.arrow([b["r"], c["l"]])
    for o in (o1, o2, o3, o4):
        D.arrow([c["b"], (c["b"][0], 66), (o["t"][0], 66), o["t"]])
    f1 = D.node(0, 176, (W - 10) / 2, 52, "FLIP: chats that moved slide to their new place", "process",
                sub="Web Animations API; rate follows the animation-speed setting")
    f2 = D.node((W + 10) / 2, 176, (W - 10) / 2, 52, "Scroll: smooth if you were near the bottom", "process",
                sub="stays put while you read older messages")
    for o in (o1, o2, o3, o4):
        D.d.add(Line(o["b"][0], D.Y(o["b"][1]), o["b"][0], D.Y(152), strokeColor=INK2, strokeWidth=1))
    D.d.add(Line(o1["b"][0], D.Y(152), o4["b"][0], D.Y(152), strokeColor=INK2, strokeWidth=1))
    D.arrow([(f1["t"][0], 152), f1["t"]])
    D.arrow([(f2["t"][0], 152), f2["t"]])
    D.note(W / 2, 254, "Result: no flicker, hover states survive, and only the change animates.", 8.2, ACCENT, "middle", BOLD)
    return D.d


def diagram_settings():
    D = Diagram(CONTENT_W, 470)
    W = CONTENT_W
    a = D.node(0, 0, 200, 40, "A control changes", "start", sub="switch, radio, slider, colour")
    b = D.node(0, 62, 200, 34, "S.set(key, value)", "accent")
    c = D.node(10, 118, 180, 70, "Locked by Super Admin policy?", "decision")
    c2 = D.node(0, 214, 200, 40, "Rejected", "deny", sub="control shows 'Managed'")
    d = D.node(230, 128, 150, 50, "Validate against the schema", "process", sub="type, options, range")
    e = D.node(230, 200, 150, 46, "Save (versioned)", "store", sub="localStorage: syntra.settings")
    f = D.node(230, 268, 150, 34, "Notify listeners", "accent")
    r1 = D.node(0, 340, 160, 52, "applyAppearance()", "process", sub="CSS variables + data-* on <html>")
    r2 = D.node(172, 340, 160, 52, "Re-render affected views", "process", sub="messages, list, admin console")
    r3 = D.node(344, 340, W - 344, 52, "Settings column refresh", "process", sub="radios, live chat preview")
    D.arrow([a["b"], b["t"]])
    D.arrow([b["b"], c["t"]])
    D.arrow([c["b"], c2["t"]], label="yes")
    D.arrow([c["r"], d["l"]], label="no")
    D.arrow([d["b"], e["t"]])
    D.arrow([e["b"], f["t"]])
    for r in (r1, r2, r3):
        D.arrow([f["b"], (f["b"][0], 322), (r["t"][0], 322), r["t"]])
    # policy + load paths
    p1 = D.node(W - 104, 0, 104, 52, "Security policy", "admin", sub="Admin console (Super Admin)")
    p2 = D.node(W - 104, 76, 104, 40, "S.setPolicy()", "admin")
    p3 = D.node(W - 104, 140, 104, 52, "syntra.policy", "store", sub="server-issued later")
    D.arrow([p1["b"], p2["t"]])
    D.arrow([p2["b"], p3["t"]])
    D.arrow([p3["l"], (W - 116, p3["l"][1]), (W - 116, 107), (c["t"][0] + 28, 107), (c["t"][0] + 28, c["t"][1] + 11)],
            color=PURPLE, dashed=True, label="locks these keys", label_at=0.45)
    L = D.node(0, 414, W, 48, "On every start", "ghost",
               sub="read stored settings → run migrations (e.g. v1 font size → v2 text scale) → validate each value → apply "
                   "policy → applyAppearance(). Unknown or invalid values fall back to defaults, so old data can't break the UI.")
    return D.d


def diagram_posting():
    D = Diagram(CONTENT_W, 470)
    W = CONTENT_W
    cx = 150
    a = D.node(cx - 100, 0, 200, 34, "Open an announcement channel", "start")
    q1 = D.node(cx - 80, 54, 160, 62, "Channel restricted?", "decision")
    q2 = D.node(cx - 95, 140, 190, 78, "Admin of this unit or a unit above it (or Super Admin)?", "decision", size=8)
    q3 = D.node(cx - 85, 242, 170, 70, "On this channel's posters list?", "decision")
    q4 = D.node(cx - 95, 336, 190, 78, "Poster in a higher unit's channel?", "decision")
    deny = D.node(cx - 100, 436, 200, 34, "Read-only · 'See who' can post", "deny")
    allow = D.node(W - 170, 200, 170, 60, "Composer shown", "allow", sub="can post (and reply)")
    D.arrow([a["b"], q1["t"]])
    D.arrow([q1["b"], q2["t"]], label="yes")
    D.arrow([q2["b"], q3["t"]], label="no")
    D.arrow([q3["b"], q4["t"]], label="no")
    D.arrow([q4["b"], deny["t"]], label="no")
    ax = allow["l"][0]
    bus = ax - 34
    for q, lab in ((q1, "no"), (q2, "yes"), (q3, "yes"), (q4, "yes")):
        D.d.add(Line(q["r"][0], D.Y(q["r"][1]), bus, D.Y(q["r"][1]), strokeColor=ACCENT, strokeWidth=1))
        lx = (q["r"][0] + bus) / 2
        tw = stringWidth(lab, FONT, 7.4) + 8
        D.d.add(Rect(lx - tw / 2, D.Y(q["r"][1] + 5.5), tw, 11, rx=3, ry=3, fillColor=colors.white, strokeColor=None))
        D.d.add(String(lx, D.Y(q["r"][1]) - 2.6, lab, fontName=FONT, fontSize=7.4, fillColor=ACCENT, textAnchor="middle"))
    D.d.add(Line(bus, D.Y(q1["r"][1]), bus, D.Y(q4["r"][1]), strokeColor=ACCENT, strokeWidth=1))
    D.arrow([(bus, allow["c"][1]), allow["l"]], color=ACCENT)
    D.note(W - 170, 290, "canPost(channel) in js/app.js", 7.6, INK2, font=MONO)
    D.note(W - 170, 304, "Posters can be Standard Users,", 7.6)
    D.note(W - 170, 316, "e.g. a company commander.", 7.6)
    return D.d


def diagram_units():
    D = Diagram(CONTENT_W, 300)
    W = CONTENT_W
    bn = D.node(W / 2 - 120, 0, 240, 58, "2-14 Signal Bn (Battalion)", "accent",
                sub="Battalion Announcements · posters: LTC Shaw, CSM Moreno, MAJ Ellis   ·   S6 Bulletins")
    cw = (W - 40) / 3
    hq = D.node(0, 120, cw, 66, "HQ Co", "process", sub="HQ Co Announcements · posters chosen by the HQ Co admin")
    ac = D.node(cw + 20, 120, cw, 66, "A Co", "process", sub="A Co Announcements · posters: CPT Hale, SFC Santos")
    bc = D.node(2 * (cw + 20), 120, cw, 66, "B Co", "process", sub="B Co Announcements · posters: SGT Okafor")
    for n in (hq, ac, bc):
        D.arrow([bn["b"], (bn["b"][0], 94), (n["t"][0], 94), n["t"]])
    sa = D.node(0, 218, cw, 54, "Super Admin", "admin", sub="manages every unit and channel")
    ad = D.node(cw + 20, 218, cw, 54, "Admin (demo: HQ Co)", "admin", sub="manages HQ Co only: accounts, devices, channel, reports, log")
    us = D.node(2 * (cw + 20), 218, cw, 54, "Standard User (demo: A Co)", "ghost", sub="sees A Co + Battalion channels; posts only if chosen")
    D.note(0, 210, "WHO MANAGES WHAT (DEMO ACCOUNTS)", 7.2, INK2, font=BOLD)
    D.note(W / 2, 292, "Visibility: your unit + the units above it.  Management: your unit + the units below it.  "
                       "Battalion posters can also post down into company channels.", 7.6, INK2, "middle")
    return D.d


def diagram_target():
    D = Diagram(CONTENT_W, 330)
    W = CONTENT_W
    client = D.node(0, 0, W, 50, "Syntra desktop client (this front end)", "accent",
                    sub="same UI; mock data and simulated steps replaced by API calls · end-to-end encryption happens on the device")
    gw = D.node(W / 2 - 110, 86, 220, 40, "API gateway (TLS, rate limits)", "process")
    D.arrow([client["b"], gw["t"]], label="HTTPS + WebSocket")
    cw = (W - 30) / 4
    D.group(0, 134, W, 166, "")
    row = [("Identity & sign-in", "accounts, QR device linking, sessions"),
           ("Message relay", "stores and forwards encrypted messages only"),
           ("Key server", "public keys, safety numbers"),
           ("Push / presence", "notifications, typing, online status")]
    row2 = [("Directory service", "units, accounts, temporary access"),
            ("Policy service", "enforced settings → syntra.policy"),
            ("Audit log store", "append-only, exportable"),
            ("Admin API", "console actions, posters, broadcasts")]
    nodes1, nodes2 = [], []
    for i, (t, s) in enumerate(row):
        nodes1.append(D.node(i * (cw + 10), 160, cw, 52, t, "store", sub=s, size=8.2))
    for i, (t, s) in enumerate(row2):
        nodes2.append(D.node(i * (cw + 10), 236, cw, 52, t, "admin" if i else "store", sub=s, size=8.2))
    D.arrow([gw["b"], (gw["b"][0], 134)])
    D.note(10, 148, "BACKEND SERVICES (RECOMMENDED)", 7.2, INK2, font=BOLD)
    D.note(W / 2, 318, "Recommended target only: nothing on this page exists yet. Today every box below the client is simulated in js/data.js.",
           7.6, RED, "middle")
    return D.d


# ================================================================ document
styles = {
    "title": ParagraphStyle("title", fontName=BOLD, fontSize=30, leading=36, textColor=INK, spaceAfter=6),
    "subtitle": ParagraphStyle("subtitle", fontName=FONT, fontSize=13, leading=18, textColor=INK2),
    "h1": ParagraphStyle("h1", fontName=BOLD, fontSize=17, leading=22, textColor=ACCENT, spaceBefore=4, spaceAfter=8),
    "h2": ParagraphStyle("h2", fontName=BOLD, fontSize=12, leading=16, textColor=INK, spaceBefore=10, spaceAfter=4),
    "body": ParagraphStyle("body", fontName=FONT, fontSize=9.6, leading=14, textColor=INK, spaceAfter=6),
    "small": ParagraphStyle("small", fontName=FONT, fontSize=8.4, leading=11.5, textColor=INK2, spaceAfter=4),
    "bullet": ParagraphStyle("bullet", fontName=FONT, fontSize=9.6, leading=14, textColor=INK, leftIndent=14,
                             bulletIndent=3, spaceAfter=2),
    "caption": ParagraphStyle("caption", fontName=FONT, fontSize=8.2, leading=11, textColor=INK2, alignment=TA_CENTER,
                              spaceBefore=4, spaceAfter=10),
    "cell": ParagraphStyle("cell", fontName=FONT, fontSize=8.4, leading=11, textColor=INK),
    "cellb": ParagraphStyle("cellb", fontName=BOLD, fontSize=8.4, leading=11, textColor=INK),
    "code": ParagraphStyle("code", fontName=MONO, fontSize=8.2, leading=11, textColor=INK),
}


def P(t, s="body"):
    return Paragraph(t, styles[s])


def bullets(items):
    return [Paragraph(i, styles["bullet"], bulletText="•") for i in items]


def table(rows, widths, header=True):
    data = [[Paragraph(str(c), styles["cellb" if (header and r == 0) or (ci == 0 and not header) else "cell"])
             for ci, c in enumerate(row)] for r, row in enumerate(rows)]
    t = Table(data, colWidths=widths, repeatRows=1 if header else 0)
    st = [("GRID", (0, 0), (-1, -1), 0.5, LINE), ("VALIGN", (0, 0), (-1, -1), "TOP"),
          ("LEFTPADDING", (0, 0), (-1, -1), 6), ("RIGHTPADDING", (0, 0), (-1, -1), 6),
          ("TOPPADDING", (0, 0), (-1, -1), 4), ("BOTTOMPADDING", (0, 0), (-1, -1), 4)]
    if header:
        st += [("BACKGROUND", (0, 0), (-1, 0), ACCENT_SOFT)]
    st += [("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, PANEL])]
    t.setStyle(TableStyle(st))
    return t


def figure(drawing, caption, max_h=None):
    """Drawing + caption kept together; scaled down if taller than max_h points."""
    if max_h and drawing.height > max_h:
        f = max_h / drawing.height
        drawing.scale(f, f)
        drawing.width *= f
        drawing.height *= f
    drawing.hAlign = "CENTER"
    return KeepTogether([drawing, P(caption, "caption")])


def on_page(canv, doc):
    canv.saveState()
    if doc.page > 1:
        canv.setFillColor(ACCENT)
        canv.rect(0, PAGE_H - 6, PAGE_W, 6, stroke=0, fill=1)
        canv.setFont(FONT, 8)
        canv.setFillColor(INK2)
        canv.drawString(MARGIN, 0.5 * inch, "Syntra · Front-end architecture · v0.4 prototype")
        canv.drawRightString(PAGE_W - MARGIN, 0.5 * inch, "Page %d" % doc.page)
    canv.restoreState()


def build():
    doc = BaseDocTemplate(OUT, pagesize=letter, leftMargin=MARGIN, rightMargin=MARGIN, topMargin=0.8 * inch,
                          bottomMargin=0.8 * inch, title="Syntra — Front-end Architecture",
                          author="Syntra project", subject="Architecture overview with flowcharts")
    frame = Frame(MARGIN, 0.8 * inch, CONTENT_W, PAGE_H - 1.6 * inch, id="f")
    doc.addPageTemplates([PageTemplate(id="p", frames=[frame], onPage=on_page)])
    s = []

    # ---------------- cover
    s += [Spacer(1, 1.6 * inch)]
    logo = Drawing(64, 64)
    logo.add(Rect(0, 0, 64, 64, rx=18, ry=18, fillColor=ACCENT, strokeColor=None))
    logo.add(String(32, 18, "S", fontName=BOLD, fontSize=38, fillColor=colors.white, textAnchor="middle"))
    s += [logo, Spacer(1, 18), P("Syntra", "title"), P("Front-end architecture and system flowcharts", "subtitle"),
          Spacer(1, 26),
          P("A secure messaging client for military personnel: how the current HTML/CSS/JavaScript prototype is "
            "organised, how data and permissions flow through it, and what a production backend will need.", "body"),
          Spacer(1, 40),
          table([["Version", "0.4 (front-end prototype, no backend)"],
                 ["Date", date.today().strftime("%d %B %Y")],
                 ["Repository", "Syntra-M (index.html, css/, js/, serve.py)"],
                 ["Audience", "Developers, system owners, reviewers"]], [1.3 * inch, CONTENT_W - 1.3 * inch], header=False),
          PageBreak()]

    # ---------------- 1. overview
    s += [P("1. Overview", "h1"),
          P("Syntra is a desktop-first messaging application with end-to-end encrypted chats and calls, military "
            "message precedence, unit announcement channels and a role-based Admin console. This repository contains "
            "the <b>front end only</b>: a static web page that runs entirely in the browser. People, messages, delivery "
            "and sign-in are simulated so the interface can be designed and reviewed before a backend exists."),
          P("Design principles", "h2")]
    s += bullets([
        "<b>No build step and no network dependencies.</b> Plain HTML, CSS and JavaScript; no external fonts or "
        "libraries, so it runs on air-gapped networks.",
        "<b>One source of truth per concern.</b> Settings are declared once in a schema; permissions are checked by "
        "name with <font face='%s'>can()</font>; units are a single tree." % MONO,
        "<b>Future-proof data.</b> Stored settings carry a version number and are migrated and validated on load; "
        "the Super Admin's policy can lock any setting.",
        "<b>Smooth by construction.</b> Keyed DOM patching updates only what changed; every animation respects the "
        "user's motion and speed settings.",
        "<b>Responsive.</b> One layout adapts from a phone (single pane, bottom bar) to ultrawide monitors.",
    ])
    s += [P("Module map", "h2"),
          table([["File", "Global it defines", "Responsibility"],
                 ["index.html", "—", "Page markup, SVG icon sprite, sign-in card, loading screen; loads scripts in order"],
                 ["css/styles.css", "—", "Design tokens (CSS variables), Day/Dark/Night ops themes, layout, animations, breakpoints"],
                 ["js/settings.js", "SyntraSettings", "Settings schema, validation, versioned storage and migrations, admin policy, import/export"],
                 ["js/data.js", "SyntraData", "Mock data: unit tree, people, accounts, chats, channels, calls, audit log, reports"],
                 ["js/app.js", "Syntra (shared API)", "Core app: session and roles, unit scope, chat list, messages, composer, calls, lock, rendering engine"],
                 ["js/admin.js", "SyntraAdmin", "Admin console views and actions, 'who can post' dialog"],
                 ["js/guide.js", "SyntraGuide", "Searchable in-app user guide"],
                 ["js/settings-panel.js", "SyntraSettingsPanel", "Telegram-style settings column, main menu, live chat preview"],
                 ["serve.py", "—", "Local dev server with no-cache headers"]],
                [1.35 * inch, 1.3 * inch, CONTENT_W - 2.65 * inch]),
          PageBreak()]

    # ---------------- 2. module architecture
    s += [P("2. Module architecture", "h1"),
          P("Scripts load in a fixed order. The two foundation modules (settings and data) have no dependencies. "
            "<font face='%s'>app.js</font> builds on them and then publishes a small shared API, "
            "<font face='%s'>window.Syntra</font>, which the three feature modules use. Feature modules never talk to "
            "each other directly; they go through the shared API, so each can be replaced independently." % (MONO, MONO)),
          figure(diagram_modules(), "Figure 1. Modules, load order and storage. Dashed blue lines are reads/writes to browser storage."),
          PageBreak()]

    # ---------------- 3. startup and sign-in
    s += [P("3. Start-up and sign-in", "h1"),
          P("The sign-in card offers the three account types and two methods: username and password, or a QR code "
            "scanned with Syntra on a phone. In this prototype any password is accepted and the QR scan is simulated; "
            "the flow and the screens are what a real identity service would plug into."),
          figure(diagram_startup(), "Figure 2. From opening the page to the main interface."),
          PageBreak()]

    # ---------------- 4. sending a message
    s += [P("4. Sending a message", "h1"),
          P("Messages carry a precedence level. Flash messages need confirmation, using an in-app dialog because some "
            "embedded browsers silently block the browser's own confirm(). Delivery, read receipts and replies are "
            "simulated today; with a backend, the same status updates would arrive over the network."),
          figure(diagram_send(), "Figure 3. Composer to delivered message.", max_h=415),
          table([["Precedence", "Code", "Use for", "What Syntra does"],
                 ["Routine", "R", "Normal traffic", "No tag"],
                 ["Priority", "P", "Prompt action needed", "Blue tag; Priority folder"],
                 ["Immediate", "O", "Affects an ongoing mission", "Orange tag and outline"],
                 ["Flash", "Z", "Emergencies only", "Red tag; confirmation; overrides Do Not Disturb"]],
                [1.0 * inch, 0.55 * inch, 2.0 * inch, CONTENT_W - 3.55 * inch]),
          PageBreak()]

    # ---------------- 5. rendering
    s += [P("5. Rendering and motion", "h1"),
          P("The chat list and the message area are re-described as HTML whenever state changes, but they are not "
            "rebuilt. <font face='%s'>morph()</font> compares the new markup with the existing rows by key and touches "
            "only what changed. This is what keeps the interface smooth: hover states survive, animations don't "
            "restart, and reordered chats slide into place." % MONO),
          figure(diagram_render(), "Figure 4. The keyed patching pipeline used by the chat list and message area."),
          P("Motion settings", "h2")]
    s += bullets([
        "<b>Animations</b> on/off, <b>Power Saving</b> (full, reduced, off, or follow Windows) and <b>speed</b> "
        "(Relaxed, Normal, Fast).",
        "Speed is applied centrally by setting <font face='%s'>playbackRate</font> on every CSS and scripted animation, "
        "so no individual duration needs changing." % MONO,
        "Timers that wait for an animation (closing panels, removing rows) use the same scale, with a fallback so "
        "nothing gets stuck when a window is in the background.",
    ])
    s += [PageBreak()]

    # ---------------- 6. settings and policy
    s += [P("6. Settings and admin policy", "h1"),
          P("Every user setting is declared once in the schema in <font face='%s'>js/settings.js</font>. The settings "
            "column, validation, defaults, reset, search, import and export are all generated from it, so adding an "
            "option means adding one entry. The Super Admin can enforce any setting for everyone; enforced settings are "
            "locked in each user's Settings and marked 'Managed'." % MONO),
          figure(diagram_settings(), "Figure 5. How a settings change is validated, stored and applied, and where policy plugs in.", max_h=400),
          table([["Storage key", "Where", "Contents"],
                 ["syntra.settings", "localStorage", "{ version, values } for every user preference"],
                 ["syntra.policy", "localStorage", "Settings enforced by the Super Admin, plus allowed attachment types"],
                 ["syntra.session", "sessionStorage or localStorage", "Signed-in role and username ('Keep me signed in' uses localStorage)"],
                 ["syntra.theme", "localStorage", "Last applied theme, read before first paint"],
                 ["syntra.tips", "localStorage", "Tip cards the user dismissed"]],
                [1.25 * inch, 1.75 * inch, CONTENT_W - 3.0 * inch]),
          PageBreak()]

    # ---------------- 7. roles, units, permissions
    s += [P("7. Roles, units and permissions", "h1"),
          P("There are three roles. Each role is a list of named permissions, and the interface only ever asks "
            "<font face='%s'>can('permission')</font>, never 'is this a Super Admin?'. Roles can therefore be "
            "re-mapped later in one place without touching the screens." % MONO),
          table([["Permission", "Standard User", "Admin", "Super Admin"],
                 ["Messaging, calls, own groups, own settings", "Yes", "Yes", "Yes"],
                 ["Post in announcement channels", "If chosen as poster", "Own unit's channels", "All channels"],
                 ["Choose who can post", "—", "Own unit's channels", "All channels"],
                 ["Approve / suspend / temporary accounts", "—", "Standard Users in own unit", "Everyone"],
                 ["Remote-lock or wipe devices, review reports", "—", "Own unit", "All units"],
                 ["Activity log", "—", "Own unit's activity", "Full, incl. system events"],
                 ["Make or remove Admins", "—", "—", "Yes"],
                 ["Security policy", "—", "View only", "Edit"],
                 ["Broadcasts and service accounts", "—", "—", "Yes"]],
                [2.15 * inch, 1.2 * inch, 1.45 * inch, CONTENT_W - 4.8 * inch]),
          Spacer(1, 10),
          figure(diagram_units(), "Figure 6. Unit tree, announcement channels and who manages what (demo data)."),
          PageBreak(),
          P("Who can post in a channel", "h2"),
          P("Every announcement channel belongs to a unit and has its own posters list, usually the command team. "
            "Posters don't need an Admin account. The decision below is made by <font face='%s'>canPost()</font> each "
            "time a channel is opened, and the composer is shown or replaced by a read-only note." % MONO),
          figure(diagram_posting(), "Figure 7. Posting permission decision for an announcement channel."),
          PageBreak()]

    # ---------------- 8. admin console
    s += [P("8. Admin console", "h1"),
          P("Available to Admins and the Super Admin from the left bar. Every view is filtered by the signed-in "
            "person's unit scope: an Admin sees only their unit and the units under it."),
          table([["Section", "What it does", "Who"],
                 ["Overview", "Counts that need attention, duties for this role, recent activity", "Admin, Super Admin"],
                 ["Users & devices", "Approve/deny requests, add users (incl. temporary), suspend, reset sign-in, remote-lock, wipe", "Admin (own unit), Super Admin"],
                 ["Groups & moderation", "Unit announcement channels, Restricted switch, 'Who can post', new channel, reported messages", "Admin (own unit), Super Admin"],
                 ["Activity log", "Searchable trail of actions, CSV export", "Admin (own unit), Super Admin (all)"],
                 ["Security policy", "Enforce settings for everyone, allowed attachment types", "Admin view only, Super Admin edits"],
                 ["System", "Make/remove Admins, system broadcast, service accounts, status", "Super Admin"]],
                [1.35 * inch, CONTENT_W - 2.95 * inch, 1.6 * inch]),
          P("Every console action writes an entry to the activity log, including posting-rights changes "
            "('Gave posting rights in HQ Co Announcements → SPC Brooks').", "small"),
          PageBreak()]

    # ---------------- 9. path to production
    s += [P("9. Path to production", "h1"),
          P("The front end is structured so the simulated parts can be swapped for real services without redesigning "
            "the screens. The diagram is a recommended target, not something that exists yet."),
          figure(diagram_target(), "Figure 8. Recommended backend services behind the existing client."),
          P("Simulated today", "h2")]
    s += bullets([
        "Sign-in accepts any password; the QR scan is a demo button. → Identity service.",
        "People, chats, channels, accounts, reports and the audit log come from <font face='%s'>js/data.js</font> and "
        "reset on reload. → Directory, relay and audit services." % MONO,
        "Delivery ticks, typing and replies are timers. → Message relay and presence over WebSocket.",
        "Policy lives in the browser. → Policy service pushes it; the client keeps the same lock behaviour.",
        "Device lists, storage figures and speaker/camera names are examples.",
    ])
    s += [P("Security notes for the backend", "h2")]
    s += bullets([
        "Encrypt end-to-end on the device; the relay should only ever store ciphertext.",
        "Enforce every permission on the server too. The client's can() and unit scope are for the interface only.",
        "Keep the audit log append-only and outside the reach of the accounts it records.",
        "Issue policy from the server and re-apply it on every sign-in so a local edit can't bypass it.",
    ])

    doc.build(s)
    print("wrote", OUT)


if __name__ == "__main__":
    build()
