from pathlib import Path
import cv2
import numpy as np


ROOT = Path.cwd()

INPUT_DIR = ROOT / "outputs" / "crops" / "img3"
OUTPUT_DIR = ROOT / "outputs" / "clean_cells"

OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


def remove_borders(gray):
    """Remove strong table borders without destroying handwriting."""

    h, w = gray.shape

    binary = cv2.threshold(
        gray, 0, 255,
        cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU
    )[1]

    # Long horizontal table lines
    hk = cv2.getStructuringElement(
        cv2.MORPH_RECT,
        (max(30, w // 3), 1)
    )

    horizontal = cv2.morphologyEx(
        binary,
        cv2.MORPH_OPEN,
        hk
    )

    # Long vertical table lines
    vk = cv2.getStructuringElement(
        cv2.MORPH_RECT,
        (1, max(30, h // 3))
    )

    vertical = cv2.morphologyEx(
        binary,
        cv2.MORPH_OPEN,
        vk
    )

    lines = cv2.bitwise_or(horizontal, vertical)

    # Remove only detected long lines
    cleaned = cv2.subtract(binary, lines)

    return 255 - cleaned


def crop_margin(image):
    """Remove a small margin where table borders usually remain."""

    h, w = image.shape

    mx = max(3, int(w * 0.04))
    my = max(3, int(h * 0.02))

    return image[
        my:h-my,
        mx:w-mx
    ]


def remove_small_noise(image):
    """Remove tiny isolated components."""

    binary = cv2.threshold(
        image, 0, 255,
        cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU
    )[1]

    num_labels, labels, stats, _ = cv2.connectedComponentsWithStats(
        binary,
        connectivity=8
    )

    cleaned = np.zeros_like(binary)

    for i in range(1, num_labels):

        x, y, w, h, area = stats[i]

        # Keep handwriting-sized components.
        # Reject only obvious tiny noise.
        if area >= 12 and (w >= 3 or h >= 6):
            cleaned[labels == i] = 255

    return 255 - cleaned


def process(path):

    gray = cv2.imread(str(path), cv2.IMREAD_GRAYSCALE)

    if gray is None:
        return None

    # 1. Remove long table lines
    image = remove_borders(gray)

    # 2. Remove edge remnants
    image = crop_margin(image)

    # 3. Remove tiny noise
    image = remove_small_noise(image)

    # 4. Final threshold
    image = cv2.threshold(
        image, 0, 255,
        cv2.THRESH_BINARY + cv2.THRESH_OTSU
    )[1]

    return image


def main():

    files = sorted(INPUT_DIR.glob("*.jpg"))

    print("=" * 60)
    print("CELL CLEANING")
    print("=" * 60)
    print("INPUT:", INPUT_DIR)
    print("CELLS:", len(files))
    print()

    for path in files:

        cleaned = process(path)

        if cleaned is None:
            print("FAILED:", path.name)
            continue

        out = OUTPUT_DIR / path.name
        cv2.imwrite(str(out), cleaned)

        print("OK:", path.name)

    print()
    print("=" * 60)
    print("COMPLETE")
    print("OUTPUT:", OUTPUT_DIR)
    print("=" * 60)


if __name__ == "__main__":
    main()
