import json
from pathlib import Path
from statistics import median


INPUT = Path("outputs/documents/pdf1/document_result.json")


def center(bbox):
    x1, y1, x2, y2 = bbox
    return (x1 + x2) / 2, (y1 + y2) / 2


def build_rows(cells, y_tolerance=70):
    """
    Group detected cells into horizontal table rows
    using their Y-center.
    """

    cells = sorted(
        cells,
        key=lambda c: center(c["bbox"])[1]
    )

    rows = []

    for cell in cells:
        _, yc = center(cell["bbox"])

        best_row = None
        best_distance = None

        for row in rows:
            distance = abs(yc - row["y_center"])

            if distance <= y_tolerance:
                if best_distance is None or distance < best_distance:
                    best_row = row
                    best_distance = distance

        if best_row is None:
            rows.append({
                "y_center": yc,
                "cells": [cell],
            })
        else:
            best_row["cells"].append(cell)

    # Sort cells inside each row from left -> right
    for row in rows:
        row["cells"].sort(
            key=lambda c: center(c["bbox"])[0]
        )

        # Recalculate row center
        row["y_center"] = median(
            center(c["bbox"])[1]
            for c in row["cells"]
        )

    rows.sort(key=lambda r: r["y_center"])

    return rows


def clean_text(text):
    return " ".join(
        text.replace("\n", " | ").split()
    )


def main():

    if not INPUT.exists():
        raise FileNotFoundError(INPUT)

    with INPUT.open("r", encoding="utf-8") as f:
        document = json.load(f)

    for page in document["pages"]:

        page_number = page["page_number"]
        cells = page["result"]["cells"]

        rows = build_rows(cells)

        print()
        print("=" * 120)
        print(f"PAGE {page_number}")
        print(f"Detected cells: {len(cells)}")
        print(f"Reconstructed rows: {len(rows)}")
        print("=" * 120)

        for row_index, row in enumerate(rows, start=1):

            print()
            print(
                f"ROW {row_index} "
                f"(y={row['y_center']:.1f}, "
                f"cells={len(row['cells'])})"
            )

            print("-" * 120)

            for column_index, cell in enumerate(
                row["cells"],
                start=1
            ):

                x1, y1, x2, y2 = cell["bbox"]
                xc, yc = center(cell["bbox"])

                print(
                    f"  [{column_index}] "
                    f"{cell['cell_id']:10} "
                    f"x={xc:7.1f} "
                    f"bbox={cell['bbox']} "
                    f"conf={cell['detection_confidence']:.3f}"
                )

                print(
                    f"      {clean_text(cell.get('text', ''))}"
                )


if __name__ == "__main__":
    main()
