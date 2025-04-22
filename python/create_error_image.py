import matplotlib.pyplot as plt
import os
import sys
from datetime import datetime

def create_error_image(error_message, output_dir='../public/images'):
    """Create an error image with the provided message"""
    # Set the full path for output directory
    root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    output_dir = os.path.join(root_dir, 'public', 'images')
    
    # Create output directory if it doesn't exist
    os.makedirs(output_dir, exist_ok=True)
    
    # Create a timestamp for the filename
    timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
    filename = f"error_{timestamp}.png"
    filepath = os.path.join(output_dir, filename)
    
    # Create the figure with the error message
    plt.figure(figsize=(8, 6))
    plt.text(0.5, 0.5, f"Error: {error_message}", ha='center', va='center', fontsize=12, wrap=True)
    plt.axis('off')
    
    # Save the figure
    plt.savefig(filepath)
    plt.close()
    
    # Return the web path to the image
    return f"/images/{filename}", f"Error: {error_message}"

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("/images/default_error.png")
        print("Error: No error message provided")
    else:
        error_message = sys.argv[1]
        image_path, description = create_error_image(error_message)
        print(image_path)
        print(description)
