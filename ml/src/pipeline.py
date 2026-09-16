
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

from PIL import Image
from ultralytics import YOLO

from surya.layout.schema import LayoutBox, LayoutResult
from surya.recognition import RecognitionPredictor


# ============================================================
# PROJECT CONFIG
# ============================================================

PROJECT_ROOT = Path(__file__).resolve().parents[1]

# Our trained YOLO handwritten-cell detector
YOLO_MODEL = (
    PROJECT_ROOT
    / "runs"
    / "detect"
    / "runs"
    / "detect"
    / "handwritten_cells_v2"
    / "weights"
    / "best.pt"
)

OUTPUT_ROOT = PROJECT_ROOT / "outputs" / "final"

# YOLO confidence threshold
YOLO_CONFIDENCE = 0.25

# Padding around Surya detected text lines
LINE_PADDING_X = 4
LINE_PADDING_Y = 4


# ============================================================
# TEXT CLEANING
# ============================================================

def html_to_text(html: str) -> str:
    """
    Convert Surya's returned HTML block into plain text.
    """

    if not html:
        return ""

    text = re.sub(r"<[^>]+>", " ", html)

    text = (
        text
        .replace("&nbsp;", " ")
        .replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
    )

    text = re.sub(r"\s+", " ", text)

    return text.strip()


# ============================================================
# SURYA LINE DETECTION
# ============================================================

def run_surya_detection(
    image_path: Path,
    output_dir: Path,
):
    """
    Run Surya's official text-line detector.

    For:

        cell_001.jpg

    Surya creates:

        output_dir/
            cell_001/
                results.json
    """

    output_dir.mkdir(
        parents=True,
        exist_ok=True,
    )

    command = [
        "surya_detect",
        str(image_path),
        "--output_dir",
        str(output_dir),
        "--images",
    ]

    print(
        f"  [Surya Detect] {image_path.name}"
    )

    process = subprocess.run(
        command,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )

    if process.returncode != 0:

        print(process.stdout)
        print(process.stderr)

        raise RuntimeError(
            "Surya line detection failed:\n"
            + process.stderr
        )

    # This is the actual structure produced by
    # the Surya version we tested.
    result_json = (
        output_dir
        / image_path.stem
        / "results.json"
    )

    if not result_json.exists():

        raise FileNotFoundError(
            f"Surya detection result not found:\n"
            f"{result_json}"
        )

    with open(
        result_json,
        "r",
        encoding="utf-8",
    ) as file:

        return json.load(file)


# ============================================================
# PARSE SURYA DETECTION JSON
# ============================================================

def extract_detection_boxes(
    detection_data,
    image_path: Path,
):
    """
    Extract bboxes from Surya's detection JSON.

    The tested Surya output looks like:

    {
        "cell_019": [
            {
                "bboxes": [...]
            }
        ]
    }

    We also handle a dictionary result for robustness.
    """

    key_candidates = [
        image_path.stem,
        image_path.name,
    ]

    result = None

    for key in key_candidates:

        if key in detection_data:

            result = detection_data[key]
            break

    if result is None:

        raise KeyError(
            f"Could not find {image_path.name} "
            f"in Surya detection output.\n"
            f"Available keys: "
            f"{list(detection_data.keys())}"
        )

    # Current Surya output can wrap the page
    # result inside a list.
    if isinstance(result, list):

        if not result:
            return []

        result = result[0]

    if not isinstance(result, dict):

        raise TypeError(
            f"Unexpected Surya detection result type: "
            f"{type(result)}"
        )

    boxes = result.get(
        "bboxes",
        [],
    )

    # Reading order:
    # top → bottom, then left → right.
    boxes = sorted(
        boxes,
        key=lambda item: (
            item["bbox"][1],
            item["bbox"][0],
        ),
    )

    return boxes


# ============================================================
# CREATE SURYA LAYOUT RESULT
# ============================================================

def create_layout_result(
    width: int,
    height: int,
):
    """
    Create a one-block LayoutResult.

    The whole line crop is treated as a single
    Text block.

    This is exactly what RecognitionPredictor
    full_page=False expects.
    """

    layout_box = LayoutBox(
        polygon=[
            [0.0, 0.0],
            [float(width), 0.0],
            [float(width), float(height)],
            [0.0, float(height)],
        ],
        confidence=1.0,
        label="Text",
        raw_label="Text",
        position=0,
        count=0,
    )

    return LayoutResult(
        bboxes=[layout_box],
        image_bbox=[
            0.0,
            0.0,
            float(width),
            float(height),
        ],
    )


# ============================================================
# SURYA 2 RECOGNITION
# ============================================================

def recognize_lines(
    line_images,
    line_metadata,
):
    """
    Recognize all detected line crops using Surya 2.

    IMPORTANT:
        full_page=False

    This prevents Surya from trying to interpret
    the crop as an entire document/page.
    """

    if not line_images:
        return []

    print(
        f"  [Surya 2] Recognizing "
        f"{len(line_images)} lines..."
    )

    layouts = [
        create_layout_result(
            image.width,
            image.height,
        )
        for image in line_images
    ]

    predictor = RecognitionPredictor()

    results = predictor(
        line_images,
        layouts,
        full_page=False,
    )

    recognized = []

    for metadata, result in zip(
        line_metadata,
        results,
    ):

        text = ""
        confidence = 0.0
        recognition_error = False

        if result.blocks:

            block = result.blocks[0]

            if not block.error:

                text = html_to_text(
                    block.html
                )

                confidence = float(
                    block.confidence
                )

            else:

                recognition_error = True

        recognized.append(
            {
                **metadata,
                "text": text,
                "recognition_confidence":
                    confidence,
                "recognition_error":
                    recognition_error,
            }
        )

    return recognized


# ============================================================
# PROCESS ONE YOLO CELL
# ============================================================

def process_cell(
    cell_image: Path,
    cell_id: str,
    cell_bbox,
    cell_confidence: float,
    cell_output: Path,
):
    """
    Complete processing of one YOLO cell:

        cell
          ↓
        Surya detection
          ↓
        line crops
          ↓
        Surya 2 recognition
          ↓
        merged text
    """

    print()
    print(
        f"  -------- {cell_id} --------"
    )

    # --------------------------------------------------------
    # 1. Surya line detection
    # --------------------------------------------------------

    detection_dir = (
        cell_output
        / "line_detection"
    )

    detection_data = run_surya_detection(
        cell_image,
        detection_dir,
    )

    line_boxes = extract_detection_boxes(
        detection_data,
        cell_image,
    )

    print(
        f"  Detected lines: "
        f"{len(line_boxes)}"
    )

    # --------------------------------------------------------
    # 2. Load cell image
    # --------------------------------------------------------

    image = Image.open(
        cell_image
    ).convert("RGB")

    line_images = []
    line_metadata = []

    line_crop_dir = (
        cell_output
        / "line_crops"
    )

    line_crop_dir.mkdir(
        parents=True,
        exist_ok=True,
    )

    # --------------------------------------------------------
    # 3. Crop every detected line
    # --------------------------------------------------------

    for line_index, line_box in enumerate(
        line_boxes,
        start=1,
    ):

        x0, y0, x1, y1 = map(
            int,
            line_box["bbox"],
        )

        # Add small padding so characters
        # touching the detector boundary are preserved.
        x0 = max(
            0,
            x0 - LINE_PADDING_X,
        )

        y0 = max(
            0,
            y0 - LINE_PADDING_Y,
        )

        x1 = min(
            image.width,
            x1 + LINE_PADDING_X,
        )

        y1 = min(
            image.height,
            y1 + LINE_PADDING_Y,
        )

        # Ignore invalid boxes.
        if x1 <= x0 or y1 <= y0:
            continue

        crop = image.crop(
            (
                x0,
                y0,
                x1,
                y1,
            )
        )

        line_id = (
            f"line_{line_index:03d}"
        )

        line_path = (
            line_crop_dir
            / f"{line_id}.jpg"
        )

        crop.save(
            line_path,
            quality=95,
        )

        line_images.append(crop)

        line_metadata.append(
            {
                "line_id": line_index,

                "bbox": [
                    x0,
                    y0,
                    x1,
                    y1,
                ],

                "detector_confidence":
                    float(
                        line_box.get(
                            "confidence",
                            0.0,
                        )
                    ),

                "image":
                    str(
                        line_path.relative_to(
                            PROJECT_ROOT
                        )
                    ),
            }
        )

    # --------------------------------------------------------
    # 4. Surya 2 recognition
    # --------------------------------------------------------

    recognized_lines = recognize_lines(
        line_images,
        line_metadata,
    )

    # --------------------------------------------------------
    # 5. Merge recognized lines
    # --------------------------------------------------------

    merged_text = "\n".join(
        line["text"]
        for line in recognized_lines
        if line["text"].strip()
    )

    return {
        "cell_id": cell_id,

        "bbox": cell_bbox,

        "detection_confidence":
            cell_confidence,

        "num_lines":
            len(recognized_lines),

        "lines":
            recognized_lines,

        "text":
            merged_text,

        "status":
            "success",
    }


# ============================================================
# FULL IMAGE PIPELINE
# ============================================================

def process_image(
    image_path: Path,
):
    """
    Complete end-to-end pipeline:

        Input image
             ↓
        YOLO handwritten cells
             ↓
        Cell crops
             ↓
        Surya line detection
             ↓
        Line crops
             ↓
        Surya 2 recognition
             ↓
        JSON
    """

    image_path = Path(
        image_path
    ).resolve()

    if not image_path.exists():

        raise FileNotFoundError(
            f"Input image does not exist:\n"
            f"{image_path}"
        )

    image_name = image_path.stem

    final_dir = (
        OUTPUT_ROOT
        / image_name
    )

    # Clean previous test result.
    if final_dir.exists():

        shutil.rmtree(
            final_dir
        )

    final_dir.mkdir(
        parents=True,
        exist_ok=True,
    )

    cells_dir = (
        final_dir
        / "cells"
    )

    cells_dir.mkdir(
        parents=True,
        exist_ok=True,
    )

    # ========================================================
    # YOLO DETECTION
    # ========================================================

    print()
    print("=" * 70)
    print("STEP 1 — YOLO HANDWRITTEN CELL DETECTION")
    print("=" * 70)

    print(
        f"Model:\n{YOLO_MODEL}"
    )

    if not YOLO_MODEL.exists():

        raise FileNotFoundError(
            f"YOLO model not found:\n"
            f"{YOLO_MODEL}"
        )

    model = YOLO(
        str(YOLO_MODEL)
    )

    yolo_results = model.predict(
        source=str(image_path),
        conf=YOLO_CONFIDENCE,
        imgsz=1280,
        save=False,
        verbose=False,
    )

    result = yolo_results[0]

    if result.boxes is None:

        detections = []

    else:

        detections = result.boxes

    print(
        f"YOLO detected "
        f"{len(detections)} handwritten cells."
    )

    source_image = Image.open(
        image_path
    ).convert("RGB")

    cells = []

    # ========================================================
    # PROCESS EACH CELL
    # ========================================================

    for cell_index, detection in enumerate(
        detections,
        start=1,
    ):

        x0, y0, x1, y1 = (
            detection.xyxy[0]
            .cpu()
            .tolist()
        )

        confidence = float(
            detection.conf[0]
            .cpu()
            .item()
        )

        # Clamp coordinates to image.
        x0 = max(
            0,
            min(
                int(x0),
                source_image.width,
            ),
        )

        y0 = max(
            0,
            min(
                int(y0),
                source_image.height,
            ),
        )

        x1 = max(
            0,
            min(
                int(x1),
                source_image.width,
            ),
        )

        y1 = max(
            0,
            min(
                int(y1),
                source_image.height,
            ),
        )

        # Ignore invalid YOLO boxes.
        if x1 <= x0 or y1 <= y0:

            continue

        cell_id = (
            f"cell_{cell_index:03d}"
        )

        cell_bbox = [
            x0,
            y0,
            x1,
            y1,
        ]

        print()
        print(
            f"[{cell_index}/{len(detections)}] "
            f"{cell_id}"
        )

        # ----------------------------------------------------
        # Crop cell
        # ----------------------------------------------------

        cell_crop = source_image.crop(
            (
                x0,
                y0,
                x1,
                y1,
            )
        )

        cell_path = (
            cells_dir
            / f"{cell_id}.jpg"
        )

        cell_crop.save(
            cell_path,
            quality=95,
        )

        cell_output = (
            final_dir
            / cell_id
        )

        cell_output.mkdir(
            parents=True,
            exist_ok=True,
        )

        # ----------------------------------------------------
        # Process cell
        # ----------------------------------------------------

        try:

            cell_result = process_cell(
                cell_image=cell_path,
                cell_id=cell_id,
                cell_bbox=cell_bbox,
                cell_confidence=confidence,
                cell_output=cell_output,
            )

            cells.append(
                cell_result
            )

        except Exception as error:

            print(
                f"  ERROR in {cell_id}: "
                f"{error}"
            )

            cells.append(
                {
                    "cell_id":
                        cell_id,

                    "bbox":
                        cell_bbox,

                    "detection_confidence":
                        confidence,

                    "num_lines":
                        0,

                    "lines":
                        [],

                    "text":
                        "",

                    "status":
                        "error",

                    "error":
                        str(error),
                }
            )

    # ========================================================
    # FINAL JSON
    # ========================================================

    output = {
        "pipeline_version":
            "1.0",

        "image":
            image_path.name,

        "image_path":
            str(image_path),

        "status":
            "success",

        "num_cells":
            len(cells),

        "cells":
            cells,
    }

    output_json = (
        final_dir
        / "results.json"
    )

    with open(
        output_json,
        "w",
        encoding="utf-8",
    ) as file:

        json.dump(
            output,
            file,
            ensure_ascii=False,
            indent=2,
        )

    # ========================================================
    # SUMMARY
    # ========================================================

    successful_cells = sum(
        1
        for cell in cells
        if cell["status"] == "success"
    )

    failed_cells = (
        len(cells)
        - successful_cells
    )

    print()
    print("=" * 70)
    print("PIPELINE COMPLETE")
    print("=" * 70)

    print(
        f"Image: {image_path.name}"
    )

    print(
        f"Cells detected: {len(cells)}"
    )

    print(
        f"Successful: {successful_cells}"
    )

    print(
        f"Failed: {failed_cells}"
    )

    print(
        f"\nFINAL JSON:\n{output_json}"
    )

    return output_json


# ============================================================
# BATCH PROCESSING
# ============================================================

def process_all_images():
    """
    Process every image in data/raw.

    Existing successful results are skipped.
    Failed results are retried.
    """

    raw_dir = PROJECT_ROOT / "data" / "raw"

    image_paths = sorted(
        raw_dir.glob("img*.jpg"),
        key=lambda p: int(
            re.search(r"(\d+)", p.stem).group(1)
        )
    )

    if not image_paths:
        raise FileNotFoundError(
            f"No img*.jpg files found in {raw_dir}"
        )

    print()
    print("=" * 70)
    print("BATCH PROCESSING")
    print("=" * 70)
    print(f"Images found: {len(image_paths)}")

    summary = []

    for index, image_path in enumerate(
        image_paths,
        start=1,
    ):

        image_name = image_path.stem

        result_json = (
            OUTPUT_ROOT
            / image_name
            / "results.json"
        )

        print()
        print("=" * 70)
        print(
            f"[{index}/{len(image_paths)}] "
            f"{image_name}.jpg"
        )
        print("=" * 70)

        # ----------------------------------------------------
        # Skip already completed images
        # ----------------------------------------------------

        if result_json.exists():

            print(
                "Already processed — skipping."
            )

            try:
                with open(
                    result_json,
                    "r",
                    encoding="utf-8",
                ) as f:
                    data = json.load(f)

                cells = data.get(
                    "cells",
                    [],
                )

                successful = sum(
                    c.get("status") == "success"
                    for c in cells
                )

                nonempty = sum(
                    bool(
                        c.get(
                            "text",
                            "",
                        ).strip()
                    )
                    for c in cells
                )

                summary.append(
                    {
                        "image": image_path.name,
                        "status": "skipped_existing",
                        "cells": len(cells),
                        "successful_cells": successful,
                        "nonempty_cells": nonempty,
                        "result": str(
                            result_json.relative_to(
                                PROJECT_ROOT
                            )
                        ),
                    }
                )

            except Exception as error:

                print(
                    f"Could not read existing result: "
                    f"{error}"
                )

                summary.append(
                    {
                        "image": image_path.name,
                        "status": "existing_result_error",
                        "cells": 0,
                        "successful_cells": 0,
                        "nonempty_cells": 0,
                        "result": str(
                            result_json.relative_to(
                                PROJECT_ROOT
                            )
                        ),
                    }
                )

            continue

        # ----------------------------------------------------
        # Process image
        # ----------------------------------------------------

        try:

            output_json = process_image(
                image_path
            )

            with open(
                output_json,
                "r",
                encoding="utf-8",
            ) as f:
                data = json.load(f)

            cells = data.get(
                "cells",
                [],
            )

            successful = sum(
                c.get("status") == "success"
                for c in cells
            )

            nonempty = sum(
                bool(
                    c.get(
                        "text",
                        "",
                    ).strip()
                )
                for c in cells
            )

            summary.append(
                {
                    "image": image_path.name,
                    "status": "success",
                    "cells": len(cells),
                    "successful_cells": successful,
                    "nonempty_cells": nonempty,
                    "result": str(
                        output_json.relative_to(
                            PROJECT_ROOT
                        )
                    ),
                }
            )

        except Exception as error:

            print(
                f"\nFAILED: {image_name}.jpg"
            )

            print(
                f"Error: {error}"
            )

            summary.append(
                {
                    "image": image_path.name,
                    "status": "failed",
                    "cells": 0,
                    "successful_cells": 0,
                    "nonempty_cells": 0,
                    "result": None,
                    "error": str(error),
                }
            )

    # ========================================================
    # SAVE BATCH SUMMARY
    # ========================================================

    OUTPUT_ROOT.mkdir(
        parents=True,
        exist_ok=True,
    )

    summary_json = (
        OUTPUT_ROOT
        / "batch_summary.json"
    )

    batch_output = {
        "pipeline_version": "1.0",
        "total_images": len(image_paths),
        "results": summary,
    }

    with open(
        summary_json,
        "w",
        encoding="utf-8",
    ) as f:

        json.dump(
            batch_output,
            f,
            ensure_ascii=False,
            indent=2,
        )

    # ========================================================
    # PRINT SUMMARY
    # ========================================================

    print()
    print("=" * 70)
    print("BATCH COMPLETE")
    print("=" * 70)

    for item in summary:

        print(
            f"{item['image']:12s} "
            f"status={item['status']:20s} "
            f"cells={item['cells']:3d} "
            f"nonempty={item['nonempty_cells']:3d}"
        )

    print()
    print(
        f"Batch summary:\n{summary_json}"
    )


# ============================================================
# COMMAND LINE
# ============================================================

def main():

    if len(sys.argv) != 2:

        print(
            "Usage:\n"
            "  Single image:\n"
            "    python src/pipeline.py "
            "data/raw/img3.jpg\n\n"
            "  All images:\n"
            "    python src/pipeline.py --all"
        )

        sys.exit(1)

    argument = sys.argv[1]

    if argument == "--all":

        process_all_images()

    else:

        process_image(
            Path(argument)
        )


if __name__ == "__main__":
    main()