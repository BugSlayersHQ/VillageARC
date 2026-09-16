from pathlib import Path
import json
import base64
import requests
from PIL import Image


ROOT = Path.cwd()

INPUT = ROOT / "outputs/documents/pdf1/document_result.json"
OUTPUT = ROOT / "outputs/documents/pdf1/refined_records.json"

VLLM_URL = "http://127.0.0.1:8000/v1/chat/completions"
MODEL = "datalab-to/surya-ocr-2"


# Actual page-2 table boundaries from the overlay
#          1       2       3       4       5       6
BOUNDARIES = [
    70,
    175,
    255,
    500,
    630,
    720,
    810,
]


def crop_to_column(image, bbox, column_index):
    """
    Crop YOLO cell to the actual table column.

    column_index:
        0 = serial
        1 = area
        2 = owner
        3 = related owner
        4 = crop
        5 = crop area
    """

    x1, y1, x2, y2 = bbox

    left = max(x1, BOUNDARIES[column_index])
    right = min(x2, BOUNDARIES[column_index + 1])

    if right <= left:
        return None

    # Small vertical padding
    top = max(0, y1 - 3)
    bottom = min(image.height, y2 + 3)

    return image.crop(
        (
            int(left),
            int(top),
            int(right),
            int(bottom),
        )
    )


def image_to_data_url(image):
    import io

    buffer = io.BytesIO()
    image.save(buffer, format="PNG")

    encoded = base64.b64encode(
        buffer.getvalue()
    ).decode("utf-8")

    return f"data:image/png;base64,{encoded}"


def recognize(image):
    """
    Recognize handwritten text using Surya OCR 2 via vLLM.
    """

    image_url = image_to_data_url(image)

    payload = {
        "model": MODEL,
        "messages": [
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": "Describe this image in one sentence.",
                        "text": (
                            "OCR this image.\n"
                            "Transcribe all visible text exactly as written.\n"
                            "This is a handwritten Hindi land-record table cell.\n"
                            "Output ONLY the transcription.\n"
                            "Do not output JSON.\n"
                            "Do not output bounding boxes.\n"
                            "Do not describe the image.\n"
                            "Do not classify the content.\n"
                            "Preserve Devanagari, Hindi digits, Arabic digits, "
                            "decimal points and punctuation."
                        ),
                    },
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": image_url
                        },
                    },
                ],
            }
        ],
        "temperature": 0,
        "max_tokens": 1024,
    }

    response = requests.post(
        VLLM_URL,
        json=payload,
        timeout=180,
    )

    response.raise_for_status()

    result = response.json()

    text = result["choices"][0]["message"]["content"]
        # Reject layout-analysis JSON accidentally returned by the model


    text = result["choices"][0]["message"]["content"]

    return text.strip()

def classify_column(cell):
    x1, _, x2, _ = cell["bbox"]

    xc = (x1 + x2) / 2

    if 70 <= xc < 175:
        return 0, "serial_number"

    if 175 <= xc < 255:
        return 1, "plot_area"

    if 255 <= xc < 500:
        return 2, "landowner_details"

    if 500 <= xc < 630:
        return 3, "related_owner_details"

    if 630 <= xc < 720:
        return 4, "crop_name"

    if 720 <= xc < 810:
        return 5, "crop_area"

    return None, None


def main():

    with INPUT.open(
        "r",
        encoding="utf-8"
    ) as f:
        document = json.load(f)

    page = next(
        p for p in document["pages"]
        if p["page_number"] == 2
    )

    image = Image.open(
        page["image"]
    ).convert("RGB")

    cells = page["result"]["cells"]

    rows = []

    # Group cells by vertical position
    sorted_cells = sorted(
        cells,
        key=lambda c: (
            (c["bbox"][1] + c["bbox"][3]) / 2
        )
    )
    print("TESTING ONE CELL:", cells[0]["cell_id"])

    cell = cells[0]

    column_index, field = classify_column(cell)

    cropped = crop_to_column(
        image,
        cell["bbox"],
        column_index
    )

    print("FIELD:", field)
    print("RESULT:", recognize(cropped))

    return

    for cell in sorted_cells:

        x1, y1, x2, y2 = cell["bbox"]

        # Ignore footer/extra handwriting
        yc = (y1 + y2) / 2

        if yc > 1700:
            continue

        column_index, field = classify_column(cell)

        if field is None:
            continue

        cropped = crop_to_column(
            image,
            cell["bbox"],
            column_index
        )

        if cropped is None:
            continue

        print(
            f"Recognizing "
            f"{cell['cell_id']} → {field}"
        )

        try:
            text = recognize(cropped)
        except Exception as e:
            print(
                f"ERROR {cell['cell_id']}: {e}"
            )
            text = ""

        # Find an existing row
        target = None

        for row in rows:
            if abs(row["y_center"] - yc) < 70:
                target = row
                break

        if target is None:
            target = {
                "y_center": yc,
                "fields": {},
                "raw_cells": [],
            }
            rows.append(target)

        target["fields"][field] = text

        target["raw_cells"].append(
            {
                "cell_id": cell["cell_id"],
                "bbox": cell["bbox"],
                "field": field,
                "text": text,
            }
        )

    # Sort rows
    rows.sort(
        key=lambda r: r["y_center"]
    )

    records = []

    for index, row in enumerate(rows, start=1):

        fields = row["fields"]

        records.append(
            {
                "row_number": index,
                "serial_number": fields.get(
                    "serial_number"
                ),
                "plot_area": fields.get(
                    "plot_area"
                ),
                "landowner_details": fields.get(
                    "landowner_details"
                ),
                "related_owner_details": fields.get(
                    "related_owner_details"
                ),
                "crop_name": fields.get(
                    "crop_name"
                ),
                "crop_area": fields.get(
                    "crop_area"
                ),
                "raw_cells": row["raw_cells"],
            }
        )

    output = {
        "status": "success",
        "page": 2,
        "method": "YOLO + column-clipped Surya OCR 2",
        "land_records": records,
    }

    with OUTPUT.open(
        "w",
        encoding="utf-8"
    ) as f:
        json.dump(
            output,
            f,
            ensure_ascii=False,
            indent=2
        )

    print()
    print("=" * 60)
    print("REFINEMENT COMPLETE")
    print("=" * 60)
    print(f"Records: {len(records)}")
    print(f"Output: {OUTPUT}")


if __name__ == "__main__":
    main()
