const express = require("express");
const router = express.Router();
require('dotenv').config();

// Initialize Supabase client
const supabase = require("../../db/db");

// Middleware for parsing JSON
router.use(express.json());

router.get("/", async (req, res) => {
   res.json("Test");
});

// Route for receiving JSON data
router.post('/', async (req, res) => {
  try {
    // Get JSON data from request body
    const jsonData = req.body;
    
    if (!jsonData) {
      return res.status(400).json({ error: "Missing JSON data" });
    }
    
    // Insert the JSON data into the inteligentdata table
    const { data, error } = await supabase
      .from('inteligentdata')
      .insert([
        { json: jsonData }  // Insert into the 'json' column
      ]);
    
    if (error) {
      console.error("Error inserting data into Supabase:", error);
      return res.status(500).json({ error: error.message });
    }
    
    // Return success response
    return res.status(200).json({ 
      success: true, 
      message: "Data inserted successfully", 
      data 
    });
    
  } catch (error) {
    console.error("Server error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;