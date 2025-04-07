const express = require("express");
const router = express.Router();
const PDFParser = require('pdf-parse');
const fs = require('fs');
const axios = require('axios');
const cron = require('node-cron');
require('dotenv').config();
const { Resend } = require('resend');
const supabase = require("../../db/db");

// Initialize middleware
router.use(express.json());

// Initialize Resend
const resend = new Resend(process.env.RESEND_API_KEY);



// Basic route
router.get("/", (req, res) => {
  res.json("Hello from file route.");
});



// Function to send daily report email
async function sendDailyReport() {
  try {
    // Get today's date in ISO format (YYYY-MM-DD)
    const today = new Date().toISOString().split('T')[0];
    
    // Query Supabase for today's records
    const { data: todayRecords, error: queryError } = await supabase
      .from('inteligentdata')
      .select('*')
      .eq('creaded_at', today);
    
    if (queryError) {
      throw new Error(`Supabase query error: ${queryError.message}`);
    }
    
    // Count of records
    const recordCount = todayRecords ? todayRecords.length : 0;
    
    // Generate HTML for the email with the record list
    let recordsHtml = '';
    if (recordCount > 0) {
      recordsHtml = '<ul>';
      todayRecords.forEach(record => {
        recordsHtml += `<li>Document: ${record.filename || 'Unnamed'}</li>`;
      });
      recordsHtml += '</ul>';
    } else {
      recordsHtml = '<p>No documents were processed today.</p>';
    }
    
    // Send the email
    const response = await resend.emails.send({
      from: 'PDF Analysis <info@aldb.mt>',
      to: ["shengelia1800@gmail.com", "charlot.caruana@aldb.mt", "clint.mallia@aldb.mt", "aldo.busuttil@aldb.mt"],
      subject: `Daily Document Processing Report - ${today}`,
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
              <h1>Daily Document Processing Report</h1>
              <div class="analysis">
                <p>Date: <strong>${today}</strong></p>
                <p>Total documents processed today: <strong>${recordCount}</strong></p>
                <h3>Documents:</h3>
                ${recordsHtml}
              </div>
              <div class="footer">
                <p>This is an automated message sent by ALDB&Associates</p>
              </div>
            </div>
          </body>
        </html>
      `,
    });
    
    console.log('Daily report email sent successfully:', response.id);
    return response;
  } catch (error) {
    console.error('Error sending daily report:', error);
    throw new Error('Failed to send daily report: ' + error.message);
  }
}

// Set up cron job to run at 18:00 every day
cron.schedule('0 21 * * *', async () => {
  console.log('Running daily report cron job at 21:00');
  try {
    await sendDailyReport();
  } catch (error) {
    console.error('Cron job error:', error);
  }
});


module.exports = router;