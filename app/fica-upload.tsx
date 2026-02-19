import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { useAuth } from '../contexts/AuthContext';
import { storage } from '../lib/firebase';
import { Colors } from '../constants/Colors';

interface DocSlot {
  key: 'idDocument' | 'proofOfAddress' | 'bankConfirmation';
  label: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  ficaField: 'idDocument' | 'proofOfAddress' | 'bankConfirmation';
  timestampField: 'idDocumentUploadedAt' | 'proofOfAddressUploadedAt' | 'bankConfirmationUploadedAt';
}

const documents: DocSlot[] = [
  {
    key: 'idDocument',
    label: 'Identity Document',
    description: 'Certified copy of your SA ID or Smart ID card',
    icon: 'finger-print',
    ficaField: 'idDocument',
    timestampField: 'idDocumentUploadedAt',
  },
  {
    key: 'proofOfAddress',
    label: 'Proof of Address',
    description: 'Utility bill, bank statement, or municipal account (not older than 3 months)',
    icon: 'home',
    ficaField: 'proofOfAddress',
    timestampField: 'proofOfAddressUploadedAt',
  },
  {
    key: 'bankConfirmation',
    label: 'Confirmation of Banking Details',
    description: 'Bank confirmation letter or stamped bank statement',
    icon: 'card',
    ficaField: 'bankConfirmation',
    timestampField: 'bankConfirmationUploadedAt',
  },
];

export default function FicaUploadScreen() {
  const router = useRouter();
  const { userProfile, updateUserProfile } = useAuth();

  const [uploading, setUploading] = useState<Record<string, boolean>>({});
  const [localUris, setLocalUris] = useState<Record<string, string>>({});

  const getExistingUrl = (doc: DocSlot) => userProfile?.fica?.[doc.ficaField];
  const getUploadedAt = (doc: DocSlot) => userProfile?.fica?.[doc.timestampField];

  const pickAndUpload = async (doc: DocSlot) => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please allow access to your photo library to upload documents.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.8,
      });

      if (result.canceled || !result.assets?.[0]) return;

      const asset = result.assets[0];
      setLocalUris((prev) => ({ ...prev, [doc.key]: asset.uri }));
      setUploading((prev) => ({ ...prev, [doc.key]: true }));

      const uid = userProfile?.uid;
      if (!uid) {
        Alert.alert('Error', 'You must be logged in to upload documents.');
        setUploading((prev) => ({ ...prev, [doc.key]: false }));
        return;
      }

      const ext = asset.uri.split('.').pop() || 'jpg';
      const storagePath = `profiles/${uid}/fica/${doc.ficaField}.${ext}`;
      const storageRef = ref(storage, storagePath);

      const response = await fetch(asset.uri);
      const blob = await response.blob();

      const uploadTask = uploadBytesResumable(storageRef, blob);

      uploadTask.on(
        'state_changed',
        null,
        (error) => {
          console.error('Upload error:', error);
          Alert.alert('Upload Failed', 'Something went wrong. Please try again.');
          setUploading((prev) => ({ ...prev, [doc.key]: false }));
        },
        async () => {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          const now = new Date().toISOString();

          await updateUserProfile({
            fica: {
              ...userProfile?.fica,
              [doc.ficaField]: downloadURL,
              [doc.timestampField]: now,
            },
            updatedAt: now,
          });

          setUploading((prev) => ({ ...prev, [doc.key]: false }));
          Alert.alert('Uploaded', `${doc.label} uploaded successfully.`);
        },
      );
    } catch (error) {
      console.error('Pick/upload error:', error);
      Alert.alert('Error', 'Failed to upload document. Please try again.');
      setUploading((prev) => ({ ...prev, [doc.key]: false }));
    }
  };

  const takePhoto = async (doc: DocSlot) => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please allow camera access to take a photo of your document.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: false,
        quality: 0.8,
      });

      if (result.canceled || !result.assets?.[0]) return;

      const asset = result.assets[0];
      setLocalUris((prev) => ({ ...prev, [doc.key]: asset.uri }));
      setUploading((prev) => ({ ...prev, [doc.key]: true }));

      const uid = userProfile?.uid;
      if (!uid) {
        Alert.alert('Error', 'You must be logged in to upload documents.');
        setUploading((prev) => ({ ...prev, [doc.key]: false }));
        return;
      }

      const ext = asset.uri.split('.').pop() || 'jpg';
      const storagePath = `profiles/${uid}/fica/${doc.ficaField}.${ext}`;
      const storageRef = ref(storage, storagePath);

      const response = await fetch(asset.uri);
      const blob = await response.blob();

      const uploadTask = uploadBytesResumable(storageRef, blob);

      uploadTask.on(
        'state_changed',
        null,
        (error) => {
          console.error('Upload error:', error);
          Alert.alert('Upload Failed', 'Something went wrong. Please try again.');
          setUploading((prev) => ({ ...prev, [doc.key]: false }));
        },
        async () => {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          const now = new Date().toISOString();

          await updateUserProfile({
            fica: {
              ...userProfile?.fica,
              [doc.ficaField]: downloadURL,
              [doc.timestampField]: now,
            },
            updatedAt: now,
          });

          setUploading((prev) => ({ ...prev, [doc.key]: false }));
          Alert.alert('Uploaded', `${doc.label} uploaded successfully.`);
        },
      );
    } catch (error) {
      console.error('Camera upload error:', error);
      Alert.alert('Error', 'Failed to upload document. Please try again.');
      setUploading((prev) => ({ ...prev, [doc.key]: false }));
    }
  };

  const showUploadOptions = (doc: DocSlot) => {
    Alert.alert('Upload Document', `Choose how to upload your ${doc.label}`, [
      { text: 'Take Photo', onPress: () => takePhoto(doc) },
      { text: 'Choose from Library', onPress: () => pickAndUpload(doc) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const completedCount = documents.filter((d) => !!getExistingUrl(d)).length;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {/* Hero */}
      <View style={styles.hero}>
        <View style={styles.heroIcon}>
          <Ionicons name="document-attach" size={32} color={Colors.primary.blue} />
        </View>
        <Text style={styles.heroTitle}>FICA Documents</Text>
        <Text style={styles.heroDesc}>
          Upload your documents to comply with the Financial Intelligence Centre Act and unlock full access to financial products.
        </Text>
        <View style={styles.progressBadge}>
          <Text style={styles.progressBadgeText}>{completedCount} of {documents.length} uploaded</Text>
        </View>
      </View>

      {/* Document slots */}
      <View style={styles.docsSection}>
        {documents.map((doc) => {
          const existingUrl = getExistingUrl(doc);
          const uploadedAt = getUploadedAt(doc);
          const isUploading = uploading[doc.key];
          const preview = localUris[doc.key] || existingUrl;

          return (
            <View key={doc.key} style={[styles.docCard, !!existingUrl && styles.docCardDone]}>
              <View style={styles.docHeader}>
                <View style={[styles.docIconCircle, !!existingUrl && styles.docIconCircleDone]}>
                  <Ionicons name={doc.icon} size={20} color={existingUrl ? Colors.status.success : Colors.primary.blue} />
                </View>
                <View style={styles.docInfo}>
                  <View style={styles.docTitleRow}>
                    <Text style={styles.docLabel}>{doc.label}</Text>
                    {existingUrl && (
                      <View style={styles.doneBadge}>
                        <Ionicons name="checkmark-circle" size={14} color={Colors.status.success} />
                        <Text style={styles.doneBadgeText}>Uploaded</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.docDesc}>{doc.description}</Text>
                  {uploadedAt && (
                    <Text style={styles.docTimestamp}>
                      Uploaded {new Date(uploadedAt).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </Text>
                  )}
                </View>
              </View>

              {/* Preview thumbnail */}
              {preview && !isUploading && (
                <View style={styles.previewContainer}>
                  <Image source={{ uri: preview }} style={styles.previewImage} resizeMode="cover" />
                </View>
              )}

              {/* Upload / Replace button */}
              {isUploading ? (
                <View style={styles.uploadingRow}>
                  <ActivityIndicator size="small" color={Colors.primary.blue} />
                  <Text style={styles.uploadingText}>Uploading...</Text>
                </View>
              ) : (
                <TouchableOpacity
                  style={[styles.uploadButton, !!existingUrl && styles.uploadButtonReplace]}
                  onPress={() => showUploadOptions(doc)}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={existingUrl ? 'cloud-upload' : 'add-circle'}
                    size={18}
                    color={existingUrl ? Colors.text.secondary : '#fff'}
                  />
                  <Text style={[styles.uploadButtonText, !!existingUrl && styles.uploadButtonTextReplace]}>
                    {existingUrl ? 'Replace Document' : 'Upload Document'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })}
      </View>

      {/* Info note */}
      <View style={styles.noteCard}>
        <Ionicons name="shield-checkmark" size={18} color={Colors.primary.blue} />
        <View style={styles.noteContent}>
          <Text style={styles.noteTitle}>Secure & Private</Text>
          <Text style={styles.noteDesc}>
            Your documents are encrypted and stored securely. They are only used for FICA compliance and product applications. Allowed formats: JPEG, PNG. Max size: 5 MB per file.
          </Text>
        </View>
      </View>

      {/* Done CTA */}
      {completedCount === documents.length && (
        <TouchableOpacity style={styles.doneButton} onPress={() => router.back()} activeOpacity={0.8}>
          <Ionicons name="checkmark-circle" size={20} color="#fff" />
          <Text style={styles.doneButtonText}>All Documents Uploaded</Text>
        </TouchableOpacity>
      )}

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background.light1 },
  content: { flexGrow: 1 },
  hero: {
    alignItems: 'center',
    paddingVertical: 28,
    paddingHorizontal: 24,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  heroIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.primary.blue + '10',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.text.primary,
    marginBottom: 8,
  },
  heroDesc: {
    fontSize: 13,
    color: Colors.text.secondary,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 16,
  },
  progressBadge: {
    backgroundColor: Colors.primary.blue + '10',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 14,
  },
  progressBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary.blue,
  },
  docsSection: {
    padding: 16,
    gap: 14,
  },
  docCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  docCardDone: {
    borderColor: Colors.status.success + '40',
  },
  docHeader: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
  },
  docIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary.blue + '10',
    justifyContent: 'center',
    alignItems: 'center',
  },
  docIconCircleDone: {
    backgroundColor: Colors.status.success + '15',
  },
  docInfo: { flex: 1 },
  docTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  docLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  doneBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  doneBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.status.success,
  },
  docDesc: {
    fontSize: 12,
    color: Colors.text.secondary,
    lineHeight: 17,
  },
  docTimestamp: {
    fontSize: 10,
    color: Colors.text.light,
    marginTop: 4,
  },
  previewContainer: {
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 12,
    backgroundColor: Colors.background.light1,
  },
  previewImage: {
    width: '100%',
    height: 140,
    borderRadius: 10,
  },
  uploadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 12,
  },
  uploadingText: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.primary.blue,
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary.orange,
    paddingVertical: 12,
    borderRadius: 10,
  },
  uploadButtonReplace: {
    backgroundColor: Colors.background.light1,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  uploadButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  uploadButtonTextReplace: {
    color: Colors.text.secondary,
  },
  noteCard: {
    flexDirection: 'row',
    marginHorizontal: 16,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.primary.blue + '20',
  },
  noteContent: { flex: 1 },
  noteTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primary.blue,
    marginBottom: 4,
  },
  noteDesc: {
    fontSize: 12,
    color: Colors.text.secondary,
    lineHeight: 18,
  },
  doneButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 20,
    backgroundColor: Colors.status.success,
    paddingVertical: 14,
    borderRadius: 12,
  },
  doneButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
});
