from pathlib import Path
import json
import subprocess
import sys

from src.document_processor import pdf_to_images


PROJECT_ROOT = Path(__file__).resolve().parents[1]

PDF_OUTPUT_DIR = PROJECT_ROOT / "outputs" / "pdf_pages"
FINAL_OUTPUT_DIR = PROJECT_ROOT / "outputs" / "documents"


def run_page_pipeline(image_path: Path) -> dict:
    """
    Run the existing YOLO + Surya pipeline on one page.
    """

    print(f"\n{'=' * 70}")
    print(f"PROCESSING PAGE: {image_path.name}")
    print(f"{'=' * 70}")

    command = [
        sys.executable,
        str(PROJECT_ROOT / "src" / "pipeline.py"),
        str(image_path),
    ]

    result = subprocess.run(
        command,
        cwd=PROJECT_ROOT,
        text=True,
    )

    if result.returncode != 0:
        raise RuntimeError(
            f"Pipeline failed for {image_path.name}"
        )

    result_path = (
        PROJECT_ROOT
        / "outputs"
        / "final"
        / image_path.stem
        / "results.json"
    )

    if not result_path.exists():
        raise FileNotFoundError(
            f"Expected pipeline result not found: {result_path}"
        )

    with open(result_path, "r", encoding="utf-8") as f:
        return json.load(f)


def process_pdf(pdf_path: Path) -> dict:
    """
    Process a complete land-record PDF page by page.
    """

    if not pdf_path.exists():
        raise FileNotFoundError(f"PDF not found: {pdf_path}")

    document_name = pdf_path.stem

    page_output_dir = PDF_OUTPUT_DIR / document_name
    final_output_dir = FINAL_OUTPUT_DIR / document_name

    page_output_dir.mkdir(parents=True, exist_ok=True)
    final_output_dir.mkdir(parents=True, exist_ok=True)

    # ---------------------------------------------------------
    # 1. PDF → page images
    # ---------------------------------------------------------

    print("\nConverting PDF to page images...")

    pages = pdf_to_images(
        pdf_path,
        page_output_dir,
    )

    print(f"Pages extracted: {len(pages)}")

    # ---------------------------------------------------------
    # 2. Run existing ML pipeline on every page
    # ---------------------------------------------------------

    page_results = []

    for page_number, page_path in enumerate(pages, start=1):

        result = run_page_pipeline(page_path)

        page_results.append(
            {
                "page_number": page_number,
                "image": str(page_path.relative_to(PROJECT_ROOT)),
                "result": result,
            }
        )

    # ---------------------------------------------------------
    # 3. Create document-level result
    # ---------------------------------------------------------

    document_result = {
        "status": "success",
        "document": document_name,
        "pages": page_results,
    }

    output_path = final_output_dir / "document_result.json"

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(
            document_result,
            f,
            ensure_ascii=False,
            indent=2,
        )

    print("\n" + "=" * 70)
    print("DOCUMENT PIPELINE COMPLETE")
    print("=" * 70)
    print(f"Pages processed: {len(page_results)}")
    print(f"Final result: {output_path}")

    return document_result


if __name__ == "__main__":

    if len(sys.argv) != 2:
        print(
            "Usage:\n"
            "  python src/document_pipeline.py <file.pdf>"
        )
        sys.exit(1)

    pdf_path = Path(sys.argv[1]).resolve()

    process_pdf(pdf_path)