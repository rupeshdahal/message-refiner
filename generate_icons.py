#!/usr/bin/env python3
"""Generate simple PNG icons for the Chrome extension."""

import struct
import zlib
import os

def create_png(width, height, color_func):
    """Create a minimal PNG image."""
    
    def make_chunk(chunk_type, data):
        chunk = chunk_type + data
        crc = struct.pack('>I', zlib.crc32(chunk) & 0xFFFFFFFF)
        return struct.pack('>I', len(data)) + chunk + crc

    # PNG signature
    signature = b'\x89PNG\r\n\x1a\n'

    # IHDR chunk
    ihdr_data = struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0)  # 8-bit RGBA
    ihdr = make_chunk(b'IHDR', ihdr_data)

    # IDAT chunk - pixel data
    raw_data = b''
    cx, cy = width / 2, height / 2
    for y in range(height):
        raw_data += b'\x00'  # filter byte
        for x in range(width):
            r, g, b, a = color_func(x, y, width, height, cx, cy)
            raw_data += struct.pack('BBBB', r, g, b, a)

    compressed = zlib.compress(raw_data, 9)
    idat = make_chunk(b'IDAT', compressed)

    # IEND chunk
    iend = make_chunk(b'IEND', b'')

    return signature + ihdr + idat + iend


def icon_color(x, y, w, h, cx, cy):
    """Generate a sparkle icon on a green circle."""
    import math

    # Distance from center
    dx = x - cx
    dy = y - cy
    dist = math.sqrt(dx * dx + dy * dy)
    radius = min(w, h) / 2 - 1

    if dist > radius:
        return (0, 0, 0, 0)  # transparent

    # Green background (#00a884)
    bg_r, bg_g, bg_b = 0, 168, 132

    # Anti-aliasing at edge
    alpha = 255
    if dist > radius - 1.5:
        alpha = int(max(0, min(255, (radius - dist) / 1.5 * 255)))

    # Draw a simple 4-pointed star in white
    star_size = radius * 0.45
    nx = abs(dx) / star_size if star_size > 0 else 1
    ny = abs(dy) / star_size if star_size > 0 else 1

    # Star shape using the formula: |x|^0.6 + |y|^0.6 <= 1
    star_val = 1.0
    if star_size > 0:
        try:
            star_val = nx ** 0.6 + ny ** 0.6
        except:
            star_val = 1.0

    if star_val < 0.85:
        # White star center
        return (255, 255, 255, alpha)
    elif star_val < 1.0:
        # Anti-aliased star edge
        blend = (1.0 - star_val) / 0.15
        r = int(255 * blend + bg_r * (1 - blend))
        g = int(255 * blend + bg_g * (1 - blend))
        b = int(255 * blend + bg_b * (1 - blend))
        return (r, g, b, alpha)
    else:
        return (bg_r, bg_g, bg_b, alpha)


def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    icons_dir = os.path.join(script_dir, 'icons')
    os.makedirs(icons_dir, exist_ok=True)

    for size in [16, 48, 128]:
        png_data = create_png(size, size, icon_color)
        path = os.path.join(icons_dir, f'icon{size}.png')
        with open(path, 'wb') as f:
            f.write(png_data)
        print(f'Created {path} ({len(png_data)} bytes)')


if __name__ == '__main__':
    main()
