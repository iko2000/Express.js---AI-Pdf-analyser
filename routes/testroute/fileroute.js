const express = require("express");
const router = express.Router();
const multer = require('multer');
const PDFParser = require('pdf-parse');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
require('dotenv').config();
const { Resend } = require('resend');
const supabase = require("../../db/db");

router.use(express.json());
const resend = new Resend(process.env.RESEND_API_KEY);

router.get("/", (req, res) => {
  res.json("Hello from file route.");
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

    // Get report number from headers
    const reportNum = req.headers['x-report-num'] || 'Unknown Report Number';
    console.log('Processing report number:', reportNum);
    
    // Parse email recipients if provided
    let externalRecipients = [];
    if (req.headers['x-email-recipients']) {
      try {
        // Parse the recipients from headers (expects a comma-separated list)
        const headerRecipients = req.headers['x-email-recipients'].split(',').map(email => email.trim());
        
        // If valid recipients are found, use them
        if (headerRecipients.length > 0) {
          externalRecipients = headerRecipients;
        }
      } catch (error) {
        console.warn('Failed to parse recipients from headers:', error.message);
      }
    }

    // Read the uploaded PDF file
    const dataBuffer = fs.readFileSync(req.file.path);
    
    // Process and extract text from the PDF
    let pdfText = '';
    try {
      const pdfData = await PDFParser(dataBuffer);
      pdfText = pdfData.text;
    } catch (pdfError) {
      console.error('Error parsing PDF:', pdfError);
      pdfText = 'Error extracting PDF text';
    }
    
    let supabaseFileUrl = null;
    
    // Upload to Supabase storage
    const fileExt = path.extname(req.file.originalname);
    const fileName = `report-${reportNum}-${Date.now()}${fileExt}`;
          
    // Upload file to Supabase storage
    const { data, error } = await supabase.storage
      .from('client-bucket')
      .upload(fileName, dataBuffer, {
        contentType: 'application/pdf',
        cacheControl: '3600',
        upsert: true // Override if file exists
      });
    
    if (error) {
      console.error('Upload error details:', error);
      throw error;
    }
    
    // Get the public URL of the uploaded file
    const { data: urlData } = supabase.storage
      .from('client-bucket')
      .getPublicUrl(fileName);
    
    supabaseFileUrl = urlData.publicUrl;
    console.log('File uploaded successfully, URL:', supabaseFileUrl);
    
    // Check if record exists first
    const { data: existingRecord, error: findError } = await supabase
      .from('inteligentdata')
      .select('*')
      .eq('reportNum', reportNum)
      .maybeSingle();
      
    if (findError) {
      console.error('Error finding record:', findError);
    }
    
    // Update or insert record in database
    let dbUpdateResult;
    if (existingRecord) {
      // Update existing record
      dbUpdateResult = await supabase
        .from('inteligentdata')
        .update({ url: supabaseFileUrl })
        .eq('reportNum', reportNum);
    } else {
      // Insert new record
      dbUpdateResult = await supabase
        .from('inteligentdata')
        .insert([{ reportNum: reportNum, url: supabaseFileUrl }]);
    }
    
    if (dbUpdateResult.error) {
      console.error('Database update error:', dbUpdateResult.error);
    } else {
      console.log('Database updated successfully');
    }

    // Send email notification if recipients are provided and Resend API key exists
    if (externalRecipients.length > 0 && process.env.RESEND_API_KEY) {
      try {
        await resend.emails.send({
          from: 'noreply@yourdomain.com', // Update with your verified sender
          to: externalRecipients,
          subject: `Report ${reportNum} has been uploaded`,
          html: `<p>A new report (${reportNum}) has been uploaded.</p>
                <p>You can view it at: <a href="${supabaseFileUrl}">${supabaseFileUrl}</a></p>`
        });
        console.log('Email notification sent to:', externalRecipients);
      } catch (emailError) {
        console.error('Failed to send email notification:', emailError);
      }
    }
    
    // Clean up the uploaded file
    fs.unlinkSync(req.file.path);
    
    // Return success response with the extracted text and file URL
    return res.status(200).json({ 
      message: 'PDF processed successfully', 
      reportNum: reportNum,
      fileUrl: supabaseFileUrl,
      textLength: pdfText.length,
      // Limit text preview to prevent massive responses
      textPreview: pdfText.substring(0, 500) + (pdfText.length > 500 ? '...' : ''),
      emailSent: externalRecipients.length > 0
    });
    
  } catch (error) {
    console.error('Error processing PDF:', error);
    // Ensure the uploaded file is cleaned up even if an error occurs
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    return res.status(500).json({ 
      error: 'Error processing request',
      details: error.message
    });
  }
});

module.exports = router;