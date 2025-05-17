type MessageHandler = (message: any) => void;

class SocketProvider {
  private socket: WebSocket | null = null;
  private subscriptions: Record<string, Set<MessageHandler>> = {};
  private isConnecting: boolean = false;
  private retryCount: number = 0;
  private maxRetries: number = 5;
  private retryDelay: number = 2000;
  
  // Connect to the WebSocket server
  connect(): void {
    if (this.socket?.readyState === WebSocket.OPEN || this.isConnecting) {
      return;
    }
    
    this.isConnecting = true;
    
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    console.log(`Connecting to WebSocket at ${wsUrl}`);
    
    this.socket = new WebSocket(wsUrl);
    
    this.socket.onopen = () => {
      console.log("WebSocket connection established");
      this.isConnecting = false;
      this.retryCount = 0;
    };
    
    this.socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        this.handleMessage(message);
      } catch (error) {
        console.error("Error parsing WebSocket message:", error);
      }
    };
    
    this.socket.onclose = () => {
      console.log("WebSocket connection closed");
      this.socket = null;
      this.isConnecting = false;
      
      if (this.retryCount < this.maxRetries) {
        this.retryCount++;
        console.log(`Attempting to reconnect (${this.retryCount}/${this.maxRetries})...`);
        setTimeout(() => this.connect(), this.retryDelay);
      } else {
        console.error(`Failed to reconnect after ${this.maxRetries} attempts.`);
      }
    };
    
    this.socket.onerror = (error) => {
      console.error("WebSocket error:", error);
    };
  }
  
  // Disconnect from the WebSocket server
  disconnect(): void {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.close();
    }
  }
  
  // Send a message to the WebSocket server
  send(message: any): void {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message));
    } else {
      console.warn("Cannot send message: WebSocket is not connected");
      this.connect();
    }
  }
  
  // Subscribe to a specific message type
  subscribe(type: string, handler: MessageHandler): void {
    if (!this.subscriptions[type]) {
      this.subscriptions[type] = new Set();
    }
    
    this.subscriptions[type].add(handler);
  }
  
  // Unsubscribe from a specific message type
  unsubscribe(type: string, handler: MessageHandler): void {
    if (this.subscriptions[type]) {
      this.subscriptions[type].delete(handler);
    }
  }
  
  // Handle incoming messages
  private handleMessage(message: any): void {
    const { type } = message;
    
    // First handle specific type subscribers
    if (type && this.subscriptions[type]) {
      this.subscriptions[type].forEach(handler => {
        handler(message);
      });
    }
    
    // Then handle "all" subscribers who want all message types
    if (this.subscriptions["all"]) {
      this.subscriptions["all"].forEach(handler => {
        handler(message);
      });
    }
  }
}

// Export a singleton instance
export const socketProvider = new SocketProvider();

// Connect immediately when this module is imported
socketProvider.connect();