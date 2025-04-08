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

// Function to create column name from section name
function createColumnName(sectionKey, sectionName, ratingType) {
  // Map section keys to proper column prefixes
  const sectionMap = {
    'p2': 'access_and_security',
    'p3': 'falls_from_heights',
    'p4': 'falling_objects',
    'p5': 'ppe',
    'p6': 'electrical',
    'p7': 'scaffolding',
    'p8': 'certification',
    'p9': 'welfare',
    'p10': 'fire_protection',
    'p11': 'first_aid_and_emergency',
    'p12': 'asbestos',
    'p13': 'training',
    'p14': 'ladders',
    'p15': 'power_tools',
    'p17': 'health_and_safety_documents',
    'p18': 'lifting_equipment',
    'p19': 'sharp_edges',
    'p20': 'lone_workers',
    'p21': 'others',
    'p22': 'p22',
    'p50': 'p50'
  };

  // Get the column prefix based on the section key
  const columnPrefix = sectionMap[sectionKey] || sectionKey.toLowerCase();
  
  // Create the column name by combining prefix with rating type
  return `${columnPrefix}_${ratingType.toLowerCase().replace(/\s+/g, '_')}`;
}

// Route for receiving JSON data and saving to Supabase
router.post('/', async (req, res) => {
  try {
    // Get JSON data from request body
    const jsonData = req.body;
  

    if (!jsonData) {
      return res.status(400).json({ error: "Missing JSON data" });
    }

    const { data: existingReports, error: queryError } = await supabase
            .from('inteligentdata')
            .select('id, created_at')
            .eq('report_number', jsonData.Entry.AnswersJson.p1.reportNum);  

        if (queryError) {
          return res.status(500).json({ error: queryError.message });
        }

        if (existingReports && existingReports.length > 0) {
            return res.status(500).json({ message: 'Record Already exist in Database' });
        }

    // Extract risk ratings
    const sectionRatings = extractRiskRatings(jsonData);
    
    
    // Prepare data object for Supabase insertion
    const dataToInsert = {
      // Include the original JSON data
      json: jsonData,
      project_code: jsonData.Entry.AnswersJson.p1.projectCode,
      customer_name: jsonData.Entry.AnswersJson.p1.CustomerName,
      date: jsonData.Entry.AnswersJson.p1.date,
      author: jsonData.Entry.AnswersJson.p1.saveInspector,
      customer_code: jsonData.Entry.AnswersJson.p1.saveCustomer,
      report_number: jsonData.Entry.AnswersJson.p1.reportNum,
      start_time: jsonData.Entry.StartTime,
      end_time: jsonData.Entry.CompleteTime,
    };
    
    // Add columns for each section and rating type
    Object.entries(sectionRatings).forEach(([sectionKey, sectionData]) => {
      // Skip the 'total' entry for now - we'll handle it separately
      if (sectionKey !== 'total' && sectionKey !== "p1" && sectionKey !== "p22" && sectionKey !== "p50" && sectionKey !== "p0") {
        // For each section, add all rating counts to their specific columns
        Object.entries(sectionData.counts).forEach(([ratingType, count]) => {
          const columnName = createColumnName(sectionKey, sectionData.name, ratingType);
          dataToInsert[columnName] = count;
        });
      }
    });
    
    // Add total counts to their dedicated columns
    if (sectionRatings.total) {
      Object.entries(sectionRatings.total.counts).forEach(([ratingType, count]) => {
        const columnName = `total_${ratingType.toLowerCase().replace(/\s+/g, '_')}`;
        dataToInsert[columnName] = count;
      });
    }

    
    // Insert into Supabase
    const { data: supabaseData, error: supabaseError } = await supabase
      .from('inteligentdata')
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