const express = require("express");
const router = express.Router();
const multer = require('multer');
const PDFParser = require('pdf-parse');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
require('dotenv').config();
const { Resend } = require('resend'); // Import Resend

// Initialize Resend with your API key

router.use(express.json());
const resend = new Resend(process.env.RESEND_API_KEY); // Make sure to set this environment variable


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

    let externalrecipients = [];
    if (req.headers['x-email-recipients']) {
      try {
        // Parse the recipients from headers (expects a comma-separated list)
        const headerRecipients = req.headers['x-email-recipients'].split(',').map(email => email.trim());
        
        // If valid recipients are found, use them instead of the defaults
        if (headerRecipients.length > 0) {
          externalrecipients = headerRecipients;
        }
      } catch (error) {
        console.warn('Failed to parse recipients from headers, using defaults:', error.message);
      }
    }
    // Read the uploaded PDF file
    const dataBuffer = fs.readFileSync(req.file.path);
    
    // Parse the PDF content 
    const data = await PDFParser(dataBuffer);
    
    // Send to ChatGPT API for analysis
    try {
      const chatGptResponse = await sendToChatGPT(data.text);
      
      // New: Send the analysis via email with the PDF attachment
      try {
        const emailResponse = await sendAnalysisEmail(
          req.file.originalname,
          chatGptResponse,
          dataBuffer,  // Pass the PDF data buffer
          externalrecipients // Use the parsed recipients
        );
                
        // Return success response with summary and email status
        res.json({
          filename: req.file.originalname,
          filesize: req.file.size,
          summary: chatGptResponse,
          emailSent: true,
          emailId: emailResponse.id,
          message: 'PDF content has been analyzed and emailed with attachment'
        });
      } catch (emailError) {
        console.error('Error sending email:', emailError);
        // Still return the analysis even if email fails
        res.json({
          filename: req.file.originalname,
          filesize: req.file.size,
          summary: chatGptResponse,
          emailSent: false,
          emailError: emailError.message,
          message: 'PDF content has been analyzed but email sending failed'
        });
      }
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

// New function to send email using Resend
async function sendAnalysisEmail(filename, analysis, pdfBuffer, externalrecipients) {  
  try {
    const response = await resend.emails.send({
      from: 'PDF Analysis <info@aldb.mt>', // Use your own domain here
      to: ["shengelia1800@gmail.com", "charlot.caruana@aldb.mt", "clint.mallia@aldb.mt", "aldo.busuttil@aldb.mt"],
      subject: `Safety Document Analysis: ${filename}`,
      html: `
        <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              h1 { color: #2c3e50; }
              .analysis { 
                background-color: #f9f9f9; 
                padding: 15px; 
                border-left: 4px solid #3498db;
                margin: 20px 0;
              }
              .footer { font-size: 12px; color: #7f8c8d; margin-top: 30px; }
            </style>
          </head>
          <body>
            <div class="container">
              <h1>Safety Document Analysis</h1>
              <p>An analysis has been completed for the document: <strong>${filename}</strong></p>
              <p>Recipients should be: ${externalrecipients} </p>
              <h2>Recommended Improvements:</h2>
              <div class="analysis">
                ${analysis.replace(/\n/g, '<br>')}
              </div>
              
              <div class="footer">
                <p>This is an automated message sent by ALDB&Associates</p>
              </div>
            </div>
          </body>
        </html>
      `,
      attachments: [
        {
          filename: filename,
          content: pdfBuffer, // Buffer containing the PDF data
        },
      ],
    });
    
    return response;
  } catch (error) {
    console.error('Resend API Error:', error);
    throw new Error('Failed to send email: ' + error.message);
  }
}
module.exports = router;