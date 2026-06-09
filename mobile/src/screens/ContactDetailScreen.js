import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TextInput, 
  TouchableOpacity, 
  ActivityIndicator, 
  Alert,
  Modal,
  FlatList
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { User, Shield, Briefcase, Bookmark, Award, Save, X, Clock, Send } from 'lucide-react-native';
import api from '../api';

export default function ContactDetailScreen({ route, navigation }) {
  const { conversation } = route.params;
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  
  // Data lists from backend
  const [statuses, setStatuses] = useState([]);
  const [sectors, setSectors] = useState([]);
  const [executives, setExecutives] = useState([]);
  const [customFieldsDef, setCustomFieldsDef] = useState([]);
  
  // Contact details state
  const [activeContact, setActiveContact] = useState(null);
  const [selectedStatus, setSelectedStatus] = useState(conversation.status || 'New');
  const [selectedSector, setSelectedSector] = useState(conversation.sector || 'Unassigned');
  const [selectedSubsector, setSelectedSubsector] = useState(conversation.subsector || 'Unassigned');
  const [selectedAssignedTo, setSelectedAssignedTo] = useState(
    typeof conversation.assignedTo === 'object' ? conversation.assignedTo?._id : (conversation.assignedTo || '')
  );
  const [customFieldValues, setCustomFieldValues] = useState({});
  const [followUpDate, setFollowUpDate] = useState('');
  const [followUpTime, setFollowUpTime] = useState('');
  const [followUpActivity, setFollowUpActivity] = useState('');

  const [showTimeline, setShowTimeline] = useState(false);
  const [timelineEntries, setTimelineEntries] = useState([]);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [newTimelineContent, setNewTimelineContent] = useState('');
  const [postingTimeline, setPostingTimeline] = useState(false);

  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showSectorModal, setShowSectorModal] = useState(false);
  const [showSubsectorModal, setShowSubsectorModal] = useState(false);
  const [showAssignedModal, setShowAssignedModal] = useState(false);
  const [activeCustomFieldModal, setActiveCustomFieldModal] = useState(null);

  useEffect(() => {
    fetchMetadataAndContact();
  }, []);

  const fetchTimeline = async () => {
    const contactId = activeContact?._id || conversation.contact?._id || conversation.contact;
    if (!contactId) return;
    setTimelineLoading(true);
    setShowTimeline(true);
    try {
      const res = await api.get(`/timeline/${contactId}`);
      setTimelineEntries(res.data || []);
    } catch (err) {
      console.error("Error fetching timeline:", err);
      Alert.alert("Error", "Could not load activity history.");
    } finally {
      setTimelineLoading(false);
    }
  };

  const handleAddTimeline = async () => {
    const contactId = activeContact?._id || conversation.contact?._id || conversation.contact;
    if (!newTimelineContent.trim() || !contactId) return;
    
    setPostingTimeline(true);
    try {
      const res = await api.post("/timeline", {
        contactId,
        whatsappAccountId: conversation.whatsappAccountId,
        content: newTimelineContent.trim()
      });
      if (res.data) {
        setTimelineEntries(prev => [res.data, ...prev]);
        setNewTimelineContent('');
      }
    } catch (err) {
      console.error("Error adding timeline:", err);
      Alert.alert("Error", "Failed to add activity log.");
    } finally {
      setPostingTimeline(false);
    }
  };

  const fetchMetadataAndContact = async () => {
    setLoading(true);
    try {
      // 1. Fetch contact details
      const contactId = conversation.contact?._id || conversation.contact;
      let contactData = null;
      if (contactId) {
        const contactRes = await api.get(`/contacts/${contactId}`);
        contactData = contactRes.data;
        setActiveContact(contactData);
        if (contactData.customFields) {
          setCustomFieldValues(contactData.customFields);
        }
      }

      // 2. Fetch dropdown lists & fields
      const [statsRes, sectsRes, execsRes, fieldsRes] = await Promise.all([
        api.get('/statuses').catch(() => ({ data: [] })),
        api.get('/sectors').catch(() => ({ data: [] })),
        api.get('/users').catch(() => ({ data: [] })),
        api.get('/custom-fields', { headers: { 'x-whatsapp-account-id': 'all' } }).catch(() => ({ data: [] }))
      ]);

      setStatuses(statsRes.data || []);
      setSectors(sectsRes.data || []);
      setCustomFieldsDef(fieldsRes.data || []);
      
      const usersList = execsRes.data || [];
      setExecutives(usersList.filter(u => u.role === 'Executive' || u.role === 'Manager' || u.role === 'Admin'));

      // Populate initial values
      const targetData = contactData || conversation;
      if (targetData) {
        setSelectedStatus(targetData.status || 'New');
        setSelectedSector(targetData.sector || 'Unassigned');
        setSelectedSubsector(targetData.subsector || 'Unassigned');
        const assignedId = typeof targetData.assignedTo === 'object' ? targetData.assignedTo?._id : targetData.assignedTo;
        setSelectedAssignedTo(assignedId || '');

        if (conversation.followUpTime) {
          const fDate = new Date(conversation.followUpTime);
          const yyyy = fDate.getFullYear();
          const mm = String(fDate.getMonth() + 1).padStart(2, '0');
          const dd = String(fDate.getDate()).padStart(2, '0');
          const hh = String(fDate.getHours()).padStart(2, '0');
          const min = String(fDate.getMinutes()).padStart(2, '0');
          setFollowUpDate(`${yyyy}-${mm}-${dd}`);
          setFollowUpTime(`${hh}:${min}`);
        }
        setFollowUpActivity(conversation.followUpActivity || '');
      }
    } catch (err) {
      console.error('Error fetching metadata:', err);
      Alert.alert('Error', 'Failed to load contact details.');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setUpdating(true);
    try {
      const contactId = activeContact?._id || conversation.contact?._id || conversation.contact;

      // 1. Update Lead Status
      const isFollowUp = selectedStatus.toLowerCase().includes('follow');
      let finalFollowUpTime = null;
      if (isFollowUp && followUpDate && followUpTime) {
        finalFollowUpTime = new Date(`${followUpDate}T${followUpTime}`).toISOString();
      }

      await api.put(`/conversations/${conversation._id}/status`, {
        phone: conversation.phone,
        status: selectedStatus,
        followUpTime: finalFollowUpTime,
        followUpActivity: isFollowUp ? followUpActivity : null
      }, {
        headers: { 'x-whatsapp-account-id': conversation.whatsappAccountId }
      });

      // 2. Update Assignment (Assigned Specialist, Sector, Subsector)
      await api.patch('/conversations/assign', {
        phone: conversation.phone,
        userId: selectedAssignedTo || null,
        sector: selectedSector,
        subsector: selectedSubsector
      }, {
        headers: { 'x-whatsapp-account-id': conversation.whatsappAccountId }
      });

      // 3. Update Custom Fields if contact exists
      if (contactId) {
        await api.put(`/contacts/${contactId}`, {
          customFields: customFieldValues
        }, {
          headers: { 'x-whatsapp-account-id': conversation.whatsappAccountId }
        });
      }

      Alert.alert('Success', 'Contact details saved successfully.');
      navigation.goBack();
    } catch (err) {
      console.error('Error saving contact:', err);
      Alert.alert('Error', 'Failed to save updates: ' + (err.response?.data?.error || err.message));
    } finally {
      setUpdating(false);
    }
  };

  const handleCustomFieldChange = (fieldName, val) => {
    setCustomFieldValues(prev => ({
      ...prev,
      [fieldName]: val
    }));
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#00a884" />
      </View>
    );
  }

  const activeSectorObj = sectors.find(s => s.name === selectedSector);
  const subsectorsList = activeSectorObj?.subsectors || [];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Profile Header card */}
        <View style={styles.profileCard}>
          <View style={styles.avatarLarge}>
            <Text style={styles.avatarLargeText}>
              {(activeContact?.name || conversation.phone || 'U').charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text style={styles.profileName}>{activeContact?.name || 'New Contact'}</Text>
          <Text style={styles.profilePhone}>{conversation.phone}</Text>
          
          <TouchableOpacity 
            style={{ 
              marginTop: 14, 
              flexDirection: 'row', 
              alignItems: 'center', 
              backgroundColor: 'rgba(0, 128, 105, 0.08)',
              borderColor: 'rgba(0, 128, 105, 0.2)',
              borderWidth: 1.5,
              paddingHorizontal: 16,
              paddingVertical: 8,
              borderRadius: 20
            }}
            onPress={fetchTimeline}
          >
            <Clock size={15} color="#008069" style={{ marginRight: 6 }} />
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#008069' }}>Activity History</Text>
          </TouchableOpacity>
        </View>

        {/* Status & Team Settings */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Shield size={16} color="#008069" />
            <Text style={styles.sectionTitle}>Status & Team Assignment</Text>
          </View>

          {/* Lead Status */}
          <Text style={styles.label}>Lead Status</Text>
          <TouchableOpacity 
            style={styles.dropdownFieldButton}
            onPress={() => setShowStatusModal(true)}
          >
            <Text style={styles.dropdownFieldButtonText}>{selectedStatus || 'Select Status'}</Text>
            <Text style={styles.dropdownFieldArrow}>▼</Text>
          </TouchableOpacity>

          {/* Follow Up Scheduling (Conditional) */}
          {selectedStatus.toLowerCase().includes('follow') && (
            <View style={{ marginTop: 10, padding: 12, backgroundColor: '#fffbeb', borderRadius: 12, borderWidth: 1, borderColor: '#fef3c7', marginBottom: 12 }}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: '#d97706', textTransform: 'uppercase', marginBottom: 4 }}>Follow-up Date (YYYY-MM-DD)</Text>
              <TextInput
                style={[styles.fieldInput, { backgroundColor: '#ffffff', borderColor: '#fde68a', marginBottom: 10 }]}
                placeholder="YYYY-MM-DD (e.g. 2026-06-30)"
                placeholderTextColor="#94a3b8"
                value={followUpDate}
                onChangeText={setFollowUpDate}
              />

              <Text style={{ fontSize: 12, fontWeight: '700', color: '#d97706', textTransform: 'uppercase', marginBottom: 4 }}>Follow-up Time (HH:mm)</Text>
              <TextInput
                style={[styles.fieldInput, { backgroundColor: '#ffffff', borderColor: '#fde68a', marginBottom: 10 }]}
                placeholder="HH:mm (e.g. 15:30)"
                placeholderTextColor="#94a3b8"
                value={followUpTime}
                onChangeText={setFollowUpTime}
              />

              <Text style={{ fontSize: 12, fontWeight: '700', color: '#d97706', textTransform: 'uppercase', marginBottom: 4 }}>Follow-up Activity Description</Text>
              <TextInput
                style={[styles.fieldInput, { backgroundColor: '#ffffff', borderColor: '#fde68a' }]}
                placeholder="e.g. Call back for feedback"
                placeholderTextColor="#94a3b8"
                value={followUpActivity}
                onChangeText={setFollowUpActivity}
              />
            </View>
          )}

          {/* Sector */}
          <Text style={styles.label}>Sector</Text>
          <TouchableOpacity 
            style={styles.dropdownFieldButton}
            onPress={() => setShowSectorModal(true)}
          >
            <Text style={styles.dropdownFieldButtonText}>{selectedSector || 'Unassigned'}</Text>
            <Text style={styles.dropdownFieldArrow}>▼</Text>
          </TouchableOpacity>

          {/* Subsector (if selected) */}
          {selectedSector !== 'Unassigned' && subsectorsList.length > 0 && (
            <>
              <Text style={styles.label}>Subsector</Text>
              <TouchableOpacity 
                style={styles.dropdownFieldButton}
                onPress={() => setShowSubsectorModal(true)}
              >
                <Text style={styles.dropdownFieldButtonText}>{selectedSubsector || 'Unassigned'}</Text>
                <Text style={styles.dropdownFieldArrow}>▼</Text>
              </TouchableOpacity>
            </>
          )}

          {/* Assigned Specialist */}
          <Text style={styles.label}>Assigned Specialist</Text>
          <TouchableOpacity 
            style={styles.dropdownFieldButton}
            onPress={() => setShowAssignedModal(true)}
          >
            <Text style={styles.dropdownFieldButtonText}>
              {executives.find(ex => ex._id === selectedAssignedTo)?.name || 'Unassigned'}
            </Text>
            <Text style={styles.dropdownFieldArrow}>▼</Text>
          </TouchableOpacity>
        </View>

        {/* Lead Intelligence (CRM Fields) */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Bookmark size={16} color="#008069" />
            <Text style={styles.sectionTitle}>Lead Intelligence (CRM)</Text>
          </View>

          {customFieldsDef.length === 0 ? (
            <Text style={styles.emptyFieldsText}>No custom intelligence fields configured.</Text>
          ) : (
            customFieldsDef.map(field => {
              const currentVal = customFieldValues[field.name] || '';
              return (
                <View key={field._id} style={styles.fieldRow}>
                  <Text style={styles.fieldLabel}>{field.label}</Text>
                  
                  {field.type === 'SELECT' || field.type === 'COMBOBOX' ? (
                    <TouchableOpacity 
                      style={styles.dropdownFieldButton}
                      onPress={() => setActiveCustomFieldModal(field)}
                    >
                      <Text style={styles.dropdownFieldButtonText}>{currentVal || 'None'}</Text>
                      <Text style={styles.dropdownFieldArrow}>▼</Text>
                    </TouchableOpacity>
                  ) : (
                    <TextInput
                      style={styles.fieldInput}
                      placeholder={`Enter ${field.label.toLowerCase()}`}
                      placeholderTextColor="#94a3b8"
                      value={currentVal}
                      onChangeText={(val) => handleCustomFieldChange(field.name, val)}
                    />
                  )}
                </View>
              );
            })
          )}
        </View>

        {/* Save Button */}
        <TouchableOpacity 
          style={styles.saveButton} 
          onPress={handleSave}
          disabled={updating}
        >
          {updating ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <>
              <Save size={18} color="#ffffff" style={{ marginRight: 8 }} />
              <Text style={styles.saveButtonText}>Save Changes</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* Timeline Modal */}
      <Modal
        visible={showTimeline}
        animationType="slide"
        onRequestClose={() => setShowTimeline(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: '#ffffff' }}>
          <View style={{ height: 60, borderBottomWidth: 1, borderBottomColor: '#e2e8f0', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 }}>
            <TouchableOpacity onPress={() => setShowTimeline(false)} style={{ padding: 8 }}>
              <X size={24} color="#64748b" />
            </TouchableOpacity>
            <Text style={{ fontSize: 18, fontWeight: 'bold', marginLeft: 12, color: '#1e293b' }}>Activity History</Text>
          </View>
          
          {/* Post Update Section */}
          <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', backgroundColor: '#fcfdfe' }}>
            <View style={{ backgroundColor: '#ffffff', borderRadius: 12, padding: 8, borderWidth: 1.5, borderColor: '#eef2f6' }}>
              <TextInput
                placeholder="What happened? Log new update..."
                placeholderTextColor="#94a3b8"
                value={newTimelineContent}
                onChangeText={setNewTimelineContent}
                multiline
                style={{ fontSize: 14, color: '#1e293b', minHeight: 60, textAlignVertical: 'top' }}
              />
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8 }}>
                <TouchableOpacity
                  onPress={handleAddTimeline}
                  disabled={!newTimelineContent.trim() || postingTimeline}
                  style={{
                    backgroundColor: '#00a884',
                    borderRadius: 10,
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                    flexDirection: 'row',
                    alignItems: 'center',
                    opacity: (!newTimelineContent.trim() || postingTimeline) ? 0.6 : 1
                  }}
                >
                  {postingTimeline ? (
                    <ActivityIndicator size="small" color="#ffffff" style={{ marginRight: 6 }} />
                  ) : (
                    <Send size={14} color="#ffffff" style={{ marginRight: 6 }} />
                  )}
                  <Text style={{ color: '#ffffff', fontWeight: 'bold', fontSize: 13 }}>Post Update</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
          
          {timelineLoading ? (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
              <ActivityIndicator size="large" color="#00a884" />
            </View>
          ) : (
            <FlatList
              data={timelineEntries}
              keyExtractor={(item) => item._id}
              contentContainerStyle={{ padding: 20 }}
              ListEmptyComponent={
                <View style={{ alignItems: 'center', marginTop: 40 }}>
                  <Text style={{ color: '#94a3b8' }}>No activity history found.</Text>
                </View>
              }
              renderItem={({ item }) => (
                <View style={{ borderLeftWidth: 2, borderLeftColor: '#00a884', paddingLeft: 16, marginBottom: 20, position: 'relative' }}>
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#00a884', position: 'absolute', left: -6, top: 4 }} />
                  <Text style={{ fontSize: 12, color: '#64748b', fontWeight: '600' }}>
                    {new Date(item.createdAt).toLocaleString()}
                  </Text>
                  <Text style={{ fontSize: 14, color: '#1e293b', marginTop: 4, lineHeight: 20 }}>
                    {item.content}
                  </Text>
                </View>
              )}
            />
          )}
        </SafeAreaView>
      </Modal>

      {/* Lead Status Picker Modal */}
      <Modal visible={showStatusModal} transparent animationType="fade" onRequestClose={() => setShowStatusModal(false)}>
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowStatusModal(false)}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalHeaderTitle}>Select Lead Status</Text>
            <FlatList
              data={statuses}
              keyExtractor={(item) => item._id || item.name}
              renderItem={({ item }) => (
                <TouchableOpacity 
                  onPress={() => { setSelectedStatus(item.name); setShowStatusModal(false); }}
                  style={styles.modalOptionItem}
                >
                  <Text style={[styles.modalOptionText, selectedStatus === item.name && styles.modalOptionTextActive]}>
                    {item.name}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Sector Picker Modal */}
      <Modal visible={showSectorModal} transparent animationType="fade" onRequestClose={() => setShowSectorModal(false)}>
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowSectorModal(false)}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalHeaderTitle}>Select Sector</Text>
            <FlatList
              data={[{ _id: 'unassigned', name: 'Unassigned' }, ...sectors]}
              keyExtractor={(item) => item._id || item.name}
              renderItem={({ item }) => (
                <TouchableOpacity 
                  onPress={() => { 
                    setSelectedSector(item.name); 
                    setSelectedSubsector('Unassigned');
                    setShowSectorModal(false); 
                  }}
                  style={styles.modalOptionItem}
                >
                  <Text style={[styles.modalOptionText, selectedSector === item.name && styles.modalOptionTextActive]}>
                    {item.name}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Subsector Picker Modal */}
      <Modal visible={showSubsectorModal} transparent animationType="fade" onRequestClose={() => setShowSubsectorModal(false)}>
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowSubsectorModal(false)}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalHeaderTitle}>Select Subsector</Text>
            <FlatList
              data={[{ name: 'Unassigned' }, ...subsectorsList.map(s => ({ name: s }))]}
              keyExtractor={(item) => item.name}
              renderItem={({ item }) => (
                <TouchableOpacity 
                  onPress={() => { 
                    setSelectedSubsector(item.name); 
                    setShowSubsectorModal(false); 
                  }}
                  style={styles.modalOptionItem}
                >
                  <Text style={[styles.modalOptionText, selectedSubsector === item.name && styles.modalOptionTextActive]}>
                    {item.name}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Specialist Picker Modal */}
      <Modal visible={showAssignedModal} transparent animationType="fade" onRequestClose={() => setShowAssignedModal(false)}>
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowAssignedModal(false)}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalHeaderTitle}>Select Specialist</Text>
            <FlatList
              data={[{ _id: '', name: 'Unassigned' }, ...executives]}
              keyExtractor={(item) => item._id}
              renderItem={({ item }) => (
                <TouchableOpacity 
                  onPress={() => { 
                    setSelectedAssignedTo(item._id); 
                    setShowAssignedModal(false); 
                  }}
                  style={styles.modalOptionItem}
                >
                  <Text style={[styles.modalOptionText, selectedAssignedTo === item._id && styles.modalOptionTextActive]}>
                    {item.name}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Custom Field Picker Modal */}
      <Modal visible={activeCustomFieldModal !== null} transparent animationType="fade" onRequestClose={() => setActiveCustomFieldModal(null)}>
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setActiveCustomFieldModal(null)}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalHeaderTitle}>Select {activeCustomFieldModal?.label}</Text>
            <FlatList
              data={['', ...(activeCustomFieldModal?.options || [])]}
              keyExtractor={(item, index) => String(index)}
              renderItem={({ item }) => {
                const currentVal = activeCustomFieldModal ? (customFieldValues[activeCustomFieldModal.name] || '') : '';
                const isSelected = currentVal === item || (activeCustomFieldModal?.type === 'COMBOBOX' && currentVal.includes(item));
                return (
                  <TouchableOpacity 
                    onPress={() => { 
                      handleCustomFieldChange(activeCustomFieldModal.name, item); 
                      setActiveCustomFieldModal(null); 
                    }}
                    style={styles.modalOptionItem}
                  >
                    <Text style={[styles.modalOptionText, isSelected && styles.modalOptionTextActive]}>
                      {item === '' ? 'None' : item}
                    </Text>
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  dropdownFieldButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderWidth: 1.5,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 48,
    marginTop: 4,
    marginBottom: 12,
  },
  dropdownFieldButtonText: {
    fontSize: 14,
    color: '#1e293b',
    fontWeight: '500',
  },
  dropdownFieldArrow: {
    fontSize: 10,
    color: '#64748b',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '80%',
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    maxHeight: '60%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 5,
  },
  modalHeaderTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#008069',
  },
  modalOptionItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  modalOptionText: {
    fontSize: 15,
    color: '#1e293b',
  },
  modalOptionTextActive: {
    fontWeight: 'bold',
    color: '#008069',
  },
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  scrollContent: {
    padding: 16,
  },
  profileCard: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
    marginBottom: 20,
  },
  avatarLarge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#00a884',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarLargeText: {
    color: '#ffffff',
    fontSize: 32,
    fontWeight: 'bold',
  },
  profileName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  profilePhone: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 4,
  },
  section: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingBottom: 12,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#008069',
    marginLeft: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    marginTop: 12,
    marginBottom: 8,
  },
  pickerContainer: {
    marginBottom: 4,
  },
  chipsScroll: {
    paddingVertical: 4,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  activeChip: {
    backgroundColor: '#e7fce3',
    borderColor: '#00a884',
  },
  chipText: {
    fontSize: 13,
    color: '#475569',
    fontWeight: '600',
  },
  activeChipText: {
    color: '#008069',
    fontWeight: '700',
  },
  fieldRow: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 6,
  },
  fieldInput: {
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 10,
    fontSize: 14,
    color: '#1e293b',
    backgroundColor: '#f8fafc',
  },
  miniChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    backgroundColor: '#f8fafc',
    marginRight: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  activeMiniChip: {
    backgroundColor: '#e0f2fe',
    borderColor: '#0284c7',
  },
  miniChipText: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
  },
  activeMiniChipText: {
    color: '#0369a1',
    fontWeight: '700',
  },
  emptyFieldsText: {
    fontSize: 13,
    color: '#94a3b8',
    textAlign: 'center',
    paddingVertical: 12,
  },
  saveButton: {
    backgroundColor: '#00a884',
    borderRadius: 28,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
    shadowColor: '#00a884',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
