const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');

const router = express.Router();

// Configure storage for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '..', 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir);
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({ storage });

router.post('/analyze', upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No image uploaded' });
  }

  const imagePath = req.file.path;
  const projectRoot = path.join(__dirname, '..', '..');
  const pythonScript = path.join(projectRoot, 'shapefinder.py');
  
  // Construct the path to the Python executable within the virtual environment
  const pythonExecutable = path.join(projectRoot, 'venv', 'bin', 'python');

  // Check if the Python script exists
  if (!fs.existsSync(pythonScript)) {
    console.error(`Python script not found at ${pythonScript}`);
    return res.status(500).json({ error: 'Shape analysis script not found' });
  }
  
  const command = `"${pythonExecutable}" "${pythonScript}" "${imagePath}"`;
  console.log(`Processing image: ${imagePath}`);
  console.log(`Python script path: ${pythonScript}`);
  console.log(`Running command: ${command}`);
  
  // Debug project structure
  console.log('Directory contents:');
  try {
    const files = fs.readdirSync(projectRoot);
    files.forEach(file => console.log(` - ${file}`));
  } catch (err) {
    console.error(`Error reading directory: ${err.message}`);
  }
  
  // Execute the Python script
  exec(command, (error, stdout, stderr) => {
    if (error) {
      console.error(`Error executing Python script: ${error}`);
      console.error(`Stderr: ${stderr}`);
      return res.status(500).json({ error: 'Failed to analyze image' });
    }
    
    console.log(`Python script output: "${stdout.trim()}"`);
    if (stderr) {
      console.log(`Python script stderr: ${stderr}`)
    }
    
    // Extract the shape name from stdout
    const shape = stdout.trim();
    let properties = '';
    
    // Generate properties based on shape
    switch (shape) {
      case 'Triangle':
        properties = 'Three sides, three angles that sum to 180°.';
        break;
      case 'Square':
        properties = 'Four equal sides, four 90° angles. A special type of rectangle.';
        break;
      case 'Rectangle':
        properties = 'Four sides with opposite sides equal, four 90° angles.';
        break;
      case 'Circle':
        properties = 'Perfectly round shape where all points are the same distance from the center.';
        break;
      case 'Pentagon':
        properties = 'Five sides, five angles that sum to 540°.';
        break;
      case 'Hexagon':
        properties = 'Six sides, six angles that sum to 720°.';
        break;
      default:
        properties = 'Shape properties not available.';
    }
    
    // Send the file URL for display
    const imageUrl = `/uploads/${path.basename(imagePath)}`;
    
    console.log(`Sending response with imageUrl: ${imageUrl}, shape: ${shape}`);
    
    // Return the result
    res.json({ 
      shape,
      properties,
      imageUrl
    });
  });
});

module.exports = router;
