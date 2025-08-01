import cv2
import numpy as np
import sys
import json

def get_shape_properties(shape):
    """Returns a descriptive string of properties for a given shape."""
    if shape == "Triangle":
        return "A triangle has 3 sides and 3 angles, and the sum of its angles is 180 degrees."
    elif shape == "Square":
        return "A square has 4 equal sides and 4 right angles (90 degrees)."
    elif shape == "Rectangle":
        return "A rectangle has 4 sides and 4 right angles. Opposite sides are equal in length."
    elif shape == "Pentagon":
        return "A pentagon is a polygon with 5 sides and 5 angles."
    elif shape == "Hexagon":
        return "A hexagon is a polygon with 6 sides and 6 angles."
    elif shape == "Circle":
        return "A circle is a perfectly round shape with no corners or edges. All points are equidistant from the center."
    else:
        return "The properties of this shape could not be determined."

def detect_shape(contour):
    """Detects the shape of a single contour."""
    shape = "Unknown"
    peri = cv2.arcLength(contour, True)
    approx = cv2.approxPolyDP(contour, 0.04 * peri, True)

    if len(approx) == 3:
        shape = "Triangle"
    elif len(approx) == 4:
        (x, y, w, h) = cv2.boundingRect(approx)
        ar = w / float(h)
        shape = "Square" if 0.95 <= ar <= 1.05 else "Rectangle"
    elif len(approx) == 5:
        shape = "Pentagon"
    elif len(approx) == 6:
        shape = "Hexagon"
    else:
        area = cv2.contourArea(contour)
        if peri > 0:
            circularity = 4 * np.pi * (area / (peri * peri))
            if circularity > 0.85:
                shape = "Circle"
    return shape

def main():
    """Main function to process the image and output JSON."""
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No image path provided."}))
        return

    image_path = sys.argv[1]
    image = cv2.imread(image_path)

    if image is None:
        print(json.dumps({"error": f"Could not read image at {image_path}"}))
        return

    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (7, 7), 0)
    
    # --- IMPROVEMENT IS HERE ---
    # Using Canny edge detection instead of simple thresholding
    edged = cv2.Canny(blurred, 50, 150)
    
    # Find contours in the edged image
    contours, _ = cv2.findContours(edged, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    if contours:
        largest_contour = max(contours, key=cv2.contourArea)
        if cv2.contourArea(largest_contour) > 100:
            shape_name = detect_shape(largest_contour)
            shape_properties = get_shape_properties(shape_name)
            
            output = {
                "shape": shape_name,
                "properties": shape_properties
            }
        else:
            output = {"shape": "Unknown", "properties": "No significant shape detected."}
    else:
        output = {"shape": "Unknown", "properties": "No shapes found in the image."}

    print(json.dumps(output))

if __name__ == "__main__":
    main()