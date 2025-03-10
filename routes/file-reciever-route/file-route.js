const express = require("express");
const router = express.Router();
const multer = require('multer');
const PDFParser = require('pdf-parse');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

router.use(express.json());

router.get("/", (req, res) => {
  res.json("Hello from file route.")
});

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
  }
});

// Create uploads directory if it doesn't exist
if (!fs.existsSync('uploads/')) {
  fs.mkdirSync('uploads/');
}

// File filter to only accept PDF files
const fileFilter = (req, file, cb) => {
  if (file.mimetype === 'application/pdf') {
    cb(null, true);
  } else {
    cb(new Error('Only PDF files are allowed'), false);
  }
};

const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Route for PDF upload and reading
router.post('/', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No PDF file uploaded' });
    }
    
    // Read the uploaded PDF file
    const dataBuffer = fs.readFileSync(req.file.path);
    
    // Parse the PDF content 
    const data = await PDFParser(dataBuffer);
    
    // Send to ChatGPT API for analysis
    try {
      const chatGptResponse = await sendToChatGPT(data.text);
      
      // Return success response with summary
      res.json({
        filename: req.file.originalname,
        filesize: req.file.size,
        summary: chatGptResponse,
        message: 'PDF content has been analyzed'
      });
    } catch (apiError) {
      console.error('Error calling ChatGPT API:', apiError);
      res.status(500).json({ 
        error: 'Failed to analyze PDF with ChatGPT', 
        details: apiError.message,
        filename: req.file.originalname,
        filesize: req.file.size
      });
    }
    
    // Clean up - delete the file after processing
    fs.unlinkSync(req.file.path);
    
  } catch (error) {
    console.error('Error reading PDF:', error);
    res.status(500).json({ error: 'Failed to read PDF file', details: error.message });
  }
});

// Function to send text to ChatGPT API
async function sendToChatGPT(text) {
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY; // Make sure to set this environment variable
  
  if (!OPENAI_API_KEY) {
    throw new Error('OpenAI API key is not configured');
  }
  
  try {
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4', // or 'gpt-3.5-turbo' based on your preference and needs
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant that analyzes health/safety documents.'
          },
          {
            role: 'user',
            content: `Analyze this document and give me a what can be done to improve situation on site: \n\n${text}`
          }
        ],
        max_tokens: 500
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENAI_API_KEY}`
        }
      }
    );
    
    return response.data.choices[0].message.content;
  } catch (error) {
    console.error('ChatGPT API Error:', error.response?.data || error.message);
    throw new Error('Failed to get analysis from ChatGPT: ' + (error.response?.data?.error?.message || error.message));
  }
}

module.exports = router;