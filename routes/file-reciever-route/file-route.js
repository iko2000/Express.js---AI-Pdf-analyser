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
            content: 'You are a specialized health and safety consultant at ALDB&Associates who creates concise, actionable improvement recommendations from site inspection reports. Your output will be inserted directly into email templates, so skip all greetings, introductions, and closing formalities. Focus only on delivering clear observations and specific recommendations.'
          },
          {
            role: 'user',
            content: `Analyze this site inspection report and provide ONLY:
          
            1. A "Key Observations" section with 3-5 bullet points of critical findings (each observation should have a bold heading)
            2. An "Improvement Recommendations" section organized by each observation area, with 2-4 bullet points of specific, actionable recommendations under each category
            3. A single brief paragraph about follow-up availability
          
            Format using bold headers and bullet points for clarity.
            Do not make it obvius that it is written by AI, act like human have done this analyeses.
            Here is the inspection report:
            
            ${text}`
          }
        ],
        max_tokens: 800
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
      subject: `Site Inspection Report from ALDB&Associates`,
      html: `
        <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.5; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              h1 { color: #2c3e50; }
              .analysis {
                 background-color: #f9f9f9;
                 padding: 15px;
                 margin: 20px 0;
              }
              .image { max-width: 300px; height: auto; }
              .footer { font-size: 12px; color: #7f8c8d; margin-top: 30px; }
              .header { text-align: center; margin-bottom: 20px; }
              .header img { max-width: 100%; height: auto; }
              .signature { margin-top: 30px; border-top: 1px solid #ddd; padding-top: 20px; font-size: 12px; color: #666; }
              .signature p { margin: 5px 0; }
              .signature .bold { font-weight: bold; }
              .disclaimer { font-size: 10px; color: #999; margin-top: 15px; font-style: italic; }
            </style>
          </head>
          <body>
            <div class="container">
              <p>Please find attached the Health & Safety Inspection Report related to the ongoing project referenced above.</p>
              <p>This report has been prepared in line with the scope of services agreed upon with the commissioning client and reflects the site conditions as observed at the time of the inspection.</p>
              <p>Recipients should be: ${externalrecipients[0]} - PLEASE IGNORE THIS PART AS I AM TESTING IT.</p>
              <p>Below is a summary of key findings noted during the visit:</p>
              <div class="analysis">
              ${analysis.replace(/\n/g, '<br>').replace(/\*/g, '')}
              </div>
              <p>All stakeholders are strongly encouraged to review the full report to ensure appropriate follow-up and compliance.</p>
              <p>We take this opportunity to emphasise that maintaining a safe system of work is a collective responsibility.</p>
              <p>All parties involved in the project are expected to observe and uphold the applicable safety protocols, legal obligations, and best practices throughout the duration of the works.</p>
              <p>Thank you for your continued collaboration.</p>



              </p>
              <div class="signature">
                <p class="bold">ALDB Team</p>
                <p><span class="bold">E </span>info@aldb.mt</p>
                <p><span class="bold">M </span>+356 9900 3486 / (+356) 9972 7305</p>
                <p><span class="bold">T </span>+356 2099 9831</p>
                <p><span class="bold">A </span>Paul Walker, Court B, Office 1, Triq iz-Żnuber, Mosta MST 2223</p>
                
                <img src="https://express-js-ai-pdf-analyser.onrender.com/images/footer.png" alt="Signature" class="image" />
                
                <div class="disclaimer">
                  <p><strong>All information provided to ALDB & Associates Ltd is handled in strict compliance with GDPR regulations and other applicable data protection laws. Your data is securely stored and used solely for the purpose of fulfilling our contractual obligations.</strong> The content of this email is confidential and intended for the recipient specified in message only.
                  It is strictly forbidden to share any part of this message with any third party, without a written consent of the sender.
                  If you received this message by mistake, please reply to this message and follow with its deletion,
                  so that we can ensure such a mistake does not occur in the future. Consider the environment before printing this email.</p>
                </div>
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