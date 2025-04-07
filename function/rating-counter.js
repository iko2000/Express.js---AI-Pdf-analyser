/**
 * Extracts risk ratings from form data
 * @param {Object} jsonData - The form JSON data
 * @return {Object} Object containing risk ratings by section and totals
 */
function extractRiskRatings(jsonData) {
    // Initialize result object
    const result = {};
    
    // Initialize standard rating types
    const standardRatings = {
      "Good": 0,
      "Low": 0,
      "Medium": 0,
      "High": 0,
      "Stop Work": 0,
    };
    
    try {
      // Find all section keys (p2, p3, p4, etc.)
      let sectionKeys = Object.keys(jsonData.Entry.AnswersJson);
      
      // Process each section
      
      sectionKeys.forEach(sectionKey => {
        const section = jsonData.Entry.AnswersJson[sectionKey];
        
        // Get section name/category
        const categoryKey = `category_${sectionKey}`;
        const sectionName = section[categoryKey] || sectionKey;
        
        // Create fresh rating counts for this section
        const sectionRatingCounts = { ...standardRatings };
        
        // Get the questions array key
        const questionsKey = `questions_${sectionKey}`;
        
        // Check if section has questions and if it's an array
        if (section && section[questionsKey] && Array.isArray(section[questionsKey])) {
          // Iterate through questions in the section
          section[questionsKey].forEach(question => {
            // Direct risk rating (as seen in the sample data)
            const riskRatingKey = `riskRating_${sectionKey}`;
            
            if (question[riskRatingKey]) {
              const rating = question[riskRatingKey];
              // Increment the respective rating counter
              if (sectionRatingCounts.hasOwnProperty(rating)) {
                sectionRatingCounts[rating]++;
              } else {
                // If this is a new rating type, add it
                sectionRatingCounts[rating] = 1;
              }
            } 
            // Alternative: Check if there's a chosen option with risk rating (for "No" answers)
            else if (question[`chosenOptions_${sectionKey}`] && question[`chosenOptions_${sectionKey}`].includes("Risk")) {
              // Extract risk level (e.g., "High" from "High Risk - ...")
              const riskPart = question[`chosenOptions_${sectionKey}`].split(" Risk")[0];
              
              // Increment the respective rating counter
              if (sectionRatingCounts.hasOwnProperty(riskPart)) {
                sectionRatingCounts[riskPart]++;
              }
            }
          });
        }
        
        // Add this section's counts to the result
        result[sectionKey] = {
          name: sectionName,
          counts: sectionRatingCounts
        };
      });
      
      // Add total counts across all sections
      const totalCounts = { ...standardRatings };
      Object.values(result).forEach(section => {
        Object.entries(section.counts).forEach(([rating, count]) => {
          totalCounts[rating] = (totalCounts[rating] || 0) + count;
        });
      });
      
      result.total = {
        name: "Total",
        counts: totalCounts
      };
      
    } catch (error) {
      console.error("Error extracting risk ratings:", error);
    }
    
    return result;
  }
  
  // Export the function to be used in other files
  module.exports = {
    extractRiskRatings
  };