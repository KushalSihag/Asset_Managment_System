const express = require('express');
const ping = require('ping');
const fs = require('fs');
const csv = require('csv-parser');
const path = require('path');

const app = express();
let lastStatuses = {}; // To store last statuses

// Middleware to serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Endpoint to provide updated status of IP addresses
app.get('/update-status', async (req, res) => {
    const ipAddresses = [];

    // Read IPs from the CSV file
    fs.createReadStream('ip.csv')
        .pipe(csv())
        .on('data', (row) => {
            ipAddresses.push({ IPAddress: row.IPAddress, Address: row.Address });
        })
        .on('end', async () => {
            console.log('CSV file successfully processed');

            try {
                // Ping multiple IP addresses concurrently
                const results = await Promise.all(ipAddresses.map(async entry => {
                    const res = await ping.promise.probe(entry.IPAddress);
                    let status = res.alive ? 'YES' : 'NO';

                    // Check if the IP was down last time and is still down
                    if (!res.alive && lastStatuses[entry.IPAddress] === 'NO') {
                        status = 'MAINTENANCE';
                    }

                    // Update the last status
                    lastStatuses[entry.IPAddress] = res.alive ? 'YES' : 'NO';

                    return {
                        IPAddress: entry.IPAddress,
                        Address: entry.Address,
                        Status: status
                    };
                }));

                // Send response with IP addresses and their statuses
                res.json(results);
            } catch (error) {
                console.error('Error pinging IP addresses:', error);
                res.status(500).json({ error: 'Internal Server Error' });
            }
        });
});

// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
