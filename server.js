const express = require('express');
const routes = require('./routes/routes.js');
const cors = require('cors');
const logger = require('./middleware/logger');
const errorHandler = require('./middleware/errorHandler.js');
require('dotenv').config();

const app = express();

app.use(cors({
    origin: ['http://localhost:3000'], //change with deployed frontend link
    credentials: true
}));

//middlewares- to parse data and handle form requests
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

//routes
app.use('/api', routes);

app.get('/', (req, res) => {
  res.send('Meet me amoré backend is running!');
});

app.use(errorHandler);

const port = process.env.PORT || 8000;
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});