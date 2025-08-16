const express = require('express');
const WebSocket = require('ws');

const app = express();
const port = process.env.PORT || 8080;

app.get("/", (req, res) => {
    res.send("WebSocket server is running.");
});

const server = app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});

const wss = new WebSocket.Server({ server });
const clientData = new Map(); // Map to track client connections and their data

function broadcastToServerClients(serverID, message) {
    clientData.forEach((data, clientSocket) => {
        if (data && data.server === serverID && clientSocket.readyState === WebSocket.OPEN) {
            clientSocket.send(message);
        }
    });
}

wss.on('connection', (ws) => {
    console.log("New client connected. Total:", clientData.size + 1);
    clientData.set(ws, { lastUpdated: Date.now() }); // Track last updated time

    ws.on('message', (message) => {
        const parsedMessage = JSON.parse(message);
        console.log("Received message:", parsedMessage);

        if (parsedMessage.action === 'update') {
            const playerData = parsedMessage.data;
            console.log(`[UPDATE] SID: ${playerData.sid}, Server: ${playerData.server}, Sync: ${playerData.sync}`);
            clientData.set(ws, { ...playerData, lastUpdated: Date.now() });

            // Filter clients in the same server
            const serverID = playerData.server;
            const sameServerClients = Array.from(clientData.entries())
                .filter(([_, data]) => data && data.server === serverID)
                .map(([_, data]) => ({ sid: data.sid, sync: data.sync }));

            broadcastToServerClients(serverID, JSON.stringify({ action: 'update', data: sameServerClients }));
            console.log(`[BROADCAST] To Server: ${serverID}, Clients sids:`, sameServerClients.map(c => c.sid));
        }
    });

    ws.on('close', () => {
        console.log("Client disconnected.");
        clientData.delete(ws); // Remove client data on disconnect
        console.log("Remaining client number:", clientData.size);
    });
});

setInterval(() => {
    const now = Date.now();
    let removed = 0;

    for (const [clientSocket, data] of clientData.entries()) {
        if (now - data.lastUpdated > 300000) { // 5min timeout
            console.log(`[TIMEOUT] Removing inactive client: ${data.sid} from server ${data.server}`);
            clientData.delete(clientSocket);
            try {
                clientSocket.terminate(); // force close if still hanging
            } catch (err) {
                console.error("Error terminating socket:", err);
            }
            removed++;
        }
    }

    if (removed > 0) {
        console.log(`[CLEANUP] Removed ${removed} stale clients.`);
    }
}, 30000);
