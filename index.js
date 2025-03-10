const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const fileroute = require('./routes/file-reciever-route/file-route')
require('dotenv').config();


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