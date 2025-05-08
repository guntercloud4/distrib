import { Server as HttpServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { WebSocketMessage } from "@shared/schema";

// Create a WebSocket server instance
let wss: WebSocketServer;

// Store connected clients
const clients: WebSocket[] = [];

// Setup WebSocket server
export function setupWebSocketServer(server: HttpServer) {
  wss = new WebSocketServer({ server, path: '/ws' });
  
  wss.on('connection', (ws) => {
    // Add client to the list
    clients.push(ws);
    
    // Send initial ping to check connection
    ws.send(JSON.stringify({ type: 'PING', data: { message: 'Connected to Yearbook Distribution System' } }));
    
    // Listen for messages from client
    ws.on('message', (message) => {
      try {
        // Parse the incoming message
        const parsedMessage = JSON.parse(message.toString()) as WebSocketMessage;
        
        // Broadcast the message to all clients
        broadcastMessage(parsedMessage);
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    });
    
    // Handle client disconnect
    ws.on('close', () => {
      const index = clients.indexOf(ws);
      if (index !== -1) {
        clients.splice(index, 1);
      }
    });
  });
}

// Function to broadcast a message to all connected clients
export function broadcastMessage(message: WebSocketMessage) {
  const messageStr = JSON.stringify(message);
  
  clients.forEach((client) => {
    // Only send if the client is still connected
    if (client.readyState === WebSocket.OPEN) {
      client.send(messageStr);
    }
  });
}
