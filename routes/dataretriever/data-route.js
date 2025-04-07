const express = require("express");
const router = express.Router();
require('dotenv').config();
const mongoose = require('mongoose');

// Initialize Supabase client
const supabase = require("../../db/db");


// Create a simple MongoDB collection with the specific name 'analytical_report'
const AnalyticalReport = mongoose.model('analytical_report', new mongoose.Schema({}, { strict: false }));

// Middleware for parsing JSON
router.use(express.json());

// Test route
router.get("/", async (req, res) => {
  res.json("Test");
});

// Route for receiving JSON data and saving to both Supabase and MongoDB
router.post('/', async (req, res) => {
  try {
    // Get JSON data from request body
    const jsonData = req.body;
    
    if (!jsonData) {
      return res.status(400).json({ error: "Missing JSON data" });
    }
    
    // STEP 1: Insert into Supabase
    const { data: supabaseData, error: supabaseError } = await supabase
      .from('inteligentdata')
      .insert([
        { json: jsonData }  // Insert into the 'json' column
      ]);
    
    if (supabaseError) {
      console.error("Error inserting data into Supabase:", supabaseError);
      return res.status(500).json({ error: supabaseError.message });
    }
    
    // STEP 2: Insert raw JSON into MongoDB analytical_report collection
    // This uses a schemaless model that accepts any JSON structure
    const mongoDocument = new AnalyticalReport(jsonData);
    
    // Add timestamp for reference
    mongoDocument._created_at = new Date();
    
    // Save to MongoDB
    const savedDocument = await mongoDocument.save();

    console.log(savedDocument + "sv doc")
    
    // Return success response
    return res.status(200).json({
      success: true,
      message: "Data inserted successfully into both databases",
      supabase: supabaseData,
      mongodb: {
        id: savedDocument._id
      }
    });
    
  } catch (error) {
    console.error("Server error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;