import cv2
import numpy as np

def detect_shape(contour):
    peri = cv2.arcLength(contour, True)
    approx = cv2.approxPolyDP(contour, 0.04 * peri, True)
    
    if len(approx) == 3:
        return "Triangle"
    elif len(approx) == 4:
        (x, y, w, h) = cv2.boundingRect(approx)
        ar = w / float(h)
        if 0.95 <= ar <= 1.05:
            return "Square"
        else:
            return "Rectangle"
    elif len(approx) == 5:
        return "Pentagon"
    elif len(approx) == 6:
        return "Hexagon"  # or "Unknown"
    else:
        # check circularity for smooth shapes
        area = cv2.contourArea(contour)
        if peri == 0:
            return "Unknown"
        circularity = 4 * np.pi * (area / (peri * peri))
        if circularity > 0.8:
            return "Circle"
        else:
            return "Unknown"


def main():
    import sys
    
    # Check if image path is provided as command line argument
    if len(sys.argv) > 1:
        image_path = sys.argv[1]
    else:
        # Fallback to input if no command line argument
        image_path = input("ENTER THE PATH:")
    
    # Print debugging info
    print(f"Attempting to read image: {image_path}", file=sys.stderr)
    
    try:
        image = cv2.imread(image_path)
        if image is None:
            print("Unknown", file=sys.stdout)  # Default output for API
            print(f"Error: Image could not be read: {image_path}", file=sys.stderr)
            return
    except Exception as e:
        print("Unknown", file=sys.stdout)  # Default output for API
        print(f"Error processing image: {str(e)}", file=sys.stderr)
        return

    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    _, thresh = cv2.threshold(blurred, 60, 255, cv2.THRESH_BINARY_INV)

    # Find contours
    contours, _ = cv2.findContours(thresh.copy(), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    for contour in contours:
        if cv2.contourArea(contour) < 100:
            continue  # skip small contours
        shape = detect_shape(contour)

        # Draw contour and shape name
        M = cv2.moments(contour)
        if M["m00"] != 0:
            cX = int(M["m10"] / M["m00"])
            cY = int(M["m01"] / M["m00"])
        else:
            cX, cY = 0, 0

        cv2.drawContours(image, [contour], -1, (0, 255, 0), 2)
        cv2.putText(image, shape, (cX - 50, cY),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 0, 0), 2)

    # Print the shape name (for API usage)
    if len(contours) > 0:
        # Use the first significant shape detected
        largest_contour = max(contours, key=cv2.contourArea)
        shape = detect_shape(largest_contour)
        print(shape)
    else:
        print("Unknown")
    
    # Show the output image if not being called from API
    import sys
    if len(sys.argv) <= 1:
        cv2.imshow("Detected Shapes", image)
        cv2.waitKey(0)
        cv2.destroyAllWindows()     

if __name__ == "__main__":
    main()
