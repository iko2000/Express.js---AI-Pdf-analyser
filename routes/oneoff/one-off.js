const express = require("express");
const router = express.Router();
require('dotenv').config();
const { extractRiskRatings } = require("../../function/rating-counter");

// Initialize Supabase client
const supabase = require("../../db/db");
const { json } = require("body-parser");

// Middleware for parsing JSON
router.use(express.json());

// Test route
router.get("/", async (req, res) => {
  res.json("Test");
});



  // Get the column prefix based on the section key
 

// Route for receiving JSON data and saving to Supabase
router.post('/', async (req, res) => {
  try {
    // Get JSON data from request body
    const jsonData = req.body;
  

    if (!jsonData) {
      return res.status(400).json({ error: "Missing JSON data" });
    }

    
    // Prepare data object for Supabase insertion
    const dataToInsert = {
      // json: jsonData,
      client: jsonData.Entry.AnswersJson.p1.projectCode,
      report_num: jsonData.Entry.AnswersJson.p1.reportNum,
      hours: jsonData.Entry.AnswersJson.p1.hours,
      service: jsonData.Entry.AnswersJson.p1.service,


    };
    

    // Insert into Supabase
    const { data: supabaseData, error: supabaseError } = await supabase
      .from('oneoffinteligentdata')
      .insert([dataToInsert]);
    
    if (supabaseError) {
      console.error("Error inserting data into Supabase:", supabaseError);
      return res.status(500).json({ error: supabaseError.message });
    }
    
    return res.status(200).json({
      success: true,
      message: "Data inserted successfully into Database",
      columns: Object.keys(dataToInsert).filter(key => key !== 'json')
    });
    
  } catch (error) {
    console.error("Server error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;