const express = require("express");
const router = express.Router();
require('dotenv').config();

// Initialize Supabase client
const supabase = require("../../db/db");

// Initialize Mongoose connection
const mongoose = require("mongoose");

// MongoDB connection string
const MONGODB_URI = process.env.MONGODB_URI;
const dbName = 'reports';

// Improved connection options
mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  dbName: dbName,
  serverSelectionTimeoutMS: 30000, // Increase timeout to 30 seconds
  socketTimeoutMS: 45000, // Increase socket timeout
  connectTimeoutMS: 30000, // Increase connection timeout
  bufferCommands: false, // Disable command buffering
})
.then(() => console.log(`MongoDB connected successfully to '${dbName}' database`))
.catch(err => {
  console.error("MongoDB connection error:", err);
  process.exit(1); // Exit process if we can't connect to the database
});

// Handle Mongoose connection events
mongoose.connection.on('connected', () => {
  console.log(`Mongoose connection opened to ${dbName} database`);
});

mongoose.connection.on('error', (err) => {
  console.error('Mongoose connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('Mongoose disconnected');
});

// Create a model for the analytical_report collection
const AnalyticalReport = mongoose.model(
  'AnalyticalReport', 
  new mongoose.Schema({}, { strict: false }), 
  'analytical_report'
);

// Middleware for parsing JSON
router.use(express.json());

// Test route
router.get("/", async (req, res) => {
  res.json("MongoDB Connection Status: " + mongoose.connection.readyState);
});

// Route for receiving JSON data and saving to both Supabase and MongoDB
router.post('/', async (req, res) => {
  try {
    // Check MongoDB connection first
    if (mongoose.connection.readyState !== 1) {
      console.error("MongoDB not connected. Current state:", mongoose.connection.readyState);
      // Try to reconnect
      await mongoose.connect(MONGODB_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        dbName: dbName,
        serverSelectionTimeoutMS: 30000,
      });
    }
    
    // Get JSON data from request body
    const jsonData = req.body;
    
    if (!jsonData) {
      return res.status(400).json({ error: "Missing JSON data" });
    }
    
    // STEP 1: Insert into Supabase
    const { data: supabaseData, error: supabaseError } = await supabase
      .from('inteligentdata')
      .insert([
        { json: jsonData }
      ]);
    
    if (supabaseError) {
      console.error("Error inserting data into Supabase:", supabaseError);
      return res.status(500).json({ error: supabaseError.message });
    }
    
    // STEP 2: Insert raw JSON into MongoDB
    // Only include necessary fields - no need for Mongoose methods/properties
    const mongoData = {
      ...jsonData,
      _created_at: new Date()
    };
    
    // Use the native MongoDB driver directly for more control
    const result = await mongoose.connection.db.collection('analytical_report')
      .insertOne(mongoData);
    
    // Return success response
    return res.status(200).json({
      success: true,
      message: "Data inserted successfully into both databases",
      supabase: supabaseData,
      mongodb: {
        id: result.insertedId
      }
    });
    
  } catch (error) {
    console.error("Server error:", error);
    return res.status(500).json({ 
      error: "Internal server error", 
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

module.exports = router;