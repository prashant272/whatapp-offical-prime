import AutoReply from "../models/AutoReply.js";
import Message from "../models/Message.js";
import Conversation from "../models/Conversation.js";
import { sendTextMessage } from "../services/whatsappService.js";
import Flow from "../models/Flow.js";
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

export const processAutoReply = async (account, phone, incomingText, contact) => {
  try {
    const text = incomingText.toLowerCase().trim();
    console.log(`🔍 Automation Check: incomingText="${text}" | phone="${phone}"`);
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
        currentScore = Math.max(0.8, keyword.length / text.length);
      } else {
        // 2. Fuzzy Match
        const words = text.split(/\s+/);
        const wordScores = words.map(word => getSimilarity(word, keyword));
        currentScore = Math.max(...wordScores);
      }

      if (currentScore > highestScore) {
        highestScore = currentScore;
        bestMatch = ar;
      }
    }

    // --- 1. IF ALREADY IN A FLOW, PROCESS THE STEP FIRST ---
    if (contact && contact.activeFlowId) {
      console.log(`🔄 Processing active flow step for ${phone}`);
      const flowResult = await processDynamicFlow(account, phone, text, contact);
      if (flowResult) return true;
    }

    // --- 2. CHECK DYNAMIC FLOW TRIGGERS (Fuzzy Match 60%) ---
    const allFlows = await Flow.find({ isActive: true });
    let bestFlowMatch = null;
    let highestFlowScore = 0;

    for (const flow of allFlows) {
      const score = getSimilarity(text, flow.triggerKeyword);
      if (score > highestFlowScore) {
        highestFlowScore = score;
        bestFlowMatch = flow;
      }
    }

    if (bestFlowMatch && highestFlowScore >= 0.6) {
      console.log(`🚀 Starting Flow: ${bestFlowMatch.name} (Score: ${highestFlowScore}) for ${phone}`);
      contact.activeFlowId = bestFlowMatch._id;
      contact.currentStepIndex = 0;
      contact.chatData = new Map(); // Reset data for new flow
      await contact.save();
      
      const firstQuestion = bestFlowMatch.steps[0].question;
      const firstDelay = (bestFlowMatch.steps[0].delay || 2) * 1000;
      return await sendDelayedMessage(account, phone, firstQuestion, contact, firstDelay);
    }

    if (!bestMatch || highestScore < 0.5) {
      return false;
    }

    console.log(`🤖 Automation: Keyword Match! [${bestMatch.keyword}]`);

    // --- TRIGGER STAGE FLOW VIA KEYWORD ---
    // If the keyword matched is "register" or "start", we trigger the stage-based flow.
    if (bestMatch.keyword.toLowerCase() === "register" || bestMatch.keyword.toLowerCase() === "start") {
      contact.chatStage = "AWAITING_NAME";
      await contact.save();
    }

    // --- DELAY LOGIC ---
    const delayMs = (bestMatch.delay || 0) * 1000;
    return await sendDelayedMessage(account, phone, bestMatch.response, contact, delayMs);
  } catch (error) {
    console.error("❌ Automation processing error:", error);
    return false;
  }
};

/**
 * Helper to send messages with a delay and handle DB updates
 */
async function sendDelayedMessage(account, phone, text, contact, delayMs) {
  setTimeout(async () => {
    try {
      const metaRes = await sendTextMessage(account, phone, text);
      const messageId = metaRes.messages?.[0]?.id;

      const newMessage = new Message({
        messageId,
        from: "me",
        to: phone,
        body: text,
        direction: "outbound",
        status: "sent",
        isAutomated: true,
        whatsappAccountId: account?._id
      });
      await newMessage.save();

      const normalizedPhone = phone.toString().replace(/\D/g, "");
      const updatedConv = await Conversation.findOneAndUpdate(
        { phone: normalizedPhone, $or: [{ whatsappAccountId: account?._id }, { whatsappAccountId: null }] },
        { 
          whatsappAccountId: account?._id,
          lastMessage: text, 
          lastMessageTime: new Date(),
          unreadCount: 0 
        },
        { new: true, upsert: true }
      ).populate("contact");

      smartEmit("new_message", { message: newMessage, conversation: updatedConv });
    } catch (err) {
      console.error("Automation delay error:", err);
    }
  }, delayMs);
  return true;
}

/**
 * Logic for Dynamic Flows
 */
async function processDynamicFlow(account, phone, text, contact) {
  const flow = await Flow.findById(contact.activeFlowId);
  if (!flow) {
    contact.activeFlowId = null;
    await contact.save();
    return false;
  }

  const currentIndex = contact.currentStepIndex;
  const currentStep = flow.steps[currentIndex];

  // 1. Save the user's response to the current step's field
  if (!contact.chatData) contact.chatData = new Map();
  
  // Save to specialized field if it's name
  if (currentStep.saveToField === "name") {
    contact.name = text;
  }
  
  // Always save to chatData for variable interpolation {{field}}
  contact.chatData.set(currentStep.saveToField, text);
  
  // CRITICAL: Mongoose doesn't auto-detect Map changes, we must mark it as modified!
  contact.markModified("chatData");
  await contact.save();

  // 2. Move to next step
  const nextIndex = currentIndex + 1;
  if (nextIndex < flow.steps.length) {
    let nextQuestion = flow.steps[nextIndex].question;
    const nextDelay = (flow.steps[nextIndex].delay || 2) * 1000;

    // --- DYNAMIC VARIABLE REPLACEMENT ---
    // Replace {{field}} with actual data from contact.chatData
    if (contact.chatData && contact.chatData.size > 0) {
      contact.chatData.forEach((value, key) => {
        const placeholder = new RegExp(`{{${key}}}`, "gi"); // 'i' for case-insensitive
        nextQuestion = nextQuestion.replace(placeholder, value);
      });
    }

    contact.currentStepIndex = nextIndex;
    await contact.save();
    return await sendDelayedMessage(account, phone, nextQuestion, contact, nextDelay);
  } else {
    // Flow complete
    let msg = flow.successMessage || "Dhanyawad! Aapki saari details save ho gayi hain. 🙏";
    
    // Also replace variables in success message
    if (contact.chatData && contact.chatData.size > 0) {
      contact.chatData.forEach((value, key) => {
        const placeholder = new RegExp(`{{${key}}}`, "gi");
        msg = msg.replace(placeholder, value);
      });
    }

    contact.activeFlowId = null;
    contact.currentStepIndex = 0;
    await contact.save();
    return await sendDelayedMessage(account, phone, msg, contact, 2000);
  }
}
