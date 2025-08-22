// Test script to verify pixelmatch compatibility
const PNG = require('pngjs').PNG;
const pixelmatch = require('pixelmatch');

console.log('Testing pixelmatch version:', require('pixelmatch/package.json').version);

// Create two simple test images
const width = 10;
const height = 10;

// Create identical images
const img1 = new PNG({ width, height });
const img2 = new PNG({ width, height });

// Fill with same data (should have 0 difference)
for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    const idx = (width * y + x) << 2;
    img1.data[idx] = 255;     // red
    img1.data[idx + 1] = 0;   // green  
    img1.data[idx + 2] = 0;   // blue
    img1.data[idx + 3] = 255; // alpha

    img2.data[idx] = 255;     // red
    img2.data[idx + 1] = 0;   // green
    img2.data[idx + 2] = 0;   // blue
    img2.data[idx + 3] = 255; // alpha
  }
}

try {
  // Test the exact usage pattern from saveScreenshot.js
  const numDiffPixels = pixelmatch(
    img1.data,
    img2.data,
    null,
    width,
    height,
    { threshold: 0.0005 }
  );

  console.log('Test successful!');
  console.log('Different pixels:', numDiffPixels);
  console.log('Percentage diff:', (numDiffPixels / (width * height)) * 100);
  
  // Test with some difference
  img2.data[0] = 0; // Change first pixel to black
  const numDiffPixels2 = pixelmatch(
    img1.data,
    img2.data,
    null,
    width,
    height,
    { threshold: 0.0005 }
  );
  
  console.log('With difference - Different pixels:', numDiffPixels2);
  console.log('With difference - Percentage diff:', (numDiffPixels2 / (width * height)) * 100);
  
} catch (error) {
  console.error('Error testing pixelmatch:', error);
  process.exit(1);
}