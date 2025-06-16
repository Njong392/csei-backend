const express = require('express')
require('dotenv').config() // Load environment variables from .env file
const sql = require('mssql')
const dbConfig = require('./config/db')
const prospectRoutes = require('./routes/prospectRoute')
const memberRoutes = require('./routes/memberRoute')
const cookieParser = require('cookie-parser')

const app = express()
const port = process.env.PORT

app.get('/', (req, res) => {
    res.send("Hello world")
})
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`)
})

app.use(express.json()) // Middleware to parse JSON bodies
app.use(cookieParser()) // Middleware to parse cookies

// routes
app.use('/prospects', prospectRoutes)
app.use('/members', memberRoutes)

// Connect to SQL Server
sql
  .connect(dbConfig)
  .then(() => {
    console.log("Connected to SQL Server");
    // Start server
    app.listen(port, () => {
      console.log(`Server is running on http://localhost:${port}`);
    });
  })
  .catch((err) => {
    console.error("Database connection failed:", err);
  });