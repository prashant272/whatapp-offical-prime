import React, { useState, useEffect, useRef, useContext } from 'react';
import { 
  View, 
  Text, 
  FlatList, 
  TextInput, 
  TouchableOpacity, 
  KeyboardAvoidingView, 
  Platform, 
  StyleSheet, 
  ActivityIndicator,
  StatusBar,
  Modal,
  Clipboard,
  Alert,
  Image
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Send, ArrowLeft, Phone, Video, MoreVertical, Paperclip, Zap, X, CornerUpLeft, Copy, Camera, Image as ImageIcon, FileText } from 'lucide-react-native';
import io from 'socket.io-client';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import api, { API_URL } from '../api';
import { AuthContext } from '../context/AuthContext';
import MessageBubble from '../components/MessageBubble';

export default function ChatAreaScreen({ route, navigation }) {
  const { conversation } = route.params;
  const { user } = useContext(AuthContext);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const socketRef = useRef(null);

  // 24-hour window states
  const [timeLeftStr, setTimeLeftStr] = useState('Calculating...');
  const [isExpired, setIsExpired] = useState(false);

  // Quick Replies states
  const [quickReplies, setQuickReplies] = useState([]);
  const [quickRepliesModalVisible, setQuickRepliesModalVisible] = useState(false);
  const [quickReplySearch, setQuickReplySearch] = useState('');

  // Long press / Action states
  const [selectedMsgForAction, setSelectedMsgForAction] = useState(null);
  const [replyingTo, setReplyingTo] = useState(null);

  // Media options state
  const [mediaOptionsVisible, setMediaOptionsVisible] = useState(false);

  const displayName = conversation.contact?.name || conversation.phone || 'Contact';

  // Mark conversation as read
  const markRead = async () => {
    try {
      await api.post('/conversations/mark-read', { phone: conversation.phone }, {
        headers: { 'x-whatsapp-account-id': conversation.whatsappAccountId }
      });
    } catch (err) {
      console.error('Failed to mark as read:', err);
    }
  };

  // Fetch quick replies
  const fetchQuickReplies = async () => {
    try {
      const res = await api.get('/quick-replies', {
        headers: { 'x-whatsapp-account-id': conversation.whatsappAccountId }
      });
      setQuickReplies(res.data || []);
    } catch (err) {
      console.error('Failed to fetch quick replies:', err);
    }
  };

  // Fetch messages from API
  const fetchMessages = async (pageNum = 1) => {
    try {
      if (pageNum === 1) setLoading(true);
      else setLoadingMore(true);

      const res = await api.get(`/messages/${conversation.phone}`, {
        params: { page: pageNum, limit: 30 },
        headers: { 'x-whatsapp-account-id': conversation.whatsappAccountId }
      });
      const msgs = res.data.messages || [];
      const incomingHasMore = res.data.hasMore ?? (msgs.length === 30);

      const reversed = [...msgs].reverse();
      if (pageNum === 1) {
        setMessages(reversed);
      } else {
        setMessages(prev => [...prev, ...reversed]);
      }
      setHasMore(incomingHasMore);
      setPage(pageNum);
    } catch (err) {
      console.error('Error fetching messages:', err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  // 24-hour countdown logic
  useEffect(() => {
    const lastCustomerMessageAt = conversation.lastCustomerMessageAt;
    if (!lastCustomerMessageAt) {
      setTimeLeftStr('No messages from customer');
      setIsExpired(true);
      return;
    }

    const updateTimer = () => {
      const lastMsgTime = new Date(lastCustomerMessageAt).getTime();
      const now = Date.now();
      const twentyFourHours = 24 * 60 * 60 * 1000;
      const diff = lastMsgTime + twentyFourHours - now;

      if (diff <= 0) {
        setTimeLeftStr('Expired');
        setIsExpired(true);
      } else {
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        setTimeLeftStr(`${hours}h ${minutes}m ${seconds}s left`);
        setIsExpired(false);
      }
    };

    updateTimer();
    const intervalId = setInterval(updateTimer, 1000);
    return () => clearInterval(intervalId);
  }, [conversation.lastCustomerMessageAt]);

  useEffect(() => {
    fetchMessages(1);
    fetchQuickReplies();
    markRead();

    // Socket.io initialization
    const socketServerUrl = API_URL.replace('/api', '');
    socketRef.current = io(socketServerUrl, {
      query: {
        userId: user?._id || '',
        role: user?.role || ''
      }
    });

    socketRef.current.on('connect', () => {
      console.log('Socket connected to mobile app');
    });

    socketRef.current.on('connect_error', (err) => {
      console.log('Socket connection error in mobile app:', err.message);
    });

    // Listen for new messages
    socketRef.current.on('new_message', (data) => {
      console.log('Mobile socket received new_message event:', JSON.stringify(data));
      const msg = data?.message;
      if (msg) {
        const clean = (p) => {
          const digits = String(p || '').replace(/\D/g, '');
          return digits.length >= 10 ? digits.slice(-10) : digits;
        };
        const cPhone = clean(conversation.phone);
        const mFrom = clean(msg.from);
        const mTo = clean(msg.to);
        
        console.log(`Comparing msg from: ${msg.from} (${mFrom}) / to: ${msg.to} (${mTo}) with conversation phone: ${conversation.phone} (${cPhone})`);
        
        if (mFrom === cPhone || mTo === cPhone) {
          console.log('Match found! Appending message to state.');
          setMessages((prev) => {
            if (prev.some(m => m.messageId === msg.messageId)) return prev;
            return [msg, ...prev];
          });
          markRead();
        } else {
          console.log('No phone number match for this active conversation.');
        }
      }
    });

    // Listen for reactions
    socketRef.current.on('message_reaction', ({ messageId, reaction }) => {
      setMessages((prev) => 
        prev.map(m => m.messageId === messageId ? { ...m, reaction } : m)
      );
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [conversation.phone, user]);

  const handleSend = async () => {
    if (!newMessage.trim()) return;
    setSending(true);
    const bodyText = newMessage;
    setNewMessage('');
    const quoteId = replyingTo?.messageId;
    setReplyingTo(null);

    try {
      const res = await api.post('/messages/send', {
        to: conversation.phone,
        body: bodyText,
        conversationId: conversation._id,
        quotedMessageId: quoteId
      }, {
        headers: { 'x-whatsapp-account-id': conversation.whatsappAccountId }
      });
      if (res.data.success && res.data.message) {
        const returnedMsg = res.data.message;
        setMessages((prev) => {
          if (prev.some(m => m.messageId === returnedMsg.messageId)) return prev;
          return [returnedMsg, ...prev];
        });
      }
    } catch (err) {
      console.error('Error sending message:', err);
    } finally {
      setSending(false);
    }
  };

  const uploadFile = async (uri, name, type) => {
    const formData = new FormData();
    formData.append('file', {
      uri: Platform.OS === 'ios' ? uri.replace('file://', '') : uri,
      name: name || 'file.jpg',
      type: type || 'image/jpeg',
    });

    const res = await api.post('/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
        'x-whatsapp-account-id': conversation.whatsappAccountId
      },
    });
    return res.data.url;
  };

  const sendMediaMessage = async (fileUri, fileName, mimeType) => {
    setSending(true);
    try {
      const uploadedUrl = await uploadFile(fileUri, fileName, mimeType);
      
      const isDocument = !mimeType.startsWith('image/') && !mimeType.startsWith('video/');
      const type = isDocument ? 'document' : (mimeType.startsWith('video/') ? 'video' : 'image');

      const res = await api.post('/messages/send-image', {
        to: conversation.phone,
        imageUrl: uploadedUrl,
        caption: '',
        type: type,
        filename: fileName || 'file'
      }, {
        headers: { 'x-whatsapp-account-id': conversation.whatsappAccountId }
      });

      if (res.data.success && res.data.message) {
        const returnedMsg = res.data.message;
        setMessages((prev) => {
          if (prev.some(m => m.messageId === returnedMsg.messageId)) return prev;
          return [returnedMsg, ...prev];
        });
      }
    } catch (err) {
      console.error('Error sending media:', err);
      Alert.alert('Error', 'Failed to upload and send media.');
    } finally {
      setSending(false);
    }
  };

  const handlePickMedia = async (useCamera = false) => {
    try {
      const permissionResult = useCamera 
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (permissionResult.status !== 'granted') {
        Alert.alert('Permission Denied', `Permission to access ${useCamera ? 'camera' : 'gallery'} is required.`);
        return;
      }

      const pickerResult = useCamera
        ? await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.All,
            quality: 0.8,
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.All,
            quality: 0.8,
          });

      if (pickerResult.canceled || !pickerResult.assets || pickerResult.assets.length === 0) {
        return;
      }

      const asset = pickerResult.assets[0];
      const fileName = asset.uri.split('/').pop() || 'upload.jpg';
      let mimeType = 'image/jpeg';
      if (asset.type === 'video') {
        mimeType = 'video/mp4';
      }
      
      setMediaOptionsVisible(false);
      await sendMediaMessage(asset.uri, fileName, mimeType);
    } catch (err) {
      console.error('Error picking media:', err);
    }
  };

  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const asset = result.assets[0];
      setMediaOptionsVisible(false);
      await sendMediaMessage(asset.uri, asset.name || 'document.pdf', asset.mimeType || 'application/pdf');
    } catch (err) {
      console.error('Error picking document:', err);
    }
  };

  const handleLoadMore = () => {
    if (loadingMore || !hasMore) return;
    fetchMessages(page + 1);
  };

  const handleReact = (msg, emoji) => {
    setMessages(prev => 
      prev.map(m => m.messageId === msg.messageId ? { ...m, reaction: emoji } : m)
    );
    setSelectedMsgForAction(null);
  };

  const handleCopy = (msg) => {
    if (msg.body) {
      Clipboard.setString(msg.body);
      Alert.alert('Copied', 'Message text copied to clipboard.');
    }
    setSelectedMsgForAction(null);
  };

  const handleSelectQuickReply = async (item) => {
    setQuickRepliesModalVisible(false);
    setQuickReplySearch('');

    if (item.content) {
      setNewMessage(prev => prev ? `${prev} ${item.content}` : item.content);
    }

    if (item.mediaUrl) {
      setSending(true);
      try {
        const urlLower = item.mediaUrl.toLowerCase();
        const mimeType = urlLower.endsWith('.png') ? 'image/png' : (urlLower.endsWith('.gif') ? 'image/gif' : (urlLower.endsWith('.mp4') ? 'video/mp4' : 'image/jpeg'));
        const isDocument = !urlLower.endsWith('.jpg') && !urlLower.endsWith('.jpeg') && !urlLower.endsWith('.png') && !urlLower.endsWith('.gif') && !urlLower.endsWith('.mp4');
        const type = isDocument ? 'document' : (urlLower.endsWith('.mp4') ? 'video' : 'image');

        const res = await api.post('/messages/send-image', {
          to: conversation.phone,
          imageUrl: item.mediaUrl,
          caption: item.content || '',
          type: type,
          filename: item.mediaUrl.split('/').pop() || 'file'
        }, {
          headers: { 'x-whatsapp-account-id': conversation.whatsappAccountId }
        });

        if (res.data.success && res.data.message) {
          const returnedMsg = res.data.message;
          setMessages((prev) => {
            if (prev.some(m => m.messageId === returnedMsg.messageId)) return prev;
            return [returnedMsg, ...prev];
          });
        }
      } catch (err) {
        console.error('Error sending quick reply media:', err);
        Alert.alert('Error', 'Failed to send quick reply media.');
      } finally {
        setSending(false);
      }
    }
  };

  const getFriendlyDateText = (dateString) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
    }
  };

  const renderFooter = () => {
    if (!loadingMore) return null;
    return (
      <View style={{ paddingVertical: 10, alignItems: 'center' }}>
        <ActivityIndicator size="small" color="#00a884" />
      </View>
    );
  };

  const filteredQuickReplies = quickReplies.filter(qr => 
    qr.name.toLowerCase().includes(quickReplySearch.toLowerCase()) || 
    qr.content.toLowerCase().includes(quickReplySearch.toLowerCase())
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#008069" />
      
      {/* Chat Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <ArrowLeft size={22} color="#ffffff" />
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.headerInfo} 
          onPress={() => navigation.navigate('ContactDetail', { conversation })}
        >
          <View style={styles.headerAvatar}>
            <Text style={styles.headerAvatarText}>
              {displayName.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle} numberOfLines={1}>{displayName}</Text>
            <Text 
              style={[
                styles.headerStatus,
                isExpired ? { color: '#ffb3b3' } : { color: '#d1f4cc' }
              ]}
            >
              ⏱️ {timeLeftStr}
            </Text>
          </View>
        </TouchableOpacity>

        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.actionButton}>
            <Phone size={20} color="#ffffff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton}>
            <Video size={22} color="#ffffff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton}>
            <MoreVertical size={20} color="#ffffff" />
          </TouchableOpacity>
        </View>
      </View>

      <KeyboardAvoidingView 
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {/* Chat Area (Inverted FlatList for WhatsApp-like bottom-up scrolling) */}
        <View style={styles.chatBackground}>
          {loading ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="large" color="#00a884" />
            </View>
          ) : (
            <FlatList
              data={messages}
              inverted
              keyExtractor={(item, index) => item._id || item.messageId || index.toString()}
              renderItem={({ item, index }) => {
                const showDateHeader = index === messages.length - 1 || 
                  new Date(messages[index].timestamp).toDateString() !== new Date(messages[index + 1].timestamp).toDateString();
                
                return (
                  <View>
                    {showDateHeader && (
                      <View style={styles.dateHeaderContainer}>
                        <View style={styles.dateHeaderBg}>
                          <Text style={styles.dateHeaderText}>
                            {getFriendlyDateText(item.timestamp)}
                          </Text>
                        </View>
                      </View>
                    )}
                    <MessageBubble 
                      msg={item} 
                      onLongPress={() => setSelectedMsgForAction(item)}
                    />
                  </View>
                );
              }}
              contentContainerStyle={styles.messageListContent}
              onEndReached={handleLoadMore}
              onEndReachedThreshold={0.2}
              ListFooterComponent={renderFooter}
            />
          )}
        </View>

        {/* Expired Window Banner */}
        {isExpired && (
          <View style={styles.expiredBanner}>
            <Text style={styles.expiredBannerText}>
              ⚠️ 24-hour service window has expired. You can only send template messages.
            </Text>
          </View>
        )}

        {/* Reply Message Preview */}
        {replyingTo && (
          <View style={styles.replyPreviewContainer}>
            <View style={styles.replyPreviewBar} />
            <View style={styles.replyPreviewContent}>
              <Text style={styles.replyPreviewTitle}>Replying to message</Text>
              <Text style={styles.replyPreviewText} numberOfLines={1}>
                {replyingTo.body}
              </Text>
            </View>
            <TouchableOpacity 
              style={styles.replyPreviewClose}
              onPress={() => setReplyingTo(null)}
            >
              <X size={16} color="#667781" />
            </TouchableOpacity>
          </View>
        )}

        {/* Input Bar */}
        <View style={styles.inputContainer}>
          <View style={styles.inputBar}>
            <TouchableOpacity 
              style={styles.inputIcon}
              onPress={() => setQuickRepliesModalVisible(true)}
            >
              <Zap size={20} color="#008069" />
            </TouchableOpacity>
            <TextInput
              style={styles.textInput}
              placeholder="Type a message"
              placeholderTextColor="#8696a0"
              value={newMessage}
              onChangeText={setNewMessage}
              multiline
            />
            <TouchableOpacity 
              style={styles.inputIcon}
              onPress={() => setMediaOptionsVisible(true)}
            >
              <Paperclip size={22} color="#667781" />
            </TouchableOpacity>
          </View>
          <TouchableOpacity 
            style={styles.sendButton} 
            onPress={handleSend}
            disabled={sending || sending}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Send size={20} color="#ffffff" />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Message Options Modal (Reply / React) */}
      <Modal
        visible={!!selectedMsgForAction}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedMsgForAction(null)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setSelectedMsgForAction(null)}
        >
          <View style={styles.optionsContainer}>
            {/* Reaction Emoji Row */}
            <View style={styles.emojiRow}>
              {['👍', '❤️', '😂', '😮', '😢', '🙏'].map((emoji) => (
                <TouchableOpacity 
                  key={emoji}
                  style={styles.emojiButton}
                  onPress={() => handleReact(selectedMsgForAction, emoji)}
                >
                  <Text style={styles.emojiText}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Actions list */}
            <View style={styles.actionsList}>
              <TouchableOpacity 
                style={styles.actionItem} 
                onPress={() => {
                  setReplyingTo(selectedMsgForAction);
                  setSelectedMsgForAction(null);
                }}
              >
                <CornerUpLeft size={20} color="#111b21" style={{ marginRight: 15 }} />
                <Text style={styles.actionItemText}>Reply</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.actionItem}
                onPress={() => handleCopy(selectedMsgForAction)}
              >
                <Copy size={20} color="#111b21" style={{ marginRight: 15 }} />
                <Text style={styles.actionItemText}>Copy Message</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Media Picker Options Modal */}
      <Modal
        visible={mediaOptionsVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setMediaOptionsVisible(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setMediaOptionsVisible(false)}
        >
          <View style={styles.optionsContainer}>
            <Text style={[styles.quickReplyTitle, { marginBottom: 16, textAlign: 'center' }]}>Send Media</Text>
            
            <View style={styles.actionsList}>
              <TouchableOpacity 
                style={styles.actionItem}
                onPress={() => handlePickMedia(true)}
              >
                <Camera size={22} color="#008069" style={{ marginRight: 15 }} />
                <Text style={styles.actionItemText}>Camera (Capture Photo/Video)</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.actionItem}
                onPress={() => handlePickMedia(false)}
              >
                <ImageIcon size={22} color="#008069" style={{ marginRight: 15 }} />
                <Text style={styles.actionItemText}>Gallery (Select Photo/Video)</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.actionItem}
                onPress={handlePickDocument}
              >
                <FileText size={22} color="#008069" style={{ marginRight: 15 }} />
                <Text style={styles.actionItemText}>Document (Select File)</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Quick Replies Modal */}
      <Modal
        visible={quickRepliesModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setQuickRepliesModalVisible(false)}
      >
        <View style={styles.quickReplyModalContainer}>
          <View style={styles.quickReplyContent}>
            <View style={styles.quickReplyHeader}>
              <Text style={styles.quickReplyTitle}>Quick Replies</Text>
              <TouchableOpacity onPress={() => setQuickRepliesModalVisible(false)}>
                <X size={24} color="#111b21" />
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.quickReplySearchInput}
              placeholder="Search quick replies..."
              placeholderTextColor="#8696a0"
              value={quickReplySearch}
              onChangeText={setQuickReplySearch}
            />

            <FlatList
              data={filteredQuickReplies}
              keyExtractor={(item) => item._id || item.name}
              renderItem={({ item }) => (
                <TouchableOpacity 
                  style={styles.quickReplyItem}
                  onPress={() => handleSelectQuickReply(item)}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    {item.mediaUrl ? (
                      <Image 
                        source={{ uri: item.mediaUrl }} 
                        style={styles.quickReplyThumbnail} 
                        resizeMode="cover"
                      />
                    ) : null}
                    <View style={{ flex: 1 }}>
                      <Text style={styles.quickReplyName}>/{item.name}</Text>
                      <Text style={styles.quickReplyText} numberOfLines={2}>{item.content}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View style={styles.emptyQuickReplies}>
                  <Text style={styles.emptyQuickRepliesText}>No quick replies found</Text>
                </View>
              }
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#efeae2',
  },
  header: {
    height: 64,
    backgroundColor: '#008069',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  backButton: {
    padding: 8,
  },
  headerInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 4,
  },
  headerAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#d1f4cc',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerAvatarText: {
    color: '#008069',
    fontSize: 15,
    fontWeight: 'bold',
  },
  headerTitleContainer: {
    marginLeft: 10,
    flex: 1,
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  headerStatus: {
    fontSize: 11,
    marginTop: 1,
    fontWeight: '600',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    padding: 8,
    marginLeft: 6,
  },
  chatBackground: {
    flex: 1,
    backgroundColor: '#efeae2',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  messageListContent: {
    paddingVertical: 10,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 8,
    backgroundColor: 'transparent',
  },
  inputBar: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 24,
    paddingHorizontal: 12,
    alignItems: 'center',
    marginRight: 8,
    maxHeight: 120,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 1,
  },
  inputIcon: {
    padding: 8,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    color: '#111b21',
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  sendButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#00a884',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  dateHeaderContainer: {
    alignItems: 'center',
    marginVertical: 12,
  },
  dateHeaderBg: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 1,
    elevation: 1,
  },
  dateHeaderText: {
    fontSize: 12,
    color: '#667781',
    fontWeight: 'bold',
  },
  expiredBanner: {
    backgroundColor: '#ffebe6',
    borderTopWidth: 1,
    borderTopColor: '#ffcccc',
    padding: 10,
    alignItems: 'center',
  },
  expiredBannerText: {
    fontSize: 13,
    color: '#d32f2f',
    fontWeight: '600',
    textAlign: 'center',
  },
  replyPreviewContainer: {
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    padding: 8,
    alignItems: 'center',
  },
  replyPreviewBar: {
    width: 4,
    height: '100%',
    backgroundColor: '#00a884',
    borderRadius: 2,
  },
  replyPreviewContent: {
    flex: 1,
    paddingHorizontal: 10,
  },
  replyPreviewTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#00a884',
  },
  replyPreviewText: {
    fontSize: 13,
    color: '#667781',
  },
  replyPreviewClose: {
    padding: 6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  optionsContainer: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    paddingBottom: 30,
  },
  emojiRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    marginBottom: 10,
  },
  emojiButton: {
    padding: 8,
  },
  emojiText: {
    fontSize: 28,
  },
  actionsList: {
    marginTop: 8,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
  },
  actionItemText: {
    fontSize: 16,
    color: '#111b21',
  },
  quickReplyModalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  quickReplyContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: '60%',
    padding: 16,
  },
  quickReplyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  quickReplyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111b21',
  },
  quickReplySearchInput: {
    backgroundColor: '#f0f2f5',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 15,
    color: '#111b21',
    marginBottom: 16,
  },
  quickReplyItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f2f5',
  },
  quickReplyThumbnail: {
    width: 44,
    height: 44,
    borderRadius: 8,
    marginRight: 12,
    backgroundColor: '#e2e8f0',
  },
  quickReplyName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#00a884',
    marginBottom: 2,
  },
  quickReplyText: {
    fontSize: 14,
    color: '#667781',
  },
  emptyQuickReplies: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyQuickRepliesText: {
    color: '#8696a0',
    fontSize: 15,
  },
});
