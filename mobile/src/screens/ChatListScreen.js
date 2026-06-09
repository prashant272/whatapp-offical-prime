import React, { useState, useEffect, useContext, useCallback, useRef } from 'react';
import { 
  View, 
  Text, 
  FlatList, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  ActivityIndicator, 
  StatusBar, 
  ScrollView, 
  Modal 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search, LogOut, Bell, MessageSquare, X, ChevronDown, Check } from 'lucide-react-native';
import { AuthContext } from '../context/AuthContext';
import api, { API_URL } from '../api';
import io from 'socket.io-client';
import { Audio } from 'expo-av';
import * as Notifications from 'expo-notifications';

// Configure notifications handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export default function ChatListScreen({ navigation }) {
  const { logout, user } = useContext(AuthContext);
  const [conversations, setConversations] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [sectors, setSectors] = useState([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all'); // 'all', 'unread', or 'window'
  const [statusFilter, setStatusFilter] = useState('all');
  const [sectorFilter, setSectorFilter] = useState('all');
  const [showStatusPicker, setShowStatusPicker] = useState(false);
  const [showSectorPicker, setShowSectorPicker] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeBanner, setActiveBanner] = useState(null);
  const bannerTimeoutRef = useRef(null);

  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [accountFilter, setAccountFilter] = useState('all');
  const [showAccountPicker, setShowAccountPicker] = useState(false);

  // Request notifications permissions on mount
  useEffect(() => {
    async function requestPermissions() {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') {
        console.log('Notification permissions not granted');
      }
    }
    requestPermissions();
  }, []);

  const triggerBannerNotification = async (notif) => {
    if (bannerTimeoutRef.current) {
      clearTimeout(bannerTimeoutRef.current);
    }
    setActiveBanner(notif);
    
    // Play Notification Sound
    try {
      const { sound } = await Audio.Sound.createAsync(
        { uri: 'https://assets.mixkit.co/active_storage/sfx/2357/2357-84.wav' }
      );
      await sound.playAsync();
    } catch (e) {
      console.log('Sound play error:', e);
    }

    // Schedule System Local Push Notification
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: notif.title,
          body: notif.body,
          sound: true,
        },
        trigger: null,
      });
    } catch (err) {
      console.error('Push notification failed:', err);
    }

    bannerTimeoutRef.current = setTimeout(() => {
      setActiveBanner(null);
    }, 5000);
  };

  const fetchConversations = async (pageNum = 1, isRef = false) => {
    if (pageNum === 1 && !isRef) setLoading(true);
    if (pageNum > 1) setLoadingMore(true);
    try {
      let accountsList = accounts;
      // Fetch dropdown values on initial load or refresh
      if (pageNum === 1 && (accounts.length === 0 || isRef)) {
        const [accountsRes, statsRes, sectsRes] = await Promise.all([
          api.get('/whatsapp-accounts').catch(() => ({ data: [] })),
          api.get('/statuses').catch(() => ({ data: [] })),
          api.get('/sectors').catch(() => ({ data: [] }))
        ]);
        accountsList = accountsRes.data || [];
        setAccounts(accountsList);
        setStatuses(statsRes.data || []);
        setSectors(sectsRes.data || []);
      }
      
      const accountIdsStr = accountFilter === 'all'
        ? accountsList.map(a => a._id).join(',')
        : accountFilter;

      const params = {
        page: pageNum,
        limit: 20
      };

      if (search) params.search = search;
      if (statusFilter && statusFilter !== 'all') params.status = statusFilter;
      if (sectorFilter && sectorFilter !== 'all') params.sector = sectorFilter;
      if (filter && filter !== 'all') params.filter = filter;

      const res = await api.get('/conversations', {
        params,
        headers: { 'x-whatsapp-account-id': accountIdsStr }
      });
      
      const chatsList = res.data?.conversations || [];
      
      if (pageNum === 1) {
        setConversations(chatsList);
        setHasMore(chatsList.length >= 20);
      } else {
        setConversations(prev => {
          const existingIds = new Set(prev.map(c => c._id));
          const newChats = chatsList.filter(c => !existingIds.has(c._id));
          return [...prev, ...newChats];
        });
        setHasMore(chatsList.length >= 20);
      }
      setPage(pageNum);
    } catch (err) {
      console.error('Error fetching conversations:', err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    }
  };

  // Trigger refetch on filter updates
  useEffect(() => {
    const delayDebounceId = setTimeout(() => {
      setPage(1);
      fetchConversations(1);
    }, search ? 500 : 0);

    return () => clearTimeout(delayDebounceId);
  }, [search, filter, statusFilter, sectorFilter, accountFilter]);

  useEffect(() => {
    // Connect socket passing userId and role
    const socketServerUrl = API_URL.replace('/api', '');
    const socket = io(socketServerUrl, {
      query: {
        userId: user?._id || '',
        role: user?.role || ''
      }
    });

    socket.on('connect', () => {
      console.log('ChatListScreen socket connected successfully');
    });

    // Handle new incoming/outgoing messages
    socket.on('new_message', (data) => {
      const msg = data.message;
      if (!msg) return;

      setConversations(prev => {
        const clean = (p) => {
          const digits = String(p || '').replace(/\D/g, '');
          return digits.length >= 10 ? digits.slice(-10) : digits;
        };
        const targetPhone = clean(data.conversation.phone);
        const exists = prev.some(c => clean(c.phone) === targetPhone);
        if (exists) {
          return prev.map(c => {
            if (clean(c.phone) === targetPhone) {
              return {
                ...c,
                lastMessage: msg.body || (msg.type === 'image' ? '📷 Photo' : msg.type === 'document' ? '📄 Document' : 'Message'),
                lastMessageTime: msg.timestamp,
                unreadCount: c.unreadCount + (msg.direction === 'inbound' ? 1 : 0),
                lastCustomerMessageAt: msg.direction === 'inbound' ? msg.timestamp : c.lastCustomerMessageAt
              };
            }
            return c;
          }).sort((a, b) => new Date(b.lastMessageTime) - new Date(a.lastMessageTime));
        } else {
          fetchConversations(1, true);
          return prev;
        }
      });

      if (msg.direction === 'inbound') {
        const displayName = data.conversation.contact?.name || data.conversation.phone;
        const bodyText = msg.body || (msg.type === 'image' ? '📷 Photo' : msg.type === 'document' ? '📄 Document' : 'New message');
        triggerBannerNotification({
          id: Date.now(),
          title: displayName,
          body: bodyText,
          conversation: data.conversation
        });
      }
    });

    // Chat assigned
    socket.on('chat_assigned', ({ conversation, isNewAssignment = true }) => {
      const assignedToId = typeof conversation.assignedTo === 'object' ? conversation.assignedTo?._id : conversation.assignedTo;
      if (assignedToId === user?._id && isNewAssignment) {
        const contactName = conversation.contact?.name || conversation.phone;
        triggerBannerNotification({
          id: Date.now(),
          title: '👤 Chat Assigned to You',
          body: `Admin assigned a chat: ${contactName}`,
          conversation: conversation
        });
        fetchConversations(1, true);
      }
    });

    // Follow up reminder
    socket.on('followup_reminder', ({ conversation }) => {
      const assignedToId = typeof conversation.assignedTo === 'object' ? conversation.assignedTo?._id : conversation.assignedTo;
      const isMyReminder = !assignedToId || String(assignedToId) === String(user?._id);

      if (user?.role !== 'Admin' && !isMyReminder) return;

      const contactName = conversation.contact?.name || conversation.phone;
      triggerBannerNotification({
        id: Date.now(),
        title: '🔔 Follow-up Reminder',
        body: `Time to follow up with: ${contactName}`,
        conversation: conversation
      });
      fetchConversations(1, true);
    });

    // Missed follow up alert
    socket.on('missed_followup_alert', ({ conversation }) => {
      const assignedToId = typeof conversation.assignedTo === 'object' ? conversation.assignedTo?._id : conversation.assignedTo;
      if (user?.role !== 'Admin' && String(assignedToId) !== String(user?._id)) return;

      const contactName = conversation.contact?.name || conversation.phone;
      triggerBannerNotification({
        id: Date.now(),
        title: '⚠️ Missed Follow-up',
        body: `Follow-up missed for: ${contactName}`,
        conversation: conversation
      });
      fetchConversations(1, true);
    });

    const unsubscribe = navigation.addListener('focus', () => {
      setPage(1);
      fetchConversations(1);
    });

    return () => {
      socket.disconnect();
      unsubscribe();
    };
  }, [navigation, user]);

  const onRefresh = () => {
    setRefreshing(true);
    setPage(1);
    fetchConversations(1, true);
  };

  const getAccountName = useCallback((accountId) => {
    const found = accounts.find(a => a._id === accountId);
    return found ? found.name : 'Primary';
  }, [accounts]);

  const renderChatItem = useCallback(({ item }) => {
    const displayName = item.contact?.name || item.phone || 'Unknown User';
    const lastMsgTime = item.lastMessageTime 
      ? new Date(item.lastMessageTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : '';
    const hasUnread = item.unreadCount > 0;

    return (
      <TouchableOpacity 
        style={styles.chatRow} 
        onPress={() => navigation.navigate('ChatArea', { conversation: item })}
      >
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {displayName.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.chatDetails}>
          <View style={styles.chatHeaderRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, flexWrap: 'wrap', gap: 6 }}>
              <Text style={styles.chatName} numberOfLines={1}>{displayName}</Text>
              {item.whatsappAccountId && (
                <View style={styles.accountBadge}>
                  <Text style={styles.accountBadgeText}>{getAccountName(item.whatsappAccountId)}</Text>
                </View>
              )}
            </View>
            <Text style={[styles.timeText, hasUnread && styles.unreadTimeText]}>{lastMsgTime}</Text>
          </View>
          <View style={styles.chatMessageRow}>
            <Text style={[styles.lastMessage, hasUnread && styles.unreadLastMessage]} numberOfLines={1}>
              {item.lastMessage || 'No messages yet'}
            </Text>
            {hasUnread && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadCountText}>{item.unreadCount}</Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  }, [accounts, navigation, getAccountName]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#008069" />
      {/* Custom Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>PrimeimpactChat</Text>
          <Text style={styles.roleText}>{user?.name} • {user?.role}</Text>
        </View>
        <TouchableOpacity onPress={logout} style={styles.logoutButton}>
          <LogOut size={20} color="#ffffff" />
        </TouchableOpacity>
      </View>

      {/* Search Input */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Search size={18} color="#667781" style={styles.searchIcon} />
          <TextInput
            placeholder="Search contacts or phone..."
            placeholderTextColor="#8696a0"
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch('')}>
              <X size={16} color="#667781" style={{ marginRight: 4 }} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* Filter Chips */}
      <View style={{ paddingBottom: 10 }}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
        >
          <TouchableOpacity 
            style={[styles.filterChip, filter === 'all' && styles.activeFilterChip]}
            onPress={() => setFilter('all')}
          >
            <Text style={[styles.filterText, filter === 'all' && styles.activeFilterText]}>All Chats</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.filterChip, filter === 'unread' && styles.activeFilterChip]}
            onPress={() => setFilter('unread')}
          >
            <Text style={[styles.filterText, filter === 'unread' && styles.activeFilterText]}>
              Unread
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.filterChip, filter === 'window' && styles.activeFilterChip]}
            onPress={() => setFilter('window')}
          >
            <Text style={[styles.filterText, filter === 'window' && styles.activeFilterText]}>
              24h Window
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Account, Status & Sector Dropdown Buttons */}
      <View style={styles.filterRow}>
        {/* Account Selector */}
        <TouchableOpacity 
          onPress={() => setShowAccountPicker(true)}
          style={[styles.dropdownBtn, accountFilter !== 'all' && styles.dropdownBtnActive]}
        >
          <Text style={[styles.dropdownBtnText, accountFilter !== 'all' && styles.dropdownBtnTextActive]} numberOfLines={1}>
            {accountFilter === 'all' ? 'All Accounts' : (accounts.find(a => a._id === accountFilter)?.name || 'Account')}
          </Text>
          <ChevronDown size={14} color={accountFilter !== 'all' ? '#008069' : '#667781'} />
        </TouchableOpacity>

        {/* Status Selector */}
        <TouchableOpacity 
          onPress={() => setShowStatusPicker(true)}
          style={[styles.dropdownBtn, statusFilter !== 'all' && styles.dropdownBtnActive]}
        >
          <Text style={[styles.dropdownBtnText, statusFilter !== 'all' && styles.dropdownBtnTextActive]} numberOfLines={1}>
            {statusFilter === 'all' ? 'All Statuses' : statusFilter}
          </Text>
          <ChevronDown size={14} color={statusFilter !== 'all' ? '#008069' : '#667781'} />
        </TouchableOpacity>

        {/* Sector Selector */}
        <TouchableOpacity 
          onPress={() => setShowSectorPicker(true)}
          style={[styles.dropdownBtn, sectorFilter !== 'all' && styles.dropdownBtnActive]}
        >
          <Text style={[styles.dropdownBtnText, sectorFilter !== 'all' && styles.dropdownBtnTextActive]} numberOfLines={1}>
            {sectorFilter === 'all' ? 'All Sectors' : sectorFilter}
          </Text>
          <ChevronDown size={14} color={sectorFilter !== 'all' ? '#008069' : '#667781'} />
        </TouchableOpacity>
      </View>

      {/* Account Picker Modal (BottomSheet Style) */}
      <Modal visible={showAccountPicker} transparent animationType="slide" onRequestClose={() => setShowAccountPicker(false)}>
        <TouchableOpacity 
          style={styles.bottomSheetOverlay}
          activeOpacity={1}
          onPress={() => setShowAccountPicker(false)}
        >
          <View style={styles.bottomSheetContainer}>
            <View style={styles.bottomSheetHeader}>
              <Text style={styles.bottomSheetTitle}>Select Account</Text>
              <TouchableOpacity style={styles.bottomSheetClose} onPress={() => setShowAccountPicker(false)}>
                <X size={20} color="#334155" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={[{ _id: 'all', name: 'All Accounts' }, ...accounts]}
              keyExtractor={(item) => item._id}
              renderItem={({ item }) => {
                const isActive = accountFilter === item._id;
                return (
                  <TouchableOpacity 
                    onPress={() => { setAccountFilter(item._id); setShowAccountPicker(false); }}
                    style={[styles.bottomSheetItem, isActive && styles.bottomSheetItemActive]}
                  >
                    <Text style={[styles.bottomSheetItemText, isActive && styles.bottomSheetItemTextActive]}>
                      {item.name}
                    </Text>
                    {isActive && <Check size={18} color="#008069" />}
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Status Picker Modal (BottomSheet Style) */}
      <Modal visible={showStatusPicker} transparent animationType="slide" onRequestClose={() => setShowStatusPicker(false)}>
        <TouchableOpacity 
          style={styles.bottomSheetOverlay}
          activeOpacity={1}
          onPress={() => setShowStatusPicker(false)}
        >
          <View style={styles.bottomSheetContainer}>
            <View style={styles.bottomSheetHeader}>
              <Text style={styles.bottomSheetTitle}>Select Status</Text>
              <TouchableOpacity style={styles.bottomSheetClose} onPress={() => setShowStatusPicker(false)}>
                <X size={20} color="#334155" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={[{ name: 'all' }, ...statuses]}
              keyExtractor={(item) => item._id || item.name}
              renderItem={({ item }) => {
                const isAll = item.name === 'all';
                const label = isAll ? 'All Statuses' : item.name;
                const isActive = statusFilter === item.name;
                return (
                  <TouchableOpacity 
                    onPress={() => { setStatusFilter(item.name); setShowStatusPicker(false); }}
                    style={[styles.bottomSheetItem, isActive && styles.bottomSheetItemActive]}
                  >
                    <Text style={[styles.bottomSheetItemText, isActive && styles.bottomSheetItemTextActive]}>
                      {label}
                    </Text>
                    {isActive && <Check size={18} color="#008069" />}
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Sector Picker Modal (BottomSheet Style) */}
      <Modal visible={showSectorPicker} transparent animationType="slide" onRequestClose={() => setShowSectorPicker(false)}>
        <TouchableOpacity 
          style={styles.bottomSheetOverlay}
          activeOpacity={1}
          onPress={() => setShowSectorPicker(false)}
        >
          <View style={styles.bottomSheetContainer}>
            <View style={styles.bottomSheetHeader}>
              <Text style={styles.bottomSheetTitle}>Select Sector</Text>
              <TouchableOpacity style={styles.bottomSheetClose} onPress={() => setShowSectorPicker(false)}>
                <X size={20} color="#334155" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={[{ _id: 'all', name: 'all' }, ...sectors]}
              keyExtractor={(item) => item._id}
              renderItem={({ item }) => {
                const isAll = item.name === 'all';
                const label = isAll ? 'All Sectors' : item.name;
                const isActive = sectorFilter === item.name;
                return (
                  <TouchableOpacity 
                    onPress={() => { setSectorFilter(item.name); setShowSectorPicker(false); }}
                    style={[styles.bottomSheetItem, isActive && styles.bottomSheetItemActive]}
                  >
                    <Text style={[styles.bottomSheetItemText, isActive && styles.bottomSheetItemTextActive]}>
                      {label}
                    </Text>
                    {isActive && <Check size={18} color="#008069" />}
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Conversations List */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#00a884" />
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(item) => item._id}
          renderItem={renderChatItem}
          refreshing={refreshing}
          onRefresh={onRefresh}
          contentContainerStyle={styles.listContent}
          initialNumToRender={15}
          maxToRenderPerBatch={15}
          windowSize={10}
          removeClippedSubviews={true}
          onEndReached={() => {
            if (hasMore && !loadingMore && !loading) {
              fetchConversations(page + 1);
            }
          }}
          onEndReachedThreshold={0.4}
          ListFooterComponent={() => {
            if (!loadingMore) return null;
            return (
              <View style={{ paddingVertical: 12, alignItems: 'center' }}>
                <ActivityIndicator size="small" color="#00a884" />
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <MessageSquare size={48} color="#cbd5e1" style={{ marginBottom: 12 }} />
              <Text style={styles.emptyText}>No conversations found</Text>
            </View>
          }
        />
      )}

      {/* WhatsApp style Banner Notification */}
      {activeBanner && (
        <TouchableOpacity 
          style={styles.bannerContainer}
          activeOpacity={0.9}
          onPress={() => {
            setActiveBanner(null);
            navigation.navigate('ChatArea', { conversation: activeBanner.conversation });
          }}
        >
          <View style={styles.bannerIconContainer}>
            <Bell size={18} color="#ffffff" />
          </View>
          <View style={styles.bannerTextContainer}>
            <Text style={styles.bannerTitle} numberOfLines={1}>{activeBanner.title}</Text>
            <Text style={styles.bannerBody} numberOfLines={1}>{activeBanner.body}</Text>
          </View>
          <TouchableOpacity style={styles.bannerCloseButton} onPress={() => setActiveBanner(null)}>
            <Text style={{ color: '#8696a0', fontSize: 18, fontWeight: 'bold' }}>×</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    height: 64,
    backgroundColor: '#008069',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  roleText: {
    color: '#d1f4cc',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  logoutButton: {
    padding: 8,
  },
  searchContainer: {
    padding: 12,
    backgroundColor: '#ffffff',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f2f5',
    borderRadius: 20,
    paddingHorizontal: 12,
    height: 40,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#111b21',
    paddingVertical: 0,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: '#f0f2f5',
    borderWidth: 1.5,
    borderColor: '#e9edef',
  },
  activeFilterChip: {
    backgroundColor: '#e7fce3',
    borderColor: '#00a884',
  },
  filterText: {
    fontSize: 13,
    color: '#667781',
    fontWeight: '700',
  },
  activeFilterText: {
    color: '#008069',
    fontWeight: '700',
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 6,
    gap: 8,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f2f5',
    paddingBottom: 14,
  },
  dropdownBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 10,
    height: 40,
  },
  dropdownBtnActive: {
    borderColor: '#00a884',
    backgroundColor: '#e7fce3',
  },
  dropdownBtnText: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '700',
    flex: 1,
    marginRight: 4,
  },
  dropdownBtnTextActive: {
    color: '#008069',
  },
  bottomSheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'flex-end',
  },
  bottomSheetContainer: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '65%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 20,
  },
  bottomSheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    marginBottom: 10,
  },
  bottomSheetTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  bottomSheetClose: {
    padding: 6,
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
  },
  bottomSheetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f8fafc',
  },
  bottomSheetItemActive: {
    backgroundColor: '#e7fce3',
    borderRadius: 10,
  },
  bottomSheetItemText: {
    fontSize: 15,
    color: '#334155',
    fontWeight: '600',
  },
  bottomSheetItemTextActive: {
    color: '#008069',
    fontWeight: '700',
  },
  listContent: {
    paddingBottom: 20,
  },
  chatRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f8fafc',
    alignItems: 'center',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#00a884',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  chatDetails: {
    flex: 1,
    marginLeft: 15,
  },
  chatHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  chatName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1e293b',
    maxWidth: 150,
  },
  accountBadge: {
    backgroundColor: '#f1f5f9',
    borderColor: '#cbd5e1',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  accountBadgeText: {
    fontSize: 9,
    color: '#475569',
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  timeText: {
    fontSize: 11,
    color: '#94a3b8',
  },
  unreadTimeText: {
    color: '#00a884',
    fontWeight: '700',
  },
  chatMessageRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  lastMessage: {
    fontSize: 13,
    color: '#64748b',
    flex: 1,
    marginRight: 10,
  },
  unreadLastMessage: {
    color: '#0f172a',
    fontWeight: '600',
  },
  unreadBadge: {
    backgroundColor: '#00a884',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  unreadCountText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    paddingTop: 80,
    alignItems: 'center',
  },
  emptyText: {
    color: '#8696a0',
    fontSize: 15,
  },
  bannerContainer: {
    position: 'absolute',
    top: 50,
    left: 16,
    right: 16,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
    zIndex: 999,
    borderLeftWidth: 4,
    borderLeftColor: '#00a884',
  },
  bannerIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#00a884',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  bannerTextContainer: {
    flex: 1,
  },
  bannerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111b21',
  },
  bannerBody: {
    fontSize: 13,
    color: '#667781',
    marginTop: 2,
  },
  bannerCloseButton: {
    padding: 6,
    marginLeft: 6,
  },
});
