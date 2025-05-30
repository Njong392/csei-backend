const dbConfig = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: 'localhost',
    database: process.env.DB_NAME,
    options: {
        encrypt: false, // Use encryption for the connection
        trustServerCertificate: true, // Trust the server certificate
    }
}

module.exports = dbConfig