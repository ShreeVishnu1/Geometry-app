const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { PythonShell } = require('python-shell');

// Set up storage for uploaded files
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    // --- CHANGE IS HERE ---
    // Always use the same filename to overwrite the previous image.
    // We keep the original extension (like .jpg or .png).
    const staticFilename = 'analysis_image' + path.extname(file.originalname);
    cb(null, staticFilename);
  }
});
const upload = multer({ storage });

// The analysis route
router.post('/analyze', upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).send('No image uploaded.');
  }

  // Use path.resolve to get the full, absolute path to the image
  const imagePath = path.resolve(req.file.path);
  
  const options = {
    scriptPath: path.join(__dirname, '../'), // Points to the 'backend' folder
    args: [imagePath]
  };

  PythonShell.run('shapefinder.py', options).then(results => {
    if (results && results[0]) {
      const analysisResult = JSON.parse(results[0]);
      
      // Construct the full URL for the image, including a timestamp to beat browser caching
      const imageUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}?v=${Date.now()}`;
      
      res.json({ ...analysisResult, imageUrl });
    } else {
      res.status(500).send('Failed to get a result from the shape analysis script.');
    }
  }).catch(err => {
    console.error('Python script error:', err);
    res.status(500).send('Error running shape analysis script.');
  });
});

module.exports = router;