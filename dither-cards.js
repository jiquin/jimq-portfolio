/**
 * Project Card Image Dithering
 * Applies Sierra dithering to project card thumbnails with hover crossfade effect
 */

class SierraDithering {
    constructor(colorLevels = 2) {
        this.colorLevels = colorLevels;
        // Sierra dithering matrix (error distribution)
        this.matrix = [
            [0, 0, 5/32, 3/32],
            [2/32, 4/32, 5/32, 4/32, 2/32],
            [0, 2/32, 3/32, 2/32, 0]
        ];
    }

    process(imageData) {
        const width = imageData.width;
        const height = imageData.height;
        const data = imageData.data;

        // Create a working copy for grayscale values
        const grayscale = new Float32Array(width * height);

        // Convert to grayscale first
        for (let i = 0; i < width * height; i++) {
            const idx = i * 4;
            // Calculate luminance (perceptual brightness)
            const gray = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
            grayscale[i] = gray;
        }

        // Process each pixel with dithering
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const i = y * width + x;
                const idx = i * 4;

                const oldPixel = grayscale[i];
                // Lower threshold = fewer black dots (only darkest areas)
                const newPixel = oldPixel < 60 ? 0 : 255;
                const error = oldPixel - newPixel;

                // Set pixel to black or transparent
                if (newPixel === 0) {
                    // Black pixel
                    data[idx] = 0;
                    data[idx + 1] = 0;
                    data[idx + 2] = 0;
                    data[idx + 3] = 255;
                } else {
                    // Transparent pixel
                    data[idx] = 0;
                    data[idx + 1] = 0;
                    data[idx + 2] = 0;
                    data[idx + 3] = 0;
                }

                // Distribute error to neighboring pixels
                this.distributeErrorGrayscale(grayscale, x, y, width, height, error);
            }
        }

        return imageData;
    }

    distributeErrorGrayscale(grayscale, x, y, width, height, error) {
        // Row 0: current row, pixels to the right
        if (x + 2 < width) {
            grayscale[y * width + (x + 2)] += error * this.matrix[0][2];
        }
        if (x + 3 < width) {
            grayscale[y * width + (x + 3)] += error * this.matrix[0][3];
        }

        // Row 1: next row
        if (y + 1 < height) {
            if (x - 2 >= 0) {
                grayscale[(y + 1) * width + (x - 2)] += error * this.matrix[1][0];
            }
            if (x - 1 >= 0) {
                grayscale[(y + 1) * width + (x - 1)] += error * this.matrix[1][1];
            }
            grayscale[(y + 1) * width + x] += error * this.matrix[1][2];
            if (x + 1 < width) {
                grayscale[(y + 1) * width + (x + 1)] += error * this.matrix[1][3];
            }
            if (x + 2 < width) {
                grayscale[(y + 1) * width + (x + 2)] += error * this.matrix[1][4];
            }
        }

        // Row 2: two rows down
        if (y + 2 < height) {
            if (x - 1 >= 0) {
                grayscale[(y + 2) * width + (x - 1)] += error * this.matrix[2][1];
            }
            grayscale[(y + 2) * width + x] += error * this.matrix[2][2];
            if (x + 1 < width) {
                grayscale[(y + 2) * width + (x + 1)] += error * this.matrix[2][3];
            }
        }
    }

}

class ProjectCardDithering {
    constructor() {
        console.log('🎨 Initializing ProjectCardDithering...');
        this.dithering = new SierraDithering(2); // Black and white only
        this.processedCards = new Map();
        this.init();
    }

    init() {
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.processAllCards());
        } else {
            this.processAllCards();
        }
    }

    processAllCards() {
        const cards = document.querySelectorAll('.project-card');
        console.log(`📦 Found ${cards.length} project cards`);

        cards.forEach((card, index) => {
            const img = card.querySelector('.project-card-image');
            if (img) {
                console.log(`📷 Card ${index + 1}: Image found, src="${img.src}", complete=${img.complete}`);
                // Wait for image to load before processing
                if (img.complete) {
                    this.processCard(card, img, index);
                } else {
                    console.log(`⏳ Card ${index + 1}: Waiting for image to load...`);
                    img.addEventListener('load', () => this.processCard(card, img, index));
                }
            } else {
                console.warn(`❌ Card ${index + 1}: No image found`);
            }
        });
    }

    processCard(card, originalImg, index) {
        try {
            // Create canvas for processing
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            // Get original image dimensions
            const originalWidth = originalImg.naturalWidth || originalImg.width;
            const originalHeight = originalImg.naturalHeight || originalImg.height;

            if (originalWidth === 0 || originalHeight === 0) {
                console.warn('Image has no dimensions:', originalImg.src);
                return;
            }

            // Use full resolution for finer detail
            const width = originalWidth;
            const height = originalHeight;

            canvas.width = width;
            canvas.height = height;

            // Draw original image to canvas
            try {
                ctx.drawImage(originalImg, 0, 0, width, height);
            } catch (e) {
                console.error('CORS error - cannot process image:', originalImg.src);
                console.error('Tip: Images must be from same origin or have CORS headers enabled');
                return;
            }

            // Get image data
            let imageData;
            try {
                imageData = ctx.getImageData(0, 0, width, height);
            } catch (e) {
                console.error('Cannot get image data (CORS issue):', originalImg.src);
                return;
            }

            // Apply dithering
            const ditheredData = this.dithering.process(imageData);
            ctx.putImageData(ditheredData, 0, 0);

            // Convert canvas to data URL
            const ditheredSrc = canvas.toDataURL('image/png');

            // Store original source
            const originalSrc = originalImg.src;

            // Create wrapper for crossfade effect
            this.setupCrossfade(card, originalImg, originalSrc, ditheredSrc);

            console.log(`✓ Processed card ${index + 1}`);
        } catch (error) {
            console.error('Error processing card:', error);
        }
    }

    setupCrossfade(card, img, originalSrc, ditheredSrc) {
        // Create wrapper container
        const wrapper = document.createElement('div');
        wrapper.className = 'card-image-wrapper';

        // Create dithered image
        const ditheredImg = document.createElement('img');
        ditheredImg.className = 'project-card-image project-card-image-dithered';
        ditheredImg.src = ditheredSrc;
        ditheredImg.alt = img.alt;

        // Create original image
        const originalImage = document.createElement('img');
        originalImage.className = 'project-card-image project-card-image-original';
        originalImage.src = originalSrc;
        originalImage.alt = img.alt;

        // Add both images to wrapper
        wrapper.appendChild(ditheredImg);
        wrapper.appendChild(originalImage);

        // Replace original image with wrapper
        img.parentNode.replaceChild(wrapper, img);

        // Store reference
        this.processedCards.set(card, {
            wrapper,
            original: originalImage,
            dithered: ditheredImg
        });
    }
}

// Initialize when script loads
const cardDithering = new ProjectCardDithering();
