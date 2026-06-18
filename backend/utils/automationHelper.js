import AutoReply from "../models/AutoReply.js";
import Message from "../models/Message.js";
import Conversation from "../models/Conversation.js";
import { sendTextMessage, sendImageMessage } from "../services/whatsappService.js";
import Flow from "../models/Flow.js";
import { smartEmit } from "./socket.js";
import { normalizePhone } from "./phoneUtils.js";
import { generateAIResponse } from "../services/aiService.js";

// --- STRING SIMILARITY ALGORITHM (Levenshtein Distance) ---
export function getSimilarity(s1, s2) {
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

// --- KEYWORD MATCHING WITH NEGATION DETECTION ---
export function matchKeyword(text, keyword) {
  const cleanText = text.toLowerCase().trim();
  const cleanKeyword = keyword.toLowerCase().trim();
  
  if (cleanText === cleanKeyword) {
    return 1.0;
  }
  
  // Escape keyword for regex
  const escapedKeyword = cleanKeyword.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
  const wordRegex = new RegExp(`\\b${escapedKeyword}\\b`, "i");
  
  if (wordRegex.test(cleanText)) {
    const negationWords = ["not", "no", "don't", "dont", "never", "nahi", "nahin", "na", "mat", "gair"];
    
    // Check if the keyword itself contains/starts with any negation word
    const keywordHasNegation = negationWords.some(neg => 
      new RegExp(`\\b${neg}\\b`, "i").test(cleanKeyword)
    );
    
    if (!keywordHasNegation) {
      // Check for a negation word within 1-2 words before the keyword in text
      const negationRegex = new RegExp(`\\b(${negationWords.join("|")})\\b\\s+(?:\\w+\\s+)?${escapedKeyword}\\b`, "i");
      if (negationRegex.test(cleanText)) {
        return 0.0; // Negated, so not a match
      }
    }
    return 0.9;
  }
  
  // Fuzzy Match fallback
  const words = cleanText.split(/\s+/);
  const wordScores = words.map(word => getSimilarity(word, cleanKeyword));
  return Math.max(...wordScores, getSimilarity(cleanText, cleanKeyword));
}


export const processAutoReply = async (account, phone, incomingText, contact) => {
  try {
    const text = incomingText.toLowerCase().trim();
    console.log(`🔍 Automation Check: incomingText="${text}" | phone="${phone}" | accountId="${account?._id}"`);
    const autoReplies = await AutoReply.find({
      isActive: true,
      $or: [
        { whatsappAccountIds: { $size: 0 } }, // Global (if empty)
        { whatsappAccountIds: account?._id }   // Specific to this account
      ]
    });

    let bestMatch = null;
    let highestScore = 0;
    let bestMatchKeywordLength = 0;

    for (const ar of autoReplies) {
      const keyword = ar.keyword.toLowerCase();
      const currentScore = matchKeyword(text, keyword);

      if (currentScore > highestScore || (currentScore === highestScore && currentScore > 0 && keyword.length > bestMatchKeywordLength)) {
        highestScore = currentScore;
        bestMatch = ar;
        bestMatchKeywordLength = keyword.length;
      }
    }

    // --- 1. CHECK DYNAMIC FLOW TRIGGERS (Threshold 80%) ---
    // Moved this ABOVE active flow processing so a user can restart a flow by typing the trigger again
    const allFlows = await Flow.find({
      isActive: true,
      $or: [
        { whatsappAccountIds: { $size: 0 } },
        { whatsappAccountIds: account?._id }
      ]
    });
    let bestFlowMatch = null;
    let highestFlowScore = 0;
    let bestFlowKeywordLength = 0;
    let wildcardFlow = null;

    for (const flow of allFlows) {
      if (!flow.triggerKeyword) continue;
      const keywords = flow.triggerKeyword.toLowerCase().split(",").map(k => k.trim());
      for (const keyword of keywords) {
        if (keyword === "*") {
          wildcardFlow = flow;
          continue;
        }

        const score = matchKeyword(text, keyword);
        if (score > highestFlowScore || (score === highestFlowScore && score > 0 && keyword.length > bestFlowKeywordLength)) {
          highestFlowScore = score;
          bestFlowMatch = flow;
          bestFlowKeywordLength = keyword.length;
        }
      }
    }

    let triggeredFlow = null;
    if (bestFlowMatch && highestFlowScore >= 0.8) {
      triggeredFlow = bestFlowMatch;
    } else if (wildcardFlow && (!contact || !contact.activeFlowId)) {
      // Trigger wildcard flow only if a campaign was recently sent to this contact
      if (contact && contact.isCampaignSent) {
        triggeredFlow = wildcardFlow;
        highestFlowScore = 1.0;
      } else {
        console.log(`⏳ Wildcard Flow skipped because no new campaign has been sent to ${phone}`);
      }
    }

    if (triggeredFlow) {
      console.log(`🚀 Triggering Flow: ${triggeredFlow.name} (Score: ${highestFlowScore}) for ${phone}`);
      contact.activeFlowId = triggeredFlow._id;
      contact.currentStepIndex = 0; // ALWAYS START FROM BEGINNING
      contact.chatData = new Map(); // Reset data for new flow
      
      // Consume the campaign trigger if we are starting the wildcard flow
      if (triggeredFlow === wildcardFlow) {
        contact.isCampaignSent = false;
      }
      
      await contact.save();

      const firstQuestion = triggeredFlow.steps[0].question;
      const firstDelay = (triggeredFlow.steps[0].delay || 2) * 1000;
      return await sendDelayedMessage(account, phone, firstQuestion, contact, firstDelay);
    }

    // --- 2. IF ALREADY IN A FLOW AND NO NEW TRIGGER MATCHED, PROCESS THE STEP ---
    if (contact && contact.activeFlowId) {
      console.log(`🔄 Processing active flow step for ${phone}`);
      const flowResult = await processDynamicFlow(account, phone, text, contact);
      if (flowResult) return true;
    }

    if (!bestMatch || highestScore < 0.8) {
      // --- GEMINI AI FALLBACK RESPONDER ---
      const aiReply = await generateAIResponse(incomingText, contact);
      if (aiReply) {
        console.log(`🤖 Gemini AI responding: "${aiReply}"`);
        return await sendDelayedMessage(account, phone, aiReply, contact, 1000);
      }
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
    if (bestMatch.replies && bestMatch.replies.length > 0) {
      let currentCumulativeDelay = 0;
      for (const reply of bestMatch.replies) {
        currentCumulativeDelay += (reply.delay || 0) * 1000;
        await sendSingleAutoReplyMessage(account, phone, reply, contact, currentCumulativeDelay);
      }
      return true;
    } else {
      const delayMs = (bestMatch.delay || 0) * 1000;
      return await sendDelayedMessage(account, phone, bestMatch.response, contact, delayMs);
    }
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

      const normalizedPhone = normalizePhone(phone);
      const updatedConv = await Conversation.findOneAndUpdate(
        { phone: normalizedPhone, $or: [{ whatsappAccountId: account?._id }, { whatsappAccountId: null }] },
        {
          whatsappAccountId: account?._id,
          lastMessage: text,
          lastMessageTime: new Date()
        },
        { new: true, upsert: true, sort: { lastMessageTime: -1 } }
      ).populate("contact");

      smartEmit("new_message", { message: newMessage, conversation: updatedConv });
    } catch (err) {
      console.error("Automation delay error:", err);
    }
  }, delayMs);
  return true;
}

/**
 * Helper to send a single auto-reply message (text, image, or linked quick reply) with a delay
 */
async function sendSingleAutoReplyMessage(account, phone, reply, contact, delayMs) {
  setTimeout(async () => {
    try {
      let metaRes = null;
      let textToSend = "";
      let mediaUrlToSend = "";
      let type = reply.type || "text";

      if (type === "text") {
        textToSend = reply.text;
        metaRes = await sendTextMessage(account, phone, textToSend);
      } else if (type === "image") {
        textToSend = reply.text || ""; // Caption
        mediaUrlToSend = reply.mediaUrl;
        metaRes = await sendImageMessage(account, phone, mediaUrlToSend, textToSend);
      } else if (type === "quick_reply") {
        const QuickReply = (await import("../models/QuickReply.js")).default;
        const qr = await QuickReply.findById(reply.quickReplyId);
        if (qr) {
          textToSend = qr.content || "";
          mediaUrlToSend = qr.mediaUrl || "";
          if (mediaUrlToSend) {
            type = "image";
            metaRes = await sendImageMessage(account, phone, mediaUrlToSend, textToSend);
          } else {
            type = "text";
            metaRes = await sendTextMessage(account, phone, textToSend);
          }
        } else {
          console.warn(`⚠️ QuickReply with ID ${reply.quickReplyId} not found`);
          return;
        }
      }

      const messageId = metaRes?.messages?.[0]?.id;

      const newMessage = new Message({
        messageId,
        from: "me",
        to: phone,
        body: textToSend || `Sent ${type}`,
        mediaUrl: mediaUrlToSend || undefined,
        type: type,
        direction: "outbound",
        status: "sent",
        isAutomated: true,
        whatsappAccountId: account?._id
      });
      await newMessage.save();

      const normalizedPhone = normalizePhone(phone);
      const updatedConv = await Conversation.findOneAndUpdate(
        { phone: normalizedPhone, $or: [{ whatsappAccountId: account?._id }, { whatsappAccountId: null }] },
        {
          whatsappAccountId: account?._id,
          lastMessage: textToSend || `Sent ${type}`,
          lastMessageTime: new Date()
        },
        { new: true, upsert: true, sort: { lastMessageTime: -1 } }
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
/**
 * Helper to replace placeholders in a string (supports both {field} and {{field}})
 */
function replacePlaceholders(str, chatData) {
  if (!str) return str;
  let result = str;
  if (chatData && chatData.size > 0) {
    chatData.forEach((value, key) => {
      const placeholder2 = new RegExp(`{{${key}}}`, "gi");
      const placeholder1 = new RegExp(`{${key}}`, "gi");
      result = result.replace(placeholder2, value).replace(placeholder1, value);
    });
  }
  return result;
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

  if (!currentStep) {
    contact.activeFlowId = null;
    contact.currentStepIndex = 0;
    await contact.save();
    return false;
  }

  // 1. Save the user's response to the current step's field
  if (!contact.chatData) contact.chatData = new Map();
  if (!contact.customFields) contact.customFields = new Map();

  // Save to specialized field if it's name
  if (currentStep.saveToField === "name") {
    contact.name = text;
  }

  // Always save to chatData for variable interpolation
  contact.chatData.set(currentStep.saveToField, text);
  contact.markModified("chatData");

  // Save to customFields so it shows in the sidebar automatically
  contact.customFields.set(currentStep.saveToField, text);
  contact.markModified("customFields");
  await contact.save();

  // 2. Determine next action (if branching options exist)
  let matchedOption = null;
  if (currentStep.type === "options" && currentStep.options && currentStep.options.length > 0) {
    const cleanInput = text.toLowerCase().trim();
    let highestOptionScore = 0;
    let bestOptionKeywordLength = 0;

    for (const option of currentStep.options) {
      if (!option.keywords) continue;
      const keywords = option.keywords.toLowerCase().split(",").map(k => k.trim());
      for (const keyword of keywords) {
        const score = matchKeyword(cleanInput, keyword);
        if (score >= 0.8) {
          if (score > highestOptionScore || (score === highestOptionScore && keyword.length > bestOptionKeywordLength)) {
            highestOptionScore = score;
            matchedOption = option;
            bestOptionKeywordLength = keyword.length;
          }
        }
      }
    }

    if (!matchedOption) {
      // Re-send current question (or validation error) to avoid getting stuck
      const repeatedQuestion = replacePlaceholders(currentStep.question, contact.chatData);
      await sendDelayedMessage(account, phone, "Vikalp sahi nahi hai. Kripya fir se koshish karein:\n\n" + repeatedQuestion, contact, 1000);
      return true;
    }
  }

  // Helper to send flow success message
  const endFlow = async (successMsg, delayMs = 2000) => {
    let msg = successMsg || flow.successMessage || "Dhanyawad! Aapki saari details save ho gayi hain. 🙏";
    msg = replacePlaceholders(msg, contact.chatData);
    contact.activeFlowId = null;
    contact.currentStepIndex = 0;
    contact.lastFlowEndedAt = new Date();
    await contact.save();
    return await sendDelayedMessage(account, phone, msg, contact, delayMs);
  };

  // Helper to trigger another flow
  const triggerAnotherFlow = async (nextFlowId, delayMs = 2000) => {
    const nextFlow = await Flow.findById(nextFlowId);
    if (!nextFlow || !nextFlow.steps || nextFlow.steps.length === 0) {
      return await endFlow();
    }
    contact.activeFlowId = nextFlow._id;
    contact.currentStepIndex = 0;
    await contact.save();

    const firstQuestion = replacePlaceholders(nextFlow.steps[0].question, contact.chatData);
    const firstDelay = (nextFlow.steps[0].delay || 2) * 1000 + delayMs;
    return await sendDelayedMessage(account, phone, firstQuestion, contact, firstDelay);
  };

  // Process the matched option action or the default linear flow
  if (matchedOption) {
    // If there is reply text for this specific option, send it
    let optionDelay = 0;
    if (matchedOption.replyText) {
      const replyToSend = replacePlaceholders(matchedOption.replyText, contact.chatData);
      await sendDelayedMessage(account, phone, replyToSend, contact, 1000);
      optionDelay = 2000; // Shift subsequent messages
    }

    if (matchedOption.action === "end") {
      return await endFlow(null, optionDelay || 2000);
    } else if (matchedOption.action === "trigger_flow") {
      return await triggerAnotherFlow(matchedOption.nextFlowId, optionDelay);
    } else if (matchedOption.action === "jump") {
      const nextIndex = matchedOption.nextStepIndex;
      if (nextIndex >= 0 && nextIndex < flow.steps.length) {
        contact.currentStepIndex = nextIndex;
        await contact.save();
        const nextQuestion = replacePlaceholders(flow.steps[nextIndex].question, contact.chatData);
        const nextDelay = (flow.steps[nextIndex].delay || 2) * 1000 + optionDelay;
        return await sendDelayedMessage(account, phone, nextQuestion, contact, nextDelay);
      } else {
        return await endFlow(null, optionDelay || 2000);
      }
    }
  }

  // Default flow behavior (continue to next step)
  const nextIndex = currentIndex + 1;
  if (nextIndex < flow.steps.length) {
    contact.currentStepIndex = nextIndex;
    await contact.save();
    const nextQuestion = replacePlaceholders(flow.steps[nextIndex].question, contact.chatData);
    const nextDelay = (flow.steps[nextIndex].delay || 2) * 1000;
    return await sendDelayedMessage(account, phone, nextQuestion, contact, nextDelay);
  } else {
    return await endFlow();
  }
}
