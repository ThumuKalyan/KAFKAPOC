// Load environment variables
require('dotenv').config();

const express = require('express');
const { Kafka } = require('kafkajs');
const cors = require('cors');
const http = require('http'); // Import http module
const WebSocket = require('ws'); // Import ws library

const app = express();
const port = process.env.CONSUMER_SERVER_PORT || 3001;

// --- CORS Configuration ---
app.use(cors());
// --- End CORS ---


// --- Message Storage (In Memory - Simple Demo) ---
// This array will hold the messages received from Kafka for the REST API
const consumedMessages = [];
const MAX_MESSAGES_IN_MEMORY = 100;
// --- End Message Storage ---


// --- WebSocket Server Setup ---
// Create an HTTP server instance from the Express app
const server = http.createServer(app);

// Create a WebSocket server and attach it to the HTTP server
const wss = new WebSocket.Server({ server });

// Store connected WebSocket clients
const clients = new Set();

wss.on('connection', (ws) => {
    console.log('Client connected via WebSocket');
    clients.add(ws); // Add new client to the set

    // Optional: Handle messages from clients if needed (not required for this use case)
    // ws.on('message', (message) => {
    //     console.log(`Received message from client => ${message}`);
    // });

    // Handle client disconnecting
    ws.on('close', () => {
        console.log('Client disconnected via WebSocket');
        clients.delete(ws); // Remove client from the set
    });

    // Handle errors
    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        clients.delete(ws); // Remove client on error
    });

    // Optional: Send a welcome message to the client
    // ws.send('Welcome to the Kafka message stream!');
});

console.log('WebSocket server attached to HTTP server.');
// --- End WebSocket Server Setup ---


// --- Kafka Consumer Configuration ---
const kafka = new Kafka({
    clientId: 'file-display-consumer',
    brokers: [process.env.KAFKA_BROKER_ADDRESS]
});

const consumer = kafka.consumer({ groupId: process.env.KAFKA_CONSUMER_GROUP_ID });

// Function to connect and run the consumer
async function runKafkaConsumer() {
    try {
        await consumer.connect();
        console.log('Kafka consumer connected.');

        // Read from the beginning to get historical messages for the API endpoint
        await consumer.subscribe({ topic: process.env.KAFKA_TOPIC, fromBeginning: true });

        await consumer.run({
            eachMessage: async ({ topic, partition, message }) => {
                // This function is called for every message received from Kafka
                try {
                    const messageValue = message.value.toString();
                    const fileEventData = JSON.parse(messageValue);

                    console.log(`Consumed Kafka message: ${JSON.stringify(fileEventData)}`);

                    // --- Update In-Memory Storage (for REST API) ---
                    consumedMessages.push(fileEventData);
                    if (consumedMessages.length > MAX_MESSAGES_IN_MEMORY) {
                        consumedMessages.splice(0, consumedMessages.length - MAX_MESSAGES_IN_MEMORY);
                    }
                    // --- End Storage Update ---

                    // --- Push Message to Connected WebSocket Clients ---
                    const messageToSend = JSON.stringify(fileEventData);
                    clients.forEach(client => {
                        // Ensure the client is still open before sending
                        if (client.readyState === WebSocket.OPEN) {
                            client.send(messageToSend);
                        }
                    });
                    console.log(`Pushed message to ${clients.size} WebSocket client(s).`);
                    // --- End Push to Clients ---

                } catch (error) {
                    console.error('Error processing Kafka message:', error);
                }
            },
        });

    } catch (error) {
        console.error('Error connecting or running Kafka consumer:', error);
        // The app might exit or try to reconnect depending on error handling
    }
}

// Run the Kafka consumer function
runKafkaConsumer().catch(console.error);

// Handle graceful shutdown
process.on('SIGINT', async () => {
    console.log('\nShutting down consumer and WebSocket server...');
    if (consumer) {
        await consumer.disconnect();
        console.log('Consumer disconnected.');
    }
    if (server) {
        server.close(() => console.log('HTTP/WebSocket server closed.'));
    }
    // Close all WebSocket connections
    clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.close(1000, 'Server shutting down'); // 1000 is normal closure
        }
    });
    // Give clients a moment to close before exiting
    setTimeout(() => process.exit(0), 1000);
});

// --- End Kafka Consumer Configuration ---


// --- Web Server & API Endpoint ---

// Define the API endpoint to get consumed messages (for initial history fetch)
app.get('/api/messages', (req, res) => {
    console.log('REST API /api/messages called. Returning historical messages.');
    // Return the stored messages as JSON (latest first for easier display)
    res.json([...consumedMessages].reverse());
});

// Note: The WebSocket server is already attached to the 'server' instance.
// Clients will connect to the WebSocket server directly, not through an Express route here.
// By default, the 'ws' library attaches the WebSocket server to the root path '/'.
// If you need a specific path like '/ws', you might need to configure the WebSocket server path or use a library like 'express-ws'.
// For simplicity with 'ws' attached to the server, the frontend will connect to 'ws://localhost:3001'.
// Let's adjust the frontend code assumption to connect to the root path for simplicity with the basic 'ws' setup.


// Start the HTTP/WebSocket server
server.listen(port, () => {
    console.log(`Server listening on http://localhost:${port}`);
    console.log(`REST API for history: http://localhost:${port}/api/messages`);
    console.log(`WebSocket endpoint for real-time: ws://localhost:${port}`); // Basic 'ws' attaches to root
});

// --- End Web Server & API Endpoint ---