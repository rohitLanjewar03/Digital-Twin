/**
 * This script generates PNG icons of different sizes from the SVG icon
 * To use:
 * 1. Install Node.js
 * 2. npm install sharp
 * 3. node generate_icons.js
 */

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

// Define the sizes needed
const sizes = [16, 48, 128];

// Input SVG file
const svgFile = path.join(__dirname, 'images', 'icon.svg');

// Generate PNG files for each size
async function generateIcons() {
  try {
    // Ensure the SVG file exists
    if (!fs.existsSync(svgFile)) {
      console.error('SVG file not found:', svgFile);
      return;
    }
    
    // Read the SVG file
    const svgBuffer = fs.readFileSync(svgFile);
    
    // Generate each size
    for (const size of sizes) {
      const outputFile = path.join(__dirname, 'images', `icon${size}.png`);
      
      await sharp(svgBuffer)
        .resize(size, size)
        .png()
        .toFile(outputFile);
      
      console.log(`Created icon: ${outputFile}`);
    }
    
    console.log('All icons generated successfully!');
  } catch (error) {
    console.error('Error generating icons:', error);
  }
}

generateIcons(); 