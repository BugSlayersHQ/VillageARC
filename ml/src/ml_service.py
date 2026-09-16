from pathlib import Path
import json
import uuid
import shutil

import fitz
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.responses import JSONResponse

from src.pipeline import process_image
from src.document_pipeline import process_pdf
from src.record_reconstructor import reconstruct_document
from src.field_extractor import extract_location_from_text


# ============================================================
# CONFIG
# ============================================================

PROJECT_ROOT = Path(__file__).resolve().parents[1]
UPLOAD_DIR = PROJECT_ROOT / "outputs" / "api_uploads"

UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

app = FastAPI(
    title="Land Record AI ML Service",
    version="1.0.0",
)


# ============================================================
# HELPERS
# ============================================================

def extract_pdf_text(pdf_path: Path) -> str:
    """Extract printed/selectable text from the PDF."""
    text_parts = []

    document = fitz.open(pdf_path)

    try:
        for page in document:
            text_parts.append(page.get_text())
    finally:
        document.close()

    return "\n".join(text_parts)


def build_final_data(
    document_result: dict,
    pdf_text: str,
    filename: str,
) -> dict:
    """
    Convert reconstructed document records into the
    final backend/frontend JSON contract.
    """

    # --------------------------------------------------------
    # 1. Reconstruct table using existing geometry logic
    # --------------------------------------------------------

    reconstructed = reconstruct_document(document_result)

    # --------------------------------------------------------
    # 2. Extract location from printed PDF text
    # --------------------------------------------------------

    location = extract_location_from_text(pdf_text)

    current_location = location.get(
        "current_location",
        {
            "district": None,
            "tehsil": None,
            "village": None,
        },
    )

    record_location = location.get(
        "record_location",
        {
            "district": None,
            "tehsil": None,
            "village": None,
        },
    )

    # --------------------------------------------------------
    # 3. Convert reconstructed rows
    # --------------------------------------------------------

    land_records = []

    for index, record in enumerate(
        reconstructed.get("land_records", []),
        start=1,
    ):

        owner_text = record.get("landowner_details")
        related_owner = record.get("related_owner_details")

        # ----------------------------------------------------
        # Keep unreliable numeric fields NULL.
        # We never invent OCR values.
        # ----------------------------------------------------

        plot_area = {
            "value": None,
            "unit": None,
        }

        land_classification = None

        # ----------------------------------------------------
        # Ownership details
        # ----------------------------------------------------

        ownership_details = []

        if related_owner:
            ownership_details.append({
                "type": "related_owner",
                "details": related_owner,
            })

        # ----------------------------------------------------
        # Crop details
        # ----------------------------------------------------

        crop_details = {
            "crop_name": record.get("crop_name"),
            "crop_area": record.get("crop_area"),
        }

        # ----------------------------------------------------
        # Final land record
        # ----------------------------------------------------

        land_records.append({
            "record_id": index,

            "serial_number": record.get(
                "serial_number"
            ),

            "landowner_details": (
                [{
                    "name": owner_text,
                    "father_name": None,
                    "address": None,
                }]
                if owner_text
                else []
            ),

            "survey_number": None,
            "khasra_number": None,
            "khata_number": None,

            "plot_area": plot_area,

            "land_classification": (
                land_classification
            ),

            "ownership_details": ownership_details,

            "crop_details": crop_details,
        })

    # --------------------------------------------------------
    # 4. FINAL API CONTRACT
    # --------------------------------------------------------

    return {
        "document": {
            "filename": filename,
            "page_count": len(
                document_result.get("pages", [])
            ),
        },

        "current_location": current_location,

        "record_location": record_location,

        "land_records": land_records,

        "mutation_records": [],

        "registration_information": [],
    }
# ============================================================
# HEALTH
# ============================================================

@app.get("/health")
def health():
    return {
        "success": True,
        "service": "land-record-ml",
        "status": "ok",
    }


# ============================================================
# PREDICT
# ============================================================

@app.post("/predict")
async def predict(file: UploadFile = File(...)):

    if not file.filename:
        raise HTTPException(
            status_code=400,
            detail="No file provided",
        )

    suffix = Path(file.filename).suffix.lower()

    if suffix not in {".pdf", ".jpg", ".jpeg", ".png"}:
        raise HTTPException(
            status_code=400,
            detail="Supported files: PDF, JPG, JPEG, PNG",
        )

    request_id = str(uuid.uuid4())

    upload_path = (
        UPLOAD_DIR
        / f"{request_id}{suffix}"
    )

    try:

        # ----------------------------------------------------
        # Save uploaded file
        # ----------------------------------------------------

        with upload_path.open("wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        print()
        print("=" * 70)
        print("ML REQUEST")
        print("=" * 70)
        print("Request ID:", request_id)
        print("Filename:", file.filename)
        print("Type:", suffix)

        # ----------------------------------------------------
        # PDF PIPELINE
        # ----------------------------------------------------

        if suffix == ".pdf":

            print("Running COMPLETE PDF pipeline...")

            document_result = process_pdf(
                upload_path
            )

            pdf_text = extract_pdf_text(
                upload_path
            )

            final_data = build_final_data(
                document_result,
                pdf_text,
                file.filename,
            )
        # ----------------------------------------------------
        # IMAGE PIPELINE
        # ----------------------------------------------------

        else:

            print("Running image pipeline...")

            result_path = process_image(
                upload_path
            )

            result_path = Path(result_path)

            if not result_path.exists():
                raise RuntimeError(
                    f"Pipeline result not found: {result_path}"
                )

            with result_path.open(
                "r",
                encoding="utf-8",
            ) as f:
                image_result = json.load(f)

            final_data = image_result

        # ----------------------------------------------------
        # FINAL RESPONSE
        # ----------------------------------------------------

        response = {
            "success": True,
            "request_id": request_id,
            "data": final_data,
        }

        print()
        print("=" * 70)
        print("ML REQUEST COMPLETE")
        print("=" * 70)

        return JSONResponse(
            content=response
        )

    except Exception as exc:

        print()
        print("=" * 70)
        print("ML REQUEST FAILED")
        print("=" * 70)
        print(type(exc).__name__, str(exc))

        raise HTTPException(
            status_code=500,
            detail=str(exc),
        )

    finally:

        # Remove uploaded temporary file.
        if upload_path.exists():
            upload_path.unlink()


# ============================================================
# LOCAL ENTRYPOINT
# ============================================================

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "src.ml_service:app",
        host="0.0.0.0",
        port=8001,
        reload=False,
    )
