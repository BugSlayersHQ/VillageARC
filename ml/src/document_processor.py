from pathlib import Path
import fitz


def pdf_to_images(pdf_path: Path, output_dir: Path) -> list[Path]:
    """
    Convert every page of a PDF into a high-resolution JPG.

    Returns:
        List of generated page image paths in page order.
    """

    if not pdf_path.exists():
        raise FileNotFoundError(f"PDF not found: {pdf_path}")

    output_dir.mkdir(parents=True, exist_ok=True)

    document = fitz.open(pdf_path)
    image_paths = []

    try:
        for page_number, page in enumerate(document, start=1):
            output_path = output_dir / f"page_{page_number:03d}.jpg"

            # 2x rendering gives the handwriting/printed text
            # enough resolution for the existing YOLO + Surya pipeline.
            matrix = fitz.Matrix(2.0, 2.0)
            pixmap = page.get_pixmap(
                matrix=matrix,
                alpha=False,
            )

            pixmap.save(str(output_path))
            image_paths.append(output_path)

    finally:
        document.close()

    return image_paths
    