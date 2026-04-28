# WhatsApp Official Prime - Automation System

Welcome to the **WhatsApp Official Prime** project! This is a comprehensive, production-ready WhatsApp communication platform built with a Node.js backend and a React.js frontend. 

It is designed to automate customer engagement, track conversations, run mass messaging campaigns, and provide real-time chatbot and follow-up capabilities.

## 🚀 Key Features

### 1. Real-time Chat Dashboard
- Real-time synchronization using **Socket.io**.
- Instantly view inbound messages without refreshing the page.
- Ability to manually reply, assign tags, and change customer statuses right from the UI.
- Support for sending text, images (Cloudinary integration), and approved WhatsApp templates.

### 2. Follow-up Automation Engine (Cron Job)
- The core of the automated engagement system.
- Runs every single minute in the background (`node-cron`).
- Automatically scans the database for customers whose "Status" matches a predefined rule (e.g., "Interested").
- Sends scheduled follow-up messages automatically exactly when the required time (Delay Days/Hours/Minutes) has passed.
- **Account-Aware**: It dynamically identifies which WhatsApp account (if you have multiple) the customer belongs to, and sends the follow-up strictly from that specific account.

### 3. AutoReply System (Keyword Webhook Automation)
- Handles instant replies to incoming customer messages.
- Powered by Meta's official Webhook APIs.
- When a customer types a specific keyword (like "Yes", "No", or "Price"), the system instantly triggers a matching response.
- Fully supports "Exact Match" or "Contains" logic.

### 4. Bulk Campaigns
- Easily run mass outreach campaigns to imported contact lists or CSVs.
- Includes pacing/delay mechanisms (e.g., 2-second delays between messages) to ensure compliance with WhatsApp's rate-limiting policies and avoid account bans.

## 📂 Project Structure

### Backend (Node.js/Express)
- `/backend/server.js`: The main entry point. Sets up Express, connects to MongoDB, and starts the Socket.io server.
- `/backend/utils/automationCron.js`: The global background worker that executes Follow-up rules every minute.
- `/backend/controllers/webhookController.js`: Listens to incoming messages from Meta (WhatsApp Cloud API) and triggers instant auto-replies.
- `/backend/controllers/chatController.js`: Manages manual conversations, marking messages as read, and claiming legacy contacts when their status is changed.
- `/backend/services/whatsappService.js`: Contains all the raw Axios API calls to the official Meta WhatsApp Cloud API to send text, media, and templates.

### Frontend (React/Vite)
- `/frontend/src/components/ChatModule.jsx`: The beautiful, WhatsApp-like real-time chat interface.
- `/frontend/src/components/FollowUpAutomation.jsx`: The dashboard where you can create dynamic status-based follow-up rules.
- `/frontend/src/components/AutoReplyManager.jsx`: The dashboard for creating instant keyword-based auto-replies.

## 🛠️ Tech Stack
- **Database**: MongoDB (Mongoose)
- **Backend**: Node.js, Express, Socket.io, Node-Cron
- **Frontend**: React (Vite), Axios, Tailwind CSS (or standard CSS), Lucide React Icons
- **APIs**: Meta WhatsApp Cloud API (v20.0), Cloudinary (for media uploads)

## 🔑 Environment Variables (.env)
You will need an environment file in both `backend` and `frontend`. 
- **Backend**: Requires `MONGODB_URI`, `PORT`, `FRONTEND_URL`, `CLOUDINARY_*` keys, and `WHATSAPP_TOKEN` (if not pulled dynamically).
- **Frontend**: Requires `VITE_API_URL` to point to the backend server.

## 🏃 How to Run Locally

1. Open two terminals.
2. **Terminal 1 (Backend)**: 
   ```bash
   cd backend
   npm install
   node server.js
   ```
3. **Terminal 2 (Frontend)**:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
4. Access the portal at `http://localhost:5173`.
