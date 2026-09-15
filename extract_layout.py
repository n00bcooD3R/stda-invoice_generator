import sys
sys.stdout.reconfigure(encoding='utf-8')
import pymupdf

# Get detailed layout of header/footer PDF
doc = pymupdf.open('headerfooter_format.pdf')
page = doc[0]

# Get all text blocks with position info
blocks = page.get_text("dict")
print("Page dimensions:", page.rect.width, "x", page.rect.height)
print()

for block in blocks["blocks"]:
    if block["type"] == 0:  # text block
        bbox = block["bbox"]
        print(f"Block at ({bbox[0]:.0f},{bbox[1]:.0f})-({bbox[2]:.0f},{bbox[3]:.0f}):")
        for line in block["lines"]:
            text = ""
            for span in line["spans"]:
                text += span["text"]
            if text.strip():
                font = line["spans"][0]["font"]
                size = line["spans"][0]["size"]
                color = line["spans"][0]["color"]
                print(f"  [{font} {size:.1f}pt color={color}] {text.strip()}")
    elif block["type"] == 1:  # image block
        bbox = block["bbox"]
        print(f"Image at ({bbox[0]:.0f},{bbox[1]:.0f})-({bbox[2]:.0f},{bbox[3]:.0f})")
