// Load environment variables
require('dotenv').config();

const express = require('express');
const multer = require('multer');
const mysql = require('mysql2/promise'); // Using promise wrapper for async/await
const { Kafka } = require('kafkajs');
const path = require('path');
const fs = require('fs'); // To ensure directory exists

const app = express();
const port = process.env.SERVER_PORT || 3000;

// --- Ensure file storage directory exists ---
const fileStoragePath = process.env.FILE_STORAGE_PATH;
if (!fs.existsSync(fileStoragePath)) {
    fs.mkdirSync(fileStoragePath, { recursive: true });
    console.log(`Created storage directory: ${fileStoragePath}`);
}
// --- End directory check ---


// --- Multer Configuration for File Upload ---
// Configure storage location and filename
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, fileStoragePath); // Specify the directory to save files
    },
    filename: (req, file, cb) => {
        // Use a unique filename, e.g., timestamp + original name
        cb(null, `${Date.now()}-${file.originalname}`);
    }
});

const upload = multer({ storage: storage });
// --- End Multer Configuration ---


// --- Database Connection Pool (Recommended) ---
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    waitForConnections: true,
    connectionLimit: 10, // Adjust as needed
    queueLimit: 0
});

// Test DB connection (optional)
pool.getConnection()
    .then(connection => {
        console.log('Database connection pool created successfully.');
        connection.release(); // Release the connection
    })
    .catch(err => {
        console.error('Error connecting to the database:', err);
        // Consider exiting or handling the error appropriately
        process.exit(1);
    });
// --- End Database Connection Pool ---


// --- Kafka Producer Configuration ---
const kafka = new Kafka({
    clientId: 'file-uploader-producer',
    brokers: [process.env.KAFKA_BROKER_ADDRESS]
});

const producer = kafka.producer();

// Connect Kafka producer (important before sending messages)
async function connectKafkaProducer() {
    try {
        await producer.connect();
        console.log('Kafka producer connected successfully.');
    } catch (error) {
        console.error('Error connecting Kafka producer:', error);
        // Consider exiting or handling the error appropriately
        process.exit(1);
    }
}

// Ensure producer is connected before starting the server
connectKafkaProducer().then(() => {
    // --- Start the Express Server ---
    app.listen(port, () => {
        console.log(`Uploader server listening at http://localhost:${port}`);
    });
    // --- End Server Start ---
});

// Handle graceful shutdown
process.on('SIGINT', async () => {
    console.log('\nShutting down producer...');
    await producer.disconnect();
    console.log('Producer disconnected.');
    process.exit(0);
});

// --- End Kafka Producer Configuration ---


// --- File Upload Route ---
// 'uploadedFile' is the name of the form field for the file
app.post('/upload', upload.single('uploadedFile'), async (req, res) => {
    if (!req.file) {
        return res.status(400).send('No file uploaded.');
    }

    const { filename, originalname, mimetype, size, path: filePath } = req.file;

    let connection;
    try {
        // --- Save Metadata to MySQL ---
        connection = await pool.getConnection();
        const [rows] = await connection.execute(
            'INSERT INTO uploaded_files (filename, original_filename, mimetype, size, storage_path) VALUES (?, ?, ?, ?, ?)',
            [filename, originalname, mimetype, size, filePath]
        );
        const fileId = rows.insertId; // Get the ID of the inserted row

        console.log(`Metadata saved to DB for file ID: ${fileId}`);
        // --- End Save Metadata to MySQL ---

        // --- Send Kafka Event ---
        const fileEventData = {
            fileId: fileId,
            filename: originalname, // Often useful to use original name in event
            stored_filename: filename,
            size: size,
            mimetype: mimetype,
            storage_path: filePath, // Path where the file is saved
            upload_time: new Date().toISOString() // ISO 8601 format
        };

        const messageValue = JSON.stringify(fileEventData);

        await producer.send({
            topic: process.env.KAFKA_TOPIC,
            messages: [
                { value: messageValue },
            ],
        });
        console.log(`Kafka event sent for file ID: ${fileId}`);
        // --- End Send Kafka Event ---

        res.status(200).send(`File uploaded, metadata saved (ID: ${fileId}), and event sent.`);

    } catch (error) {
        console.error('Error during file upload processing:', error);
        // --- Error Handling: Clean up saved file if DB or Kafka failed ---
        // You might want to implement more robust cleanup logic
        // For simplicity here, just noting it. In production, consider
        // compensating transactions or dead letter queues.
        fs.unlink(filePath, (err) => {
            if (err) console.error(`Error cleaning up file ${filePath}:`, err);
            else console.log(`Cleaned up file ${filePath} due to error.`);
        });
        // --- End Error Handling ---
        res.status(500).send('An error occurred during processing.');
    } finally {
        if (connection) connection.release(); // Release connection back to pool
    }
});
// --- End File Upload Route ---