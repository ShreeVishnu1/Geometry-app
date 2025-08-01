// Import necessary packages
const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken'); // Correctly import the library
const path = require('path');
const fs = require('fs');
const multer = require('multer');

// --- CONFIGURATION ---
require('dotenv').config(); // Use this to load .env files
const app = express();
const PORT = process.env.PORT || 3001;
const MONGO_URI = process.env.MONGO_URI;
const JWT_SECRET = process.env.JWT_SECRET;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY; // For secure backend calls

// --- MIDDLEWARE ---
// **IMPORTANT**: Update this origin with your final frontend URL from Render
// In backend/server.js
const corsOptions = {
  origin: [
    'https://geometry-app-frontend.onrender.com', // For production
    'http://localhost:5173',                    // For local development
    'http://localhost:5174',                    // For local development (alternative port)
    'http://localhost:5175',                    // For local development (another alternative port)
    'http://localhost:5176',                    // For local development (yet another alternative port)
    'http://localhost:5177',                    // For local development (another port)
    'http://localhost:5178'                     // For local development (final alternative port)
  ],
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));
app.use(express.json());

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// --- DATABASE CONNECTION ---
let db;
async function connectToDb() {
  try {
    const client = new MongoClient(MONGO_URI);
    await client.connect();
    db = client.db("geometry-analyzer");
    console.log("Successfully connected to MongoDB.");
  } catch (error) {
    console.error("Failed to connect to MongoDB", error);
    process.exit(1);
  }
}

// --- AUTH MIDDLEWARE (FIXED) ---
const protect = (req, res, next) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, JWT_SECRET);
      req.userId = decoded.id; // Attach user ID to the request
      next();
    } catch (error) {
      return res.status(401).json({ message: 'Not authorized, token failed' });
    }
  }
  if (!token) {
    return res.status(401).json({ message: 'Not authorized, no token' });
  }
};

// --- API ROUTES ---

// Import routes
const shapesRouter = require('./routes/shapes');

// Health check route
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Server is running' });
});

// Use routes
app.use('/api/shapes', protect, shapesRouter);

// [POST] /api/auth/register
app.post('/api/auth/register', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required." });
  }
  const usersCollection = db.collection('users');
  const existingUser = await usersCollection.findOne({ email });
  if (existingUser) {
    return res.status(400).json({ message: "User with this email already exists." });
  }
  const hashedPassword = await bcrypt.hash(password, 10);
  const newUser = {
    email,
    password: hashedPassword,
    role: email.endsWith('@geometry.com') ? 'admin' : 'student',
    preAssessmentScore: null,
    finalAssessmentScore: null,
  };
  const result = await usersCollection.insertOne(newUser);
  const user = { ...newUser, _id: result.insertedId };

  // Create a real JWT
  const token = jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, { expiresIn: '1d' });

  res.status(201).json({ message: "User registered successfully", token, user });
});

// [POST] /api/auth/login
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await db.collection('users').findOne({ email });
  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(401).json({ message: "Invalid credentials." });
  }

  // Create a real JWT
  const token = jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, { expiresIn: '1d' });
  
  // Don't send the password back
  delete user.password;
  
  res.status(200).json({ message: "Login successful", token, user });
});

// [POST] /api/scores/pre - PROTECTED and FIXED
app.post('/api/scores/pre', protect, async (req, res) => {
  const userId = req.userId; // Get user ID from the verified token
  const { score } = req.body;
  await db.collection('users').updateOne(
    { _id: new ObjectId(userId) },
    { $set: { preAssessmentScore: score } }
  );
  res.status(200).json({ message: "Pre-assessment score updated." });
});

// [POST] /api/scores/final - PROTECTED and FIXED
app.post('/api/scores/final', protect, async (req, res) => {
  const userId = req.userId; // Get user ID from the verified token
  const { score } = req.body;
  await db.collection('users').updateOne(
    { _id: new ObjectId(userId) },
    { $set: { finalAssessmentScore: score } }
  );
  res.status(200).json({ message: "Final assessment score updated." });
});

// [GET] /api/admin/dashboard - PROTECTED
app.get('/api/admin/dashboard', protect, async (req, res) => {
  const students = await db.collection('users').find({ role: 'student' }).toArray();
  const preScores = students.map(s => s.preAssessmentScore).filter(s => s !== null);
  const postScores = students.map(s => s.finalAssessmentScore).filter(s => s !== null);
  const avgPre = preScores.length > 0 ? preScores.reduce((a, b) => a + b, 0) / preScores.length : 0;
  const avgPost = postScores.length > 0 ? postScores.reduce((a, b) => a + b, 0) / postScores.length : 0;
  const scoreDistribution = postScores.reduce((acc, score) => {
    acc[score] = (acc[score] || 0) + 1;
    return acc;
  }, {});
  res.status(200).json({ avgPre, avgPost, scoreDistribution });
});



// In backend/server.js
// [GET] /api/generate/content - SECURE GEMINI ROUTE
// app.get('/api/generate/content', protect, async (req, res) => {
//     try {
//         // This is the new, more reliable prompt with specific image URLs
//         const prompt = `
//             Explain basic geometric shapes for a 10-year-old student in India. Cover circle, square, and triangle.
//             For each shape:
//             1.  Start with an <h4> tag for the shape's name.
//             2.  Write a simple one-sentence description in a <p> tag.
//             3.  Provide two <img> tags wrapped in a div with class "flex gap-4 my-4".
//                 - Circle: Use 'https://images.pexels.com/photos/1618269/pexels-photo-1618269.jpeg?auto=compress&cs=tinysrgb&w=400' for the diagram and 'https://images.pexels.com/photos/14878572/pexels-photo-14878572.jpeg?auto=compress&cs=tinysrgb&w=400' for the real-world example (a chapati).
//                 - Square: Use 'https://images.pexels.com/photos/158826/structure-geometry-square-triangle-158826.jpeg?auto=compress&cs=tinysrgb&w=400' for the diagram and 'https://images.pexels.com/photos/163359/carom-game-carrom-board-game-of-skill-163359.jpeg?auto=compress&cs=tinysrgb&w=400' for the real-world example (a carrom board).
//                 - Triangle: Use 'https://images.pexels.com/photos/158827/background-triangle-geometrical-pattern-158827.jpeg?auto=compress&cs=tinysrgb&w=400' for the diagram and 'https://images.pexels.com/photos/2418493/pexels-photo-2418493.jpeg?auto=compress&cs=tinysrgb&w=400' for the real-world example (a samosa).
//             4.  Set the alt text for each image appropriately.
//             5.  Use a <ul> to list its main properties.
//         `;
        
//         const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_API_KEY}`;
        
//         const geminiResponse = await fetch(apiUrl, {
//             method: 'POST',
//             headers: { 'Content-Type': 'application/json' },
//             body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
//         });
//         const data = await geminiResponse.json();
//         res.status(200).json(data);
//     } catch (error) {
//         console.error("Gemini content generation failed:", error);
//         res.status(500).json({ message: "Failed to generate course content." });
//     }
// });

// [GET] /api/generate/assessment - SECURE GEMINI ROUTE
app.get('/api/generate/assessment', protect, async (req, res) => {
    try {
        const prompt = "Generate exactly 5 multiple-choice questions for a 10-year-old on identifying geometric shapes and their basic properties (like number of sides or corners).";

        // CORRECTED MODEL NAME HERE
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_API_KEY}`;

        const payload = {
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: "OBJECT",
                    properties: {
                        questions: {
                            type: "ARRAY",
                            items: {
                                type: "OBJECT",
                                properties: {
                                    question: { type: "STRING" },
                                    options: { type: "ARRAY", items: { type: "STRING" } },
                                    answer: { type: "STRING" }
                                },
                                required: ["question", "options", "answer"]
                            }
                        }
                    }
                }
            }
        };
        const geminiResponse = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await geminiResponse.json();
        res.status(200).json(data);
    } catch (error) {
        console.error("Gemini assessment generation failed:", error);
        res.status(500).json({ message: "Failed to generate assessment questions." });
    }
});

// --- START SERVER ---
connectToDb().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
});