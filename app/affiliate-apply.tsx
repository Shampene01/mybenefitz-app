import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../contexts/AuthContext';
import { Colors } from '../constants/Colors';
import { db, storage } from '../lib/firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

const PROVINCES = [
  'Eastern Cape', 'Free State', 'Gauteng', 'KwaZulu-Natal',
  'Limpopo', 'Mpumalanga', 'North West', 'Northern Cape', 'Western Cape',
];
const TITLES = ['Mr', 'Mrs', 'Ms', 'Dr', 'Prof'];
const CONTACT_METHODS = ['Phone', 'Email', 'WhatsApp'];

interface DocFile {
  key: string;
  label: string;
  uri: string;
  name: string;
}

export default function AffiliateApplyScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Form fields
  const [title, setTitle] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [preferredContact, setPreferredContact] = useState('');
  const [street, setStreet] = useState('');
  const [suburb, setSuburb] = useState('');
  const [town, setTown] = useState('');
  const [province, setProvince] = useState('');

  // Documents
  const [docs, setDocs] = useState<DocFile[]>([
    { key: 'idDocument', label: 'ID Document', uri: '', name: '' },
    { key: 'proofOfBanking', label: 'Proof of Banking', uri: '', name: '' },
    { key: 'proofOfAddress', label: 'Proof of Address', uri: '', name: '' },
  ]);

  // Consents
  const [popiaConsent, setPopiaConsent] = useState(false);
  const [bgCheckConsent, setBgCheckConsent] = useState(false);
  const [termsConsent, setTermsConsent] = useState(false);

  // Dropdowns
  const [showTitle, setShowTitle] = useState(false);
  const [showProvince, setShowProvince] = useState(false);
  const [showContact, setShowContact] = useState(false);

  useEffect(() => {
    if (!user) return;
    getDoc(doc(db, 'affiliateApplications', user.uid)).then((snap) => {
      if (snap.exists()) setSubmitted(true);
    }).finally(() => setLoading(false));
  }, [user]);

  const pickDocument = async (index: number) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please allow access to your photo library.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.8,
    });

    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    const fileName = asset.uri.split('/').pop() || 'document';

    setDocs((prev) =>
      prev.map((d, i) => i === index ? { ...d, uri: asset.uri, name: fileName } : d)
    );
  };

  const validate = (): string | null => {
    if (!title) return 'Please select a title.';
    if (!firstName.trim()) return 'First name is required.';
    if (!lastName.trim()) return 'Last name is required.';
    if (idNumber.length !== 13) return 'Please enter a valid 13-digit ID number.';
    if (!phone.trim()) return 'Phone number is required.';
    if (!email.trim()) return 'Email address is required.';
    if (!preferredContact) return 'Please select a preferred contact method.';
    if (!street.trim()) return 'Street address is required.';
    if (!suburb.trim()) return 'Suburb is required.';
    if (!town.trim()) return 'Town is required.';
    if (!province) return 'Please select a province.';
    if (!docs[0].uri) return 'Please upload your ID document.';
    if (!docs[1].uri) return 'Please upload proof of banking.';
    if (!docs[2].uri) return 'Please upload proof of address.';
    if (!popiaConsent) return 'Please accept the POPIA consent.';
    if (!bgCheckConsent) return 'Please accept the background check consent.';
    if (!termsConsent) return 'Please accept the Terms of Service.';
    return null;
  };

  const uploadFile = async (uri: string, path: string): Promise<string> => {
    const response = await fetch(uri);
    const blob = await response.blob();
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, blob);
    return getDownloadURL(storageRef);
  };

  const handleSubmit = async () => {
    const err = validate();
    if (err) { Alert.alert('Missing Information', err); return; }
    if (!user) return;

    setSubmitting(true);
    try {
      const docUrls: Record<string, string> = {};
      for (const d of docs) {
        if (d.uri) {
          const ext = d.name.split('.').pop()?.toLowerCase() || 'jpg';
          docUrls[d.key] = await uploadFile(d.uri, `profiles/${user.uid}/affiliate/${d.key}.${ext}`);
        }
      }

      await setDoc(doc(db, 'affiliateApplications', user.uid), {
        uid: user.uid,
        title,
        firstName,
        lastName,
        idNumber,
        phone,
        email,
        preferredContact,
        address: { street, suburb, town, province },
        documents: docUrls,
        consents: {
          popia: popiaConsent,
          backgroundCheck: bgCheckConsent,
          terms: termsConsent,
        },
        status: 'pending',
        createdAt: new Date().toISOString(),
      });

      setSubmitted(true);
      Alert.alert('Success', 'Your affiliate application has been submitted. We\'ll review it and get back to you.');
    } catch (e: unknown) {
      console.error(e);
      Alert.alert('Error', e instanceof Error ? e.message : 'Submission failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary.blue} />
      </View>
    );
  }

  if (submitted) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.successCard}>
          <View style={styles.successIcon}>
            <Ionicons name="checkmark-circle" size={48} color={Colors.status.success} />
          </View>
          <Text style={styles.successTitle}>Application Submitted</Text>
          <Text style={styles.successDesc}>
            We&apos;re reviewing your affiliate application. You&apos;ll be notified once approved.
          </Text>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()} activeOpacity={0.8}>
            <Text style={styles.backButtonText}>Back to Dashboard</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Personal Information */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionIconCircle}>
              <Ionicons name="person" size={18} color="#fff" />
            </View>
            <Text style={styles.sectionTitle}>Personal Information</Text>
          </View>

          {/* Title */}
          <Text style={styles.label}>Title</Text>
          <TouchableOpacity style={styles.selectField} onPress={() => setShowTitle(!showTitle)} activeOpacity={0.7}>
            <Text style={title ? styles.selectValue : styles.selectPlaceholder}>
              {title || 'Select title'}
            </Text>
            <Ionicons name="chevron-down" size={18} color={Colors.text.light} />
          </TouchableOpacity>
          {showTitle && (
            <View style={styles.dropdown}>
              {TITLES.map((t) => (
                <TouchableOpacity key={t} style={styles.dropdownItem} onPress={() => { setTitle(t); setShowTitle(false); }}>
                  <Text style={[styles.dropdownText, t === title && styles.dropdownTextActive]}>{t}</Text>
                  {t === title && <Ionicons name="checkmark" size={18} color={Colors.primary.blue} />}
                </TouchableOpacity>
              ))}
            </View>
          )}

          <Text style={styles.label}>First Name</Text>
          <TextInput style={styles.input} value={firstName} onChangeText={setFirstName} placeholder="Enter your first name" placeholderTextColor={Colors.text.light} />

          <Text style={styles.label}>Last Name</Text>
          <TextInput style={styles.input} value={lastName} onChangeText={setLastName} placeholder="Enter your last name" placeholderTextColor={Colors.text.light} />

          <Text style={styles.label}>ID Number</Text>
          <TextInput style={styles.input} value={idNumber} onChangeText={(v) => setIdNumber(v.replace(/\D/g, '').slice(0, 13))} placeholder="Enter your 13-digit ID number" placeholderTextColor={Colors.text.light} keyboardType="number-pad" maxLength={13} />
        </View>

        {/* Contact Information */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionIconCircle}>
              <Ionicons name="call" size={18} color="#fff" />
            </View>
            <Text style={styles.sectionTitle}>Contact Information</Text>
          </View>

          <Text style={styles.label}>Phone Number</Text>
          <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="Enter your phone number" placeholderTextColor={Colors.text.light} keyboardType="phone-pad" />

          <Text style={styles.label}>Email Address</Text>
          <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder="Enter your email address" placeholderTextColor={Colors.text.light} keyboardType="email-address" autoCapitalize="none" />

          <Text style={styles.label}>Preferred Contact Method</Text>
          <TouchableOpacity style={styles.selectField} onPress={() => setShowContact(!showContact)} activeOpacity={0.7}>
            <Text style={preferredContact ? styles.selectValue : styles.selectPlaceholder}>
              {preferredContact || 'Select contact method'}
            </Text>
            <Ionicons name="chevron-down" size={18} color={Colors.text.light} />
          </TouchableOpacity>
          {showContact && (
            <View style={styles.dropdown}>
              {CONTACT_METHODS.map((m) => (
                <TouchableOpacity key={m} style={styles.dropdownItem} onPress={() => { setPreferredContact(m); setShowContact(false); }}>
                  <Text style={[styles.dropdownText, m === preferredContact && styles.dropdownTextActive]}>{m}</Text>
                  {m === preferredContact && <Ionicons name="checkmark" size={18} color={Colors.primary.blue} />}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Address Information */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionIconCircle}>
              <Ionicons name="location" size={18} color="#fff" />
            </View>
            <Text style={styles.sectionTitle}>Address Information</Text>
          </View>

          <Text style={styles.label}>Street Address</Text>
          <TextInput style={styles.input} value={street} onChangeText={setStreet} placeholder="Enter your street address" placeholderTextColor={Colors.text.light} />

          <Text style={styles.label}>Suburb</Text>
          <TextInput style={styles.input} value={suburb} onChangeText={setSuburb} placeholder="Enter your suburb" placeholderTextColor={Colors.text.light} />

          <Text style={styles.label}>Town</Text>
          <TextInput style={styles.input} value={town} onChangeText={setTown} placeholder="Enter your town" placeholderTextColor={Colors.text.light} />

          <Text style={styles.label}>Province</Text>
          <TouchableOpacity style={styles.selectField} onPress={() => setShowProvince(!showProvince)} activeOpacity={0.7}>
            <Text style={province ? styles.selectValue : styles.selectPlaceholder}>
              {province || 'Select province'}
            </Text>
            <Ionicons name="chevron-down" size={18} color={Colors.text.light} />
          </TouchableOpacity>
          {showProvince && (
            <View style={styles.dropdown}>
              {PROVINCES.map((p) => (
                <TouchableOpacity key={p} style={styles.dropdownItem} onPress={() => { setProvince(p); setShowProvince(false); }}>
                  <Text style={[styles.dropdownText, p === province && styles.dropdownTextActive]}>{p}</Text>
                  {p === province && <Ionicons name="checkmark" size={18} color={Colors.primary.blue} />}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Required Documents */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionIconCircle}>
              <Ionicons name="document-text" size={18} color="#fff" />
            </View>
            <Text style={styles.sectionTitle}>Required Documents</Text>
          </View>

          {docs.map((d, i) => (
            <TouchableOpacity key={d.key} style={styles.docRow} onPress={() => pickDocument(i)} activeOpacity={0.7}>
              <View style={[styles.docIcon, d.uri ? styles.docIconDone : null]}>
                <Ionicons name={d.uri ? 'checkmark-circle' : 'cloud-upload'} size={20} color={d.uri ? Colors.status.success : Colors.text.light} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.docLabel}>{d.label}</Text>
                <Text style={styles.docFilename} numberOfLines={1}>
                  {d.name || 'No file chosen'}
                </Text>
              </View>
              <View style={styles.docUploadBadge}>
                <Text style={styles.docUploadText}>{d.uri ? 'Change' : 'Upload'}</Text>
              </View>
            </TouchableOpacity>
          ))}
          <Text style={styles.hint}>Accepted: JPG, PNG · Max 5 MB per file</Text>
        </View>

        {/* Consents */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionIconCircle}>
              <Ionicons name="shield-checkmark" size={18} color="#fff" />
            </View>
            <Text style={styles.sectionTitle}>Consents</Text>
          </View>

          <TouchableOpacity style={styles.consentRow} onPress={() => setPopiaConsent(!popiaConsent)} activeOpacity={0.7}>
            <View style={[styles.checkbox, popiaConsent && styles.checkboxChecked]}>
              {popiaConsent && <Ionicons name="checkmark" size={14} color="#fff" />}
            </View>
            <Text style={styles.consentText}>I consent to the collection and processing of my personal information as per POPIA</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.consentRow} onPress={() => setBgCheckConsent(!bgCheckConsent)} activeOpacity={0.7}>
            <View style={[styles.checkbox, bgCheckConsent && styles.checkboxChecked]}>
              {bgCheckConsent && <Ionicons name="checkmark" size={14} color="#fff" />}
            </View>
            <Text style={styles.consentText}>I consent to criminal background checks</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.consentRow} onPress={() => setTermsConsent(!termsConsent)} activeOpacity={0.7}>
            <View style={[styles.checkbox, termsConsent && styles.checkboxChecked]}>
              {termsConsent && <Ionicons name="checkmark" size={14} color="#fff" />}
            </View>
            <Text style={styles.consentText}>I accept the Terms of Service for the affiliate programme</Text>
          </TouchableOpacity>
        </View>

        {/* Submit */}
        <TouchableOpacity
          style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
          activeOpacity={0.8}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Ionicons name="send" size={18} color="#fff" />
              <Text style={styles.submitButtonText}>Submit Application</Text>
            </>
          )}
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background.light1 },
  content: { flexGrow: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Success state
  successCard: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  successIcon: { marginBottom: 20 },
  successTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.text.primary,
    marginBottom: 10,
  },
  successDesc: {
    fontSize: 14,
    color: Colors.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 28,
  },
  backButton: {
    backgroundColor: Colors.primary.blue,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
  },
  backButtonText: { fontSize: 15, fontWeight: '700', color: '#fff' },

  // Sections
  section: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 18,
  },
  sectionIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: Colors.primary.blue,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text.primary,
  },

  // Fields
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text.secondary,
    marginBottom: 6,
    marginTop: 14,
  },
  input: {
    backgroundColor: Colors.background.light1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    color: Colors.text.primary,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  selectField: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.background.light1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  selectValue: { fontSize: 15, color: Colors.text.primary },
  selectPlaceholder: { fontSize: 15, color: Colors.text.light },

  // Dropdown
  dropdown: {
    backgroundColor: '#fff',
    borderRadius: 10,
    marginTop: 4,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  dropdownItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border,
  },
  dropdownText: { fontSize: 14, color: Colors.text.primary },
  dropdownTextActive: { color: Colors.primary.blue, fontWeight: '600' },

  // Documents
  docRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.background.light1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  docIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  docIconDone: {
    borderColor: Colors.status.success + '40',
    backgroundColor: Colors.status.success + '10',
  },
  docLabel: { fontSize: 14, fontWeight: '600', color: Colors.text.primary },
  docFilename: { fontSize: 11, color: Colors.text.light, marginTop: 2 },
  docUploadBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: Colors.primary.blue + '10',
  },
  docUploadText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.primary.blue,
  },
  hint: {
    fontSize: 11,
    color: Colors.text.light,
    marginTop: 4,
  },

  // Consents
  consentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: Colors.background.light1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 1,
  },
  checkboxChecked: {
    backgroundColor: Colors.primary.blue,
    borderColor: Colors.primary.blue,
  },
  consentText: {
    flex: 1,
    fontSize: 13,
    color: Colors.text.secondary,
    lineHeight: 19,
  },

  // Submit
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: Colors.primary.orange,
    marginHorizontal: 16,
    marginTop: 24,
    paddingVertical: 16,
    borderRadius: 14,
  },
  submitButtonDisabled: { opacity: 0.6 },
  submitButtonText: { fontSize: 16, fontWeight: '700', color: '#fff' },
});
