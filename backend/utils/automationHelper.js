import AutoReply from "../models/AutoReply.js";
import Message from "../models/Message.js";
import Conversation from "../models/Conversation.js";
import { sendTextMessage } from "../services/whatsappService.js";
import { smartEmit } from "./socket.js";

// --- STRING SIMILARITY ALGORITHM (Levenshtein Distance) ---
function getSimilarity(s1, s2) {
  let longer = s1.toLowerCase();
  let shorter = s2.toLowerCase();
  if (s1.length < s2.length) {
    longer = s2.toLowerCase();
    shorter = s1.toLowerCase();
  }
  let longerLength = longer.length;
  if (longerLength === 0) return 1.0;
  
  const editDistance = (s1, s2) => {
    const costs = [];
    for (let i = 0; i <= s1.length; i++) {
      let lastValue = i;
      for (let j = 0; j <= s2.length; j++) {
        if (i === 0) costs[j] = j;
        else {
          if (j > 0) {
            let newValue = costs[j - 1];
            if (s1.charAt(i - 1) !== s2.charAt(j - 1))
              newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
            costs[j - 1] = lastValue;
            lastValue = newValue;
          }
        }
      }
      if (i > 0) costs[s2.length] = lastValue;
    }
    return costs[s2.length];
  };

  return (longerLength - editDistance(longer, shorter)) / parseFloat(longerLength);
}

export const processAutoReply = async (phone, incomingText) => {
  try {
    const text = incomingText.toLowerCase().trim();
    const autoReplies = await AutoReply.find({ isActive: true });
    
    let bestMatch = null;
    let highestScore = 0;

    for (const ar of autoReplies) {
      let currentScore = 0;
      const keyword = ar.keyword.toLowerCase();

      // 1. Check Exact or Contains (High weights)
      if (text === keyword) {
        currentScore = 1.0;
      } else if (text.includes(keyword)) {
        // Boost score if keyword is a major part of the message
        currentScore = Math.max(0.8, keyword.length / text.length);
      } else {
        // 2. Fuzzy Match (Similarity score)
        // We check similarity of the keyword against each word in the message
        const words = text.split(/\s+/);
        const wordScores = words.map(word => getSimilarity(word, keyword));
        currentScore = Math.max(...wordScores);
      }

      if (currentScore > highestScore) {
        highestScore = currentScore;
        bestMatch = ar;
      }
    }

    // Only trigger if match is >= 50%
    if (!bestMatch || highestScore < 0.5) {
      console.log(`🤖 Automation: No strong match found (Best score: ${highestScore.toFixed(2)})`);
      return false;
    }

    console.log(`🤖 Automation Match Found! Keyword: "${bestMatch.keyword}", Score: ${highestScore.toFixed(2)}, Replying: "${bestMatch.response}"`);

    // 2. Send the automated message via Meta
    const metaRes = await sendTextMessage(phone, bestMatch.response);
    const messageId = metaRes.messages?.[0]?.id;

    // 3. Save as outbound message in DB
    const newMessage = new Message({
      messageId,
      from: "me",
      to: phone,
      body: bestMatch.response,
      direction: "outbound",
      status: "sent",
      isAutomated: true
    });
    await newMessage.save();

    // 4. Update Conversation
    const updatedConv = await Conversation.findOneAndUpdate(
      { phone },
      { 
        lastMessage: bestMatch.response, 
        lastMessageTime: new Date(),
        unreadCount: 0 
      },
      { new: true }
    ).populate("contact");

    // 5. Emit via socket
    smartEmit("new_message", { message: newMessage, conversation: updatedConv });

    // 6. Update usage count
    bestMatch.useCount += 1;
    await bestMatch.save();

    return true;
  } catch (error) {
    console.error("❌ Automation processing error:", error);
    return false;
  }
};
