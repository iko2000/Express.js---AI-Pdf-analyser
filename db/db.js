const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supabaseUrl = 'https://gulkzkzpucpyjkebpvbm.supabase.co'
const supabaseKey = process.env.SUPABASE_KEY
const supabase = createClient(supabaseUrl, supabaseKey)


// Export the Supabase client
module.exports = supabase;