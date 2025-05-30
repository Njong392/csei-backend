const express = require('express')
require('dotenv').config() // Load environment variables from .env file
const sql = require('mssql')
const dbConfig = require('./config/db')

const app = express()
const port = process.env.PORT

app.get('/', (req, res) => {
    res.send("Hello world")
})

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`)
})


async function getClients(){
    try{
        const pool = await sql.connect(dbConfig)
        console.log('Connected to the database successfully')

        const results = await pool.request().query('SELECT * FROM Users')
        console.log(results.recordset)
    } catch(err){
        console.error('SQL error', err)
    }
}

getClients()