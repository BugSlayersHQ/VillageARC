import json
import re
from pathlib import Path

from PIL import Image
from surya.common.polygon import PolygonBox
from surya.layout.schema import LayoutBox, LayoutResult
from surya.recognition import RecognitionPredictor


PROJECT_ROOT = Path.cwd()

CELL_IMAGE = (
    PROJECT_ROOT
    / "outputs"
    / "crops"
    / "img3"
    / "cell_019.jpg"
)

DETECTION_JSON = (
    PROJECT_ROOT
    / "outputs"
    / "surya_lines_test"
    / "cell_019"
    / "results.json"
)

OUTPUT_DIR = (
    PROJECT_ROOT
    / "outputs"
    / "surya_recognition_test"
    / "cell_019"
)

OUTPUT_JSON = OUTPUT_DIR / "results.json"


def html_to_text(html: str) -> str:
    """Convert Surya's block HTML into plain text."""
    text = re.sub(r"<[^>]+>", " ", html)
    text = text.replace("&nbsp;", " ")
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def load_detection():
    with open(DETECTION_JSON, "r", encoding="utf-8") as f:
        data = json.load(f)

    result = data["cell_019"]

    if isinstance(result, list):
        result = result[0]

    boxes = result["bboxes"]

    # Sort top-to-bottom, then left-to-right
    boxes = sorted(
        boxes,
        key=lambda b: (
            b["bbox"][1],
            b["bbox"][0],
        ),
    )

    return boxes


def build_layout_results(boxes, image):
    """
    Create one LayoutResult per line crop.

    Each line crop is treated as one Text block,
    allowing Surya recognition to run in full_page=False mode.
    """

    images = []
    layouts = []
    metadata = []

    for idx, box in enumerate(boxes, start=1):
        x0, y0, x1, y1 = map(int, box["bbox"])

        # Small padding around detected handwriting.
        pad_x = 4
        pad_y = 4

        x0 = max(0, x0 - pad_x)
        y0 = max(0, y0 - pad_y)
        x1 = min(image.width, x1 + pad_x)
        y1 = min(image.height, y1 + pad_y)

        crop = image.crop((x0, y0, x1, y1))

        images.append(crop)

        w, h = crop.size

        layout_box = LayoutBox(
            polygon=[
                [0, 0],
                [w, 0],
                [w, h],
                [0, h],
            ],
            confidence=box.get("confidence"),
            label="Text",
            raw_label="Text",
            position=0,
            count=0,
        )

        layout = LayoutResult(
            bboxes=[layout_box],
            image_bbox=[0, 0, float(w), float(h)],
        )

        layouts.append(layout)

        metadata.append(
            {
                "line_id": idx,
                "original_bbox": box["bbox"],
                "detector_confidence": box.get("confidence"),
                "crop_size": [w, h],
            }
        )

    return images, layouts, metadata


def main():

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    print(f"Loading: {CELL_IMAGE}")

    image = Image.open(CELL_IMAGE).convert("RGB")

    boxes = load_detection()

    print(f"Detected lines: {len(boxes)}")

    images, layouts, metadata = build_layout_results(
        boxes,
        image,
    )

    print("Running Surya 2 block recognition...")
    print("full_page=False")

    predictor = RecognitionPredictor()

    results = predictor(
        images,
        layouts,
        full_page=False,
    )

    output = {
        "cell": "cell_019",
        "num_lines": len(results),
        "lines": [],
    }

    for meta, result in zip(metadata, results):

        if not result.blocks:
            text = ""
            confidence = 0.0
        else:
            block = result.blocks[0]

            text = html_to_text(block.html)
            confidence = block.confidence

        line_result = {
            **meta,
            "text": text,
            "recognition_confidence": confidence,
        }

        output["lines"].append(line_result)

    output["merged_text"] = "\n".join(
        line["text"]
        for line in output["lines"]
        if line["text"]
    )

    with open(
        OUTPUT_JSON,
        "w",
        encoding="utf-8",
    ) as f:
        json.dump(
            output,
            f,
            ensure_ascii=False,
            indent=2,
        )

    print("\n========== RESULT ==========\n")

    for line in output["lines"]:
        print(
            f"Line {line['line_id']}: "
            f"{line['text']}"
        )

    print("\n========== MERGED ==========\n")
    print(output["merged_text"])

    print(f"\nSaved to: {OUTPUT_JSON}")


if __name__ == "__main__":
    main()