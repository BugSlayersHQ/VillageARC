import cv2
import numpy as np
from pathlib import Path
import argparse


def order_points(points):
    points = np.array(points, dtype=np.float32)

    s = points.sum(axis=1)
    d = np.diff(points, axis=1).reshape(-1)

    top_left = points[np.argmin(s)]
    bottom_right = points[np.argmax(s)]
    top_right = points[np.argmin(d)]
    bottom_left = points[np.argmax(d)]

    return np.array(
        [top_left, top_right, bottom_right, bottom_left],
        dtype=np.float32
    )


def four_point_transform(image, points):

    rect = order_points(points)
    tl, tr, br, bl = rect

    width_a = np.linalg.norm(br - bl)
    width_b = np.linalg.norm(tr - tl)
    max_width = int(max(width_a, width_b))

    height_a = np.linalg.norm(tr - br)
    height_b = np.linalg.norm(tl - bl)
    max_height = int(max(height_a, height_b))

    dst = np.array([
        [0, 0],
        [max_width - 1, 0],
        [max_width - 1, max_height - 1],
        [0, max_height - 1]
    ], dtype=np.float32)

    matrix = cv2.getPerspectiveTransform(rect, dst)

    return cv2.warpPerspective(
        image,
        matrix,
        (max_width, max_height)
    )


def detect_page(image):

    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

    blur = cv2.GaussianBlur(gray, (5, 5), 0)

    edges = cv2.Canny(blur, 50, 150)

    contours, _ = cv2.findContours(
        edges,
        cv2.RETR_LIST,
        cv2.CHAIN_APPROX_SIMPLE
    )

    contours = sorted(
        contours,
        key=cv2.contourArea,
        reverse=True
    )

    image_area = image.shape[0] * image.shape[1]

    for contour in contours[:20]:

        area = cv2.contourArea(contour)

        if area < image_area * 0.20:
            continue

        perimeter = cv2.arcLength(contour, True)

        approx = cv2.approxPolyDP(
            contour,
            0.02 * perimeter,
            True
        )

        if len(approx) == 4:

            points = approx.reshape(4, 2)

            return points

    return None


def clean_page(image):

    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

    # Contrast enhancement
    clahe = cv2.createCLAHE(
        clipLimit=2.0,
        tileGridSize=(8, 8)
    )

    enhanced = clahe.apply(gray)

    # Adaptive threshold
    binary = cv2.adaptiveThreshold(
        enhanced,
        255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY,
        31,
        15
    )

    return enhanced, binary


def main():

    parser = argparse.ArgumentParser()

    parser.add_argument(
        "--input",
        required=True,
        help="Path to original document image"
    )

    parser.add_argument(
        "--output",
        default="outputs/preprocessed",
        help="Output directory"
    )

    args = parser.parse_args()

    input_path = Path(args.input)
    output_dir = Path(args.output)

    output_dir.mkdir(
        parents=True,
        exist_ok=True
    )

    image = cv2.imread(str(input_path))

    if image is None:
        raise FileNotFoundError(
            f"Could not read image: {input_path}"
        )

    print("INPUT:", input_path)
    print("ORIGINAL SIZE:", image.shape)

    # ------------------------------------------------
    # 1. Detect document/page
    # ------------------------------------------------

    page = detect_page(image)

    if page is not None:

        print("PAGE DETECTED: YES")

        corrected = four_point_transform(
            image,
            page
        )

    else:

        print("PAGE DETECTED: NO")
        print("Using original image.")

        corrected = image

    # ------------------------------------------------
    # 2. Clean / enhance
    # ------------------------------------------------

    enhanced, binary = clean_page(corrected)

    # ------------------------------------------------
    # 3. Save results
    # ------------------------------------------------

    cv2.imwrite(
        str(output_dir / "01_corrected.jpg"),
        corrected
    )

    cv2.imwrite(
        str(output_dir / "02_enhanced.jpg"),
        enhanced
    )

    cv2.imwrite(
        str(output_dir / "03_binary.jpg"),
        binary
    )

    print()
    print("=" * 60)
    print("PREPROCESSING COMPLETE")
    print("=" * 60)
    print("OUTPUT:", output_dir.resolve())
    print()
    print("01_corrected.jpg")
    print("02_enhanced.jpg")
    print("03_binary.jpg")
    print("=" * 60)


if __name__ == "__main__":
    main()
