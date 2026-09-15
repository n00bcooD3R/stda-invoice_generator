import sys
sys.stdout.reconfigure(encoding='utf-8')
import pymupdf

# Extract images from header footer PDF
doc = pymupdf.open('headerfooter_format.pdf')
for page_num, page in enumerate(doc):
    images = page.get_images(full=True)
    print(f"Page {page_num}: {len(images)} images found")
    for img_idx, img in enumerate(images):
        xref = img[0]
        base_image = doc.extract_image(xref)
        image_bytes = base_image['image']
        ext = base_image['ext']
        w = base_image.get("width", "?")
        h = base_image.get("height", "?")
        print(f"  Image {img_idx}: {ext}, {len(image_bytes)} bytes, {w}x{h}")
        fname = f"header_img_{page_num}_{img_idx}.{ext}"
        with open(fname, 'wb') as f:
            f.write(image_bytes)
        print(f"  Saved: {fname}")

# Also extract from Geltec
doc2 = pymupdf.open('Geltec.pdf')
for page_num, page in enumerate(doc2):
    images = page.get_images(full=True)
    print(f"Geltec Page {page_num}: {len(images)} images found")
    for img_idx, img in enumerate(images):
        xref = img[0]
        base_image = doc2.extract_image(xref)
        image_bytes = base_image['image']
        ext = base_image['ext']
        w = base_image.get("width", "?")
        h = base_image.get("height", "?")
        print(f"  Image {img_idx}: {ext}, {len(image_bytes)} bytes, {w}x{h}")
        fname = f"geltec_img_{page_num}_{img_idx}.{ext}"
        with open(fname, 'wb') as f:
            f.write(image_bytes)
        print(f"  Saved: {fname}")
