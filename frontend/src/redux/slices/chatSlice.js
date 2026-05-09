import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import api from "../../api";

export const fetchMessages = createAsyncThunk(
  "chat/fetchMessages",
  async ({ phone, page, accountId }, { rejectWithValue }) => {
    try {
      const res = await api.get(`/messages/${phone}?page=${page}&limit=20`, {
        headers: { "x-whatsapp-account-id": accountId }
      });
      return { messages: res.data.messages, hasMore: res.data.hasMore, page };
    } catch (err) {
      return rejectWithValue(err.response?.data || err.message);
    }
  }
);

export const fetchConversations = createAsyncThunk(
  "chat/fetchConversations",
  async ({ cursor, status, assignedTo, sector, search, accountIds }, { rejectWithValue }) => {
    try {
      const res = await api.get(`/conversations`, {
        params: { limit: 20, status, assignedTo, sector, search, cursor },
        headers: { "x-whatsapp-account-id": accountIds }
      });
      return res.data;
    } catch (err) {
      return rejectWithValue(err.response?.data || err.message);
    }
  }
);

export const sendMessage = createAsyncThunk(
  "chat/sendMessage",
  async ({ to, body, accountId }, { rejectWithValue }) => {
    try {
      const res = await api.post("/messages/send", { to, body }, {
        headers: { "x-whatsapp-account-id": accountId }
      });
      return res.data.message;
    } catch (err) {
      return rejectWithValue(err.response?.data || err.message);
    }
  }
);

export const sendImage = createAsyncThunk(
  "chat/sendImage",
  async ({ to, imageUrl, caption, accountId }, { rejectWithValue }) => {
    try {
      const res = await api.post("/messages/send-image", { to, imageUrl, caption }, {
        headers: { "x-whatsapp-account-id": accountId }
      });
      return res.data.message;
    } catch (err) {
      return rejectWithValue(err.response?.data || err.message);
    }
  }
);

export const updateConversationStatus = createAsyncThunk(
  "chat/updateStatus",
  async ({ conversationId, status, followUpTime, followUpActivity, accountId }, { rejectWithValue }) => {
    try {
      const res = await api.put(`/conversations/${conversationId}/status`, { 
        status, followUpTime, followUpActivity 
      }, {
        headers: { "x-whatsapp-account-id": accountId }
      });
      return res.data.conversation;
    } catch (err) {
      return rejectWithValue(err.response?.data || err.message);
    }
  }
);

const initialState = {
  filter: "all",
  statusFilter: "all",
  sectorFilter: "all",
  userFilter: "all",
  searchQuery: "",
  selectedAccountIds: [],
  activeChat: null,
  messages: [],
  hasMoreMsgs: true,
  msgPage: 1,
  isFetchingMsgs: false,
};

const chatSlice = createSlice({
  name: "chat",
  initialState,
  reducers: {
    setFilter: (state, action) => {
      state.filter = action.payload;
    },
    setStatusFilter: (state, action) => {
      state.statusFilter = action.payload;
    },
    setSectorFilter: (state, action) => {
      state.sectorFilter = action.payload;
    },
    setUserFilter: (state, action) => {
      state.userFilter = action.payload;
    },
    setSearchQuery: (state, action) => {
      state.searchQuery = action.payload;
    },
    setSelectedAccountIds: (state, action) => {
      state.selectedAccountIds = action.payload;
    },
    setActiveChat: (state, action) => {
      state.activeChat = action.payload;
      state.messages = []; // Clear messages when switching chat
      state.msgPage = 1;
      state.hasMoreMsgs = true;
    },
    addMessage: (state, action) => {
      const message = action.payload;
      const exists = state.messages.find(m => m._id === message._id || (m.messageId && m.messageId === message.messageId));
      if (!exists) {
        state.messages.push(message);
      }
    },
    updateMessageStatus: (state, action) => {
      const { tempId, realMsg, messageId, status } = action.payload;
      if (tempId) {
        const existingRealMsgIndex = state.messages.findIndex(m => m._id === realMsg._id || (m.messageId && m.messageId === realMsg.messageId));
        const tempIndex = state.messages.findIndex(m => m._id === tempId);
        
        if (existingRealMsgIndex !== -1 && existingRealMsgIndex !== tempIndex) {
          // The socket already added the real message, so just remove the temp one
          if (tempIndex !== -1) {
            state.messages.splice(tempIndex, 1);
          }
        } else if (tempIndex !== -1) {
          // Replace temp with real
          state.messages[tempIndex] = realMsg;
        }
      } else if (messageId) {
        const index = state.messages.findIndex(m => m.messageId === messageId);
        if (index !== -1) {
          if (state.messages[index]) state.messages[index].status = status;
        }
      }
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchMessages.pending, (state) => {
        state.isFetchingMsgs = true;
      })
      .addCase(fetchMessages.fulfilled, (state, action) => {
        const { messages, hasMore, page } = action.payload;
        if (page === 1) {
          state.messages = messages;
        } else {
          state.messages = [...messages, ...state.messages];
        }
        state.hasMoreMsgs = hasMore;
        state.msgPage = page;
        state.isFetchingMsgs = false;
      })
      .addCase(fetchMessages.rejected, (state) => {
        state.isFetchingMsgs = false;
      });
  }
});

export const {
  setFilter,
  setStatusFilter,
  setSectorFilter,
  setUserFilter,
  setSearchQuery,
  setSelectedAccountIds,
  setActiveChat,
  addMessage,
  updateMessageStatus
} = chatSlice.actions;

export default chatSlice.reducer;
