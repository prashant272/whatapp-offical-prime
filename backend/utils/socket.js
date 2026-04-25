import { Server } from "socket.io";

let io;

export const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: "*", // Adjust this in production for security
      methods: ["GET", "POST"]
    }
  });

  io.on("connection", (socket) => {
    const { userId, role } = socket.handshake.query;
    console.log(`🔌 New client connected: ${socket.id} (User: ${userId}, Role: ${role})`);
    
    if (userId) socket.join(`user_${userId}`);
    if (role) socket.join(`role_${role}`);

    socket.on("disconnect", () => {
      console.log("🔌 Client disconnected:", socket.id);
    });
  });

  return io;
};

export const getIO = () => {
  if (!io) {
    throw new Error("Socket.io not initialized!");
  }
  return io;
};

/**
 * Smartly emits messages only to relevant users:
 * - Always to Admins
 * - To the specific Executive assigned to the conversation (if any)
 */
export const smartEmit = (eventName, data) => {
  if (!io) return;
  const { conversation } = data;

  // 1. Always emit to Admins
  io.to("role_Admin").emit(eventName, data);

  // 2. If assigned, emit to the specific user room
  if (conversation && conversation.assignedTo) {
    const assignedId = typeof conversation.assignedTo === "object" 
      ? conversation.assignedTo._id 
      : conversation.assignedTo;
    
    io.to(`user_${assignedId}`).emit(eventName, data);
  }
};
