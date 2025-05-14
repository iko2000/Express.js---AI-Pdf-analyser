const express = require('express');
const app = express();
const cors = require('cors');
const bodyParser = require('body-parser');
const fileroute = require('./routes/file-reciever-route/file-route')
const Datasaverroute = require('./routes/dataretriever/data-route');
const Filetestroute = require('./routes/testroute/fileroute');
const Oneoffroute = require('./routes/oneoff/one-off');
const path = require('path');

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

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.send('Hello, world!'); // Send 'Hello, world!' as response
  });

app.use('/fileroute', fileroute);
app.use('/datasaver', Datasaverroute);
app.use('/oneoff', Oneoffroute);
app.use('/testfile', Filetestroute)




  
  // Only start the server AFTER we've connected to the database
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  })


module.exports = app; // Export the Express app