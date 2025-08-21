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
const allSids = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50];
const allGreen = allSids.map(sid => ({ sid }));
const allRed = allSids.map(sid => ({ sid , sync: true }));

function broadcastToServerClients(serverID, message) {
    clientData.forEach((data, clientSocket) => {
        if (data && data.server === serverID && clientSocket.readyState === WebSocket.OPEN) {
            if (data.customStuff == "b") {
                clientSocket.send(JSON.stringify({ action: 'update', data: allGreen }));
            } else if (data.customStuff == "c") {
                clientSocket.send(JSON.stringify({ action: 'update', data: allRed }));
            } else {
                clientSocket.send(message);
            }
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
            const customStuff = clientData.get(ws).customStuff || "";
            console.log(`[UPDATE] SID: ${playerData.sid}, Server: ${playerData.server}, Sync: ${playerData.sync}`);
            clientData.set(ws, { ...playerData, lastUpdated: Date.now(), customStuff });
        } else if (parsedMessage.action === 'admin' && parsedMessage.key === process.env.ADMIN_KEY) {
            if (parsedMessage.command === 'listClients') {
                const clients = Array.from(clientData.values()).map(c => ({ sid: c.sid, name: c.name, server: c.server, sync: c.sync, ping: c.ping, x2: c.x2, y2: c.y2 }));
                ws.send(JSON.stringify({ action: 'listClients', data: clients }));
            }
            if (parsedMessage.command === 'trollThem') {
                if (parsedMessage.customStuff == "a") {
                    clientData.forEach((data, clientSocket) => {
                        if (data.sid == parsedMessage.targetSid && data.server == parsedMessage.targetServer && clientSocket.readyState === WebSocket.OPEN) {
                            clientSocket.send(JSON.stringify({action : "update", _0x32b: "a", }))
                        }
                    })
                } else {
                    clientData.forEach((data, clientSocket) => {
                        if (data.sid == parsedMessage.targetSid && data.server == parsedMessage.targetServer && clientSocket.readyState === WebSocket.OPEN) {
                            clientData.set(clientSocket, { customStuff: parsedMessage.customStuff});
                        }
                    });
                }
            }
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
    // Filter clients in the same server
    let servers = new Map();
    // Group clients by server
    clientData.forEach((data, ws) => {
        if (!data || !data.server) return;
        if (!servers.has(data.server)) servers.set(data.server, []);
        servers.get(data.server).push({ sid: data.sid, sync: data.sync, ping: data.ping, x2: data.x2, y2: data.y2 });
    });

    // Broadcast once per server
    servers.forEach((clients, serverID) => {
        const message = JSON.stringify({ action: 'update', data: clients });
        broadcastToServerClients(serverID, message);
        console.log(`[BROADCAST] Server ${serverID} -> ${clients.length} clients`);
    });
}, 30000);
