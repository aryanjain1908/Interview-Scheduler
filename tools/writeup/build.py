"""Builds the 2-page write-up in every format from docs/writeup/writeup.md.

    python tools/writeup/build.py      # HTML, Word, text and Markdown
    node tools/writeup/pdf.mjs         # then the PDF (needs Edge)

Outputs go to frontend/public/downloads/, where the website serves them.
Only the small Markdown subset the write-up uses is supported: # and ## headings,
paragraphs, **bold**, "- " bullets and pipe tables.
"""

import html
import re
import shutil
from pathlib import Path

from docx import Document
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Pt, RGBColor

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "docs" / "writeup" / "writeup.md"
OUT = ROOT / "frontend" / "public" / "downloads"
NAME = "GRIT-Interviews-Writeup"

INK = RGBColor(0x14, 0x16, 0x2B)
MUTED = RGBColor(0x55, 0x5B, 0x70)
ACCENT = RGBColor(0x43, 0x38, 0xCA)


# --- parsing -----------------------------------------------------------------

def parse(text: str) -> list:
    """Markdown -> blocks: (h1|h2|label|p, text), (ul, [items]), (table, header, rows)."""
    blocks, lines, i = [], text.splitlines(), 0
    while i < len(lines):
        line = lines[i].rstrip()
        if not line:
            i += 1
        elif line.startswith("# "):
            blocks.append(("h1", line[2:]))
            i += 1
        elif line.startswith("## "):
            blocks.append(("h2", line[3:]))
            i += 1
        elif line.startswith("- "):
            items = []
            while i < len(lines) and lines[i].startswith("- "):
                items.append(lines[i][2:].strip())
                i += 1
            blocks.append(("ul", items))
        elif line.startswith("|"):
            rows = []
            while i < len(lines) and lines[i].startswith("|"):
                cells = [c.strip() for c in lines[i].strip().strip("|").split("|")]
                if not all(re.fullmatch(r":?-+:?", c) for c in cells):
                    rows.append(cells)
                i += 1
            blocks.append(("table", rows[0], rows[1:]))
        elif re.fullmatch(r"\*\*[^*]+\*\*", line):
            blocks.append(("label", line[2:-2]))
            i += 1
        else:
            para = [line]
            i += 1
            while i < len(lines) and lines[i].strip() and not re.match(r"(#|- |\|)", lines[i]):
                para.append(lines[i].strip())
                i += 1
            blocks.append(("p", " ".join(para)))
    return blocks


def spans(text: str) -> list:
    """Inline text -> [(text, bold)]."""
    parts = re.split(r"(\*\*[^*]+\*\*)", text)
    return [(p[2:-2], True) if p.startswith("**") else (p, False) for p in parts if p]


def plain(text: str) -> str:
    return text.replace("**", "")


# --- HTML (PDF source and the website) ---------------------------------------

def inline_html(text: str) -> str:
    out = []
    for chunk, bold in spans(text):
        safe = html.escape(chunk)
        safe = re.sub(r"(https?://[^\s<]+)", r'<a href="\1">\1</a>', safe)
        safe = re.sub(r"(?<![/\w])(github\.com/[\w./-]+)", r'<a href="https://\1">\1</a>', safe)
        out.append(f"<strong>{safe}</strong>" if bold else safe)
    return "".join(out)


def to_html(blocks: list) -> str:
    out = []
    for block in blocks:
        kind = block[0]
        if kind == "h1":
            out.append(f"<h1>{inline_html(block[1])}</h1>")
        elif kind == "h2":
            out.append(f"<h2>{inline_html(block[1])}</h2>")
        elif kind == "label":
            out.append(f'<p class="label">{inline_html(block[1])}</p>')
        elif kind == "p":
            cls = ' class="byline"' if block is blocks[1] else ""
            out.append(f"<p{cls}>{inline_html(block[1])}</p>")
        elif kind == "ul":
            out.append("<ul>" + "".join(f"<li>{inline_html(t)}</li>" for t in block[1]) + "</ul>")
        elif kind == "table":
            head = "".join(f"<th>{inline_html(c)}</th>" for c in block[1])
            body = "".join("<tr>" + "".join(f"<td>{inline_html(c)}</td>" for c in row) + "</tr>" for row in block[2])
            out.append(f'<div class="table-wrap"><table><thead><tr>{head}</tr></thead><tbody>{body}</tbody></table></div>')
    return "\n".join(out)


PRINT_CSS = """
@page { size: A4; margin: 12mm 14mm; }
* { box-sizing: border-box; }
body { margin: 0; font: 9.1pt/1.42 "Inter", "Segoe UI", sans-serif; color: #14162b; }
h1 { font: 800 16pt/1.2 "Manrope", sans-serif; margin: 0 0 2pt; letter-spacing: -0.01em; }
h2 { font: 800 11pt/1.2 "Manrope", sans-serif; margin: 9pt 0 4pt; color: #4338ca; break-after: avoid; }
p { margin: 0 0 4pt; }
p.byline { color: #555b70; font-size: 8pt; margin-bottom: 6pt; padding-bottom: 5pt; border-bottom: 1px solid #dfe1ea; }
p.label { font-weight: 700; margin: 5pt 0 1.5pt; break-after: avoid; }
a { color: inherit; text-decoration: none; }
ul { margin: 0 0 2pt; padding-left: 12pt; }
li { margin: 0 0 1.6pt; }
table { width: 100%; border-collapse: collapse; margin: 2pt 0 5pt; font-size: 8.3pt; line-height: 1.34; }
th { text-align: left; background: #eef0fb; color: #312e81; font-weight: 700; }
th, td { padding: 2.6pt 5pt; border: 1px solid #dfe1ea; vertical-align: top; }
td:first-child { font-weight: 600; white-space: nowrap; }
tr { break-inside: avoid; }
"""

FONTS = (
    '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
    '<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700'
    '&family=Manrope:wght@800&display=swap" rel="stylesheet">'
)


def print_page(body: str) -> str:
    return (
        f'<!doctype html><html lang="en"><head><meta charset="utf-8"><title>GRIT Interviews: Write-up</title>'
        f"{FONTS}<style>{PRINT_CSS}</style></head><body>{body}</body></html>"
    )


# --- Word ----------------------------------------------------------------------

def shade(cell, fill: str) -> None:
    props = cell._tc.get_or_add_tcPr()
    shading = OxmlElement("w:shd")
    shading.set(qn("w:val"), "clear")
    shading.set(qn("w:color"), "auto")
    shading.set(qn("w:fill"), fill)
    props.append(shading)


def table_layout(table, widths: list) -> None:
    """Fixed column widths (Word ignores cell widths otherwise) and roomy cell padding."""
    table.autofit = False
    props = table._tbl.tblPr
    layout = OxmlElement("w:tblLayout")
    layout.set(qn("w:type"), "fixed")
    props.append(layout)
    margins = OxmlElement("w:tblCellMar")
    for side, twips in (("top", 45), ("bottom", 45), ("left", 100), ("right", 100)):
        edge = OxmlElement(f"w:{side}")
        edge.set(qn("w:w"), str(twips))
        edge.set(qn("w:type"), "dxa")
        margins.append(edge)
    props.append(margins)
    for col, width in zip(table._tbl.tblGrid.findall(qn("w:gridCol")), widths):
        col.set(qn("w:w"), str(int(width / 635)))  # EMU -> twips
    for row in table.rows:
        for cell, width in zip(row.cells, widths):
            cell.width = width


def add_runs(paragraph, text: str, size: float, color=INK, bold_all=False) -> None:
    for chunk, bold in spans(text):
        run = paragraph.add_run(chunk)
        run.bold = bold or bold_all
        run.font.size = Pt(size)
        run.font.color.rgb = color


def tight(paragraph, before=0, after=2, line=1.08) -> None:
    fmt = paragraph.paragraph_format
    fmt.space_before, fmt.space_after, fmt.line_spacing = Pt(before), Pt(after), line


def to_docx(blocks: list, path: Path) -> None:
    doc = Document()
    section = doc.sections[0]
    section.page_width, section.page_height = Cm(21), Cm(29.7)
    section.top_margin = section.bottom_margin = Cm(1.2)
    section.left_margin = section.right_margin = Cm(1.4)
    normal = doc.styles["Normal"]
    normal.font.name = "Calibri"
    normal.element.rPr.rFonts.set(qn("w:eastAsia"), "Calibri")
    normal.font.size = Pt(9.5)
    width = section.page_width - section.left_margin - section.right_margin

    for index, block in enumerate(blocks):
        kind = block[0]
        if kind == "h1":
            p = doc.add_paragraph()
            add_runs(p, block[1], 16, bold_all=True)
            tight(p, after=1)
        elif kind == "h2":
            p = doc.add_paragraph()
            add_runs(p, block[1], 11.5, color=ACCENT, bold_all=True)
            tight(p, before=7, after=3)
            p.paragraph_format.keep_with_next = True
        elif kind == "label":
            p = doc.add_paragraph()
            add_runs(p, block[1], 9.5, bold_all=True)
            tight(p, before=5, after=1.5)
            p.paragraph_format.keep_with_next = True
        elif kind == "p":
            p = doc.add_paragraph()
            byline = index == 1
            add_runs(p, block[1], 8.5 if byline else 9.5, color=MUTED if byline else INK)
            tight(p, after=6 if byline else 4, line=1.12)
        elif kind == "ul":
            for item in block[1]:
                p = doc.add_paragraph(style="List Bullet")
                add_runs(p, item, 9.5)
                tight(p, after=2, line=1.12)
                p.paragraph_format.left_indent = Cm(0.55)
                p.paragraph_format.first_line_indent = Cm(-0.35)
        elif kind == "table":
            header, rows = block[1], block[2]
            table = doc.add_table(rows=1 + len(rows), cols=len(header))
            table.style = "Table Grid"
            table.alignment = WD_TABLE_ALIGNMENT.CENTER
            shares = [0.15, 0.27, 0.58] if header[0] == "State" else [0.25, 0.42, 0.33]
            table_layout(table, [int(width * share) for share in shares])
            for r, cells in enumerate([header] + rows):
                for c, text in enumerate(cells):
                    cell = table.cell(r, c)
                    p = cell.paragraphs[0]
                    add_runs(p, text, 8.8, color=INK, bold_all=(r == 0 or c == 0))
                    tight(p, after=0, line=1.05)
                    if r == 0:
                        shade(cell, "EEF0FB")
            spacer = doc.add_paragraph()
            tight(spacer, after=0, line=0.6)
    doc.core_properties.title = "GRIT Interviews: Write-up"
    doc.core_properties.author = "Aryan Jain"
    doc.save(path)


# --- plain text ------------------------------------------------------------------

def wrap(text: str, width: int = 92, indent: str = "") -> str:
    words, lines, line = text.split(), [], indent
    for word in words:
        if len(line) + len(word) + 1 > width and line.strip():
            lines.append(line.rstrip())
            line = indent
        line += word + " "
    lines.append(line.rstrip())
    return "\n".join(lines)


def to_text(blocks: list) -> str:
    out = []
    for block in blocks:
        kind = block[0]
        if kind == "h1":
            title = plain(block[1])
            out += [title, "=" * len(title), ""]
        elif kind == "h2":
            title = plain(block[1])
            out += ["", title, "-" * len(title), ""]
        elif kind == "label":
            out += [plain(block[1]).upper()]
        elif kind == "p":
            out += [wrap(plain(block[1])), ""]
        elif kind == "ul":
            out += [wrap("* " + plain(t), indent="").replace("\n", "\n  ") for t in block[1]] + [""]
        elif kind == "table":
            header, rows = block[1], block[2]
            for row in rows:
                out.append(f"* {plain(row[0])}")
                for name, value in zip(header[1:], row[1:]):
                    out.append(wrap(f"{plain(name)}: {plain(value)}", indent="    "))
            out.append("")
    return "\n".join(out).rstrip() + "\n"


def main() -> None:
    blocks = parse(SOURCE.read_text(encoding="utf-8"))
    OUT.mkdir(parents=True, exist_ok=True)
    body = to_html(blocks)
    (OUT / "writeup.html").write_text(body + "\n", encoding="utf-8")
    (OUT / "print.html").write_text(print_page(body), encoding="utf-8")
    to_docx(blocks, OUT / f"{NAME}.docx")
    (OUT / f"{NAME}.txt").write_text(to_text(blocks), encoding="utf-8")
    shutil.copyfile(SOURCE, OUT / f"{NAME}.md")
    print(f"Wrote HTML, Word, text and Markdown to {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
