import React, { memo } from 'react';
import { View, Text, Image, StyleSheet, Linking, TouchableOpacity } from 'react-native';
import { Check, CheckCheck, AlertCircle, FileText, ExternalLink } from 'lucide-react-native';

const MessageBubble = memo(({ msg, onLongPress }) => {
  const isOutbound = msg.direction === 'outbound';
  const bubbleStyle = isOutbound ? styles.outboundBubble : styles.inboundBubble;
  const alignmentStyle = isOutbound ? styles.outboundAlign : styles.inboundAlign;

  const handleDownload = (url) => {
    if (url) {
      Linking.openURL(url).catch(err => console.error("Couldn't open URL", err));
    }
  };

  const renderStatusIcon = () => {
    if (!isOutbound) return null;
    const color = msg.status === 'read' ? '#53bdeb' : (msg.status === 'failed' ? '#ef4444' : '#8696a0');
    
    if (msg.status === 'sent') {
      return <Check size={14} color={color} />;
    } else if (msg.status === 'delivered' || msg.status === 'read') {
      return <CheckCheck size={14} color={color} />;
    } else if (msg.status === 'failed') {
      return <AlertCircle size={14} color={color} />;
    }
    return null;
  };

  return (
    <View style={[styles.container, alignmentStyle]}>
      <TouchableOpacity 
        activeOpacity={0.85}
        onLongPress={onLongPress}
        style={[styles.bubble, bubbleStyle]}
      >
        {/* Quoted Message (Reply Preview) */}
        {msg.quotedMessageBody && (
          <View style={[
            styles.quotedContainer, 
            { backgroundColor: isOutbound ? 'rgba(0,0,0,0.06)' : 'rgba(0,0,0,0.03)' }
          ]}>
            <Text style={styles.quotedLabel}>Replying to message</Text>
            <Text style={styles.quotedText} numberOfLines={2}>{msg.quotedMessageBody}</Text>
          </View>
        )}

        {/* Media Attachments */}
        {msg.mediaUrl && (
          <View style={styles.mediaContainer}>
            {msg.type === 'image' ? (
              <TouchableOpacity onPress={() => handleDownload(msg.mediaUrl)}>
                <Image 
                  source={{ uri: msg.mediaUrl }} 
                  style={styles.attachedImage} 
                  resizeMode="cover"
                />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity 
                style={styles.fileRow} 
                onPress={() => handleDownload(msg.mediaUrl)}
              >
                <FileText size={28} color="#00a884" />
                <View style={styles.fileInfo}>
                  <Text style={styles.fileName} numberOfLines={1}>
                    {msg.body || 'Attached Document'}
                  </Text>
                  <Text style={styles.fileDownload}>Tap to Open/Download</Text>
                </View>
                <ExternalLink size={16} color="#8696a0" />
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Message Body Text */}
        {msg.body && (!msg.mediaUrl || msg.type === 'image') && (
          <Text style={styles.bodyText}>{msg.body}</Text>
        )}

        {/* Template Buttons */}
        {msg.type === 'template' && msg.templateData && (
          <View style={styles.templateContainer}>
            <Text style={styles.bodyText}>{msg.body || `Template: ${msg.templateData.name}`}</Text>
            <View style={styles.templateDivider} />
            <Text style={styles.templateActionText}>Template Message</Text>
          </View>
        )}

        {/* Timestamp and Receipt status */}
        <View style={styles.infoRow}>
          <Text style={styles.timeText}>
            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
          {renderStatusIcon()}
        </View>

        {/* Reaction badge */}
        {msg.reaction && (
          <View style={[
            styles.reactionBadge,
            isOutbound ? styles.reactionOutbound : styles.reactionInbound
          ]}>
            <Text style={styles.reactionText}>{msg.reaction}</Text>
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginVertical: 4,
    paddingHorizontal: 8,
    position: 'relative',
  },
  outboundAlign: {
    alignItems: 'flex-end',
  },
  inboundAlign: {
    alignItems: 'flex-start',
  },
  bubble: {
    maxWidth: '80%',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 1,
    position: 'relative',
    marginBottom: 8, // space for reaction badge
  },
  outboundBubble: {
    backgroundColor: '#d9fdd3',
    borderTopRightRadius: 2,
  },
  inboundBubble: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 2,
  },
  bodyText: {
    fontSize: 15,
    color: '#111b21',
    lineHeight: 20,
  },
  mediaContainer: {
    marginBottom: 4,
    borderRadius: 8,
    overflow: 'hidden',
  },
  attachedImage: {
    width: 220,
    height: 180,
    borderRadius: 8,
  },
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    padding: 10,
    borderRadius: 8,
    width: 220,
  },
  fileInfo: {
    flex: 1,
    marginLeft: 10,
    marginRight: 6,
  },
  fileName: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  fileDownload: {
    fontSize: 11,
    color: '#00a884',
    marginTop: 2,
  },
  templateContainer: {
    marginTop: 4,
  },
  templateDivider: {
    height: 1,
    backgroundColor: '#e2e8f0',
    marginVertical: 8,
  },
  templateActionText: {
    color: '#008069',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 2,
    alignSelf: 'flex-end',
  },
  timeText: {
    fontSize: 10,
    color: '#667781',
    marginRight: 4,
  },
  quotedContainer: {
    borderLeftWidth: 4,
    borderLeftColor: '#00a884',
    borderRadius: 6,
    padding: 6,
    marginBottom: 6,
  },
  quotedLabel: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#00a884',
    marginBottom: 2,
  },
  quotedText: {
    fontSize: 12,
    color: '#475569',
  },
  reactionBadge: {
    position: 'absolute',
    bottom: -10,
    backgroundColor: '#ffffff',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 2,
    zIndex: 10,
  },
  reactionOutbound: {
    left: 10,
  },
  reactionInbound: {
    right: 10,
  },
  reactionText: {
    fontSize: 12,
  },
});

export default MessageBubble;
