const express = require("express");
const router = express.Router();
require('dotenv').config();

// Initialize Supabase client
const supabase = require("../../db/db");

// Initialize Mongoose connection
const mongoose = require("mongoose");

// IMPORTANT: Connect to the specific reports database
// Make sure the MONGODB_URI environment variable does NOT include the database name
// We explicitly specify the database name here
const MONGODB_URI = process.env.MONGODB_URI;
const dbName = 'reports';

// Connect to the reports database
mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  dbName: dbName // This ensures we connect to the reports database
})
.then(() => console.log(`MongoDB connected successfully to '${dbName}' database`))
.catch(err => console.error("MongoDB connection error:", err));

// Create a model for the analytical_report collection
// By using the existing collection name, Mongoose will use that collection
// Note: In Mongoose, model name should be singular and Pascal case
// But we can specify the exact collection name as the third parameter
const AnalyticalReport = mongoose.model(
  'AnalyticalReport', 
  new mongoose.Schema({}, { strict: false }), 
  'analytical_report' // This specifies the exact collection name
);

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