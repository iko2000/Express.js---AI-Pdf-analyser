const express = require('express');
const app = express();
const cors = require('cors');
const bodyParser = require('body-parser');
const fileroute = require('./routes/file-reciever-route/file-route')
require('dotenv').config();
app.use(cors());

// OR use a more specific configuration
app.use(cors({
  origin: '*', // Allow only your frontend application
  methods: ['GET', 'POST', 'PUT', 'DELETE'], // Allowed HTTP methods
  allowedHeaders: ['Content-Type', 'Authorization'], // Allowed headers
  credentials: true // Allow cookies to be sent with requests
}));

app.use(bodyParser.json());


app.get('/', (req, res) => {
    res.send('Hello, world!'); // Send 'Hello, world!' as response
  });

app.use('/fileroute', fileroute);

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});



module.exports = app; // Export the Express app