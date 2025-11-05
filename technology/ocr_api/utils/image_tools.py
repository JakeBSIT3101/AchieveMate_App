from PIL import Image

def scale_image(image, scale_factor=2):
    new_size = (int(image.width * scale_factor), int(image.height * scale_factor))
    return image.resize(new_size, Image.LANCZOS)
