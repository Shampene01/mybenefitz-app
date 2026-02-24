import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { updateProfile } from 'firebase/auth';
import { useAuth } from '../contexts/AuthContext';
import { auth, storage } from '../lib/firebase';
import { Colors } from '../constants/Colors';
import { isValidSAID } from '../lib/productUtils';
import { fuzzyMatch, verifyWithHomeAffairs } from '../lib/verification';

export default function EditProfileScreen() {
  const { userProfile, updateUserProfile, isHomeAffairsVerified, isAccountFlagged } = useAuth();
  const router = useRouter();
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();

  const [firstName, setFirstName] = useState(userProfile?.firstName || '');
  const [lastName, setLastName] = useState(userProfile?.lastName || '');
  const [displayName, setDisplayName] = useState(userProfile?.displayName || '');
  const [phoneNumber, setPhoneNumber] = useState(userProfile?.phoneNumber || '');
  const [whatsappNumber, setWhatsappNumber] = useState(userProfile?.whatsappNumber || '');
  const [idNumber, setIdNumber] = useState(userProfile?.idNumber || '');
  const [street, setStreet] = useState(userProfile?.address?.street || '');
  const [unitNumber, setUnitNumber] = useState(userProfile?.address?.unitNumber || '');
  const [complexName, setComplexName] = useState(userProfile?.address?.complexName || '');
  const [suburb, setSuburb] = useState(userProfile?.address?.suburb || '');
  const [city, setCity] = useState(userProfile?.address?.city || '');
  const [province, setProvince] = useState(userProfile?.address?.province || '');
  const [postalCode, setPostalCode] = useState(userProfile?.address?.postalCode || '');
  const [employerName, setEmployerName] = useState(userProfile?.income?.employerName || '');
  const [employerEmail, setEmployerEmail] = useState(userProfile?.income?.employerEmail || '');
  const [grossSalary, setGrossSalary] = useState(userProfile?.income?.grossSalary?.toString() || '');
  const [netSalary, setNetSalary] = useState(userProfile?.income?.netSalary?.toString() || '');
  const [photoURL, setPhotoURL] = useState(userProfile?.photoURL || '');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState(false);

  // Locked field logic — match webapp: check both verification status and lockedFields array
  const lockedFields = userProfile?.identityVerification?.lockedFields || [];
  const isIdLocked = isHomeAffairsVerified || lockedFields.includes('idNumber');
  const isNameLocked = isHomeAffairsVerified || lockedFields.includes('firstName') || lockedFields.includes('lastName');
  // Allow retry if previous attempt failed (not yet verified and has a requestedAt)
  const verificationFailed = !!userProfile?.identityVerification?.requestedAt &&
    userProfile?.identityVerification?.status !== 'home_affairs_verified';
  const hasAttemptedVerification = !!userProfile?.identityVerification?.requestedAt && !verificationFailed;

  const SA_PROVINCES = [
    'Eastern Cape', 'Free State', 'Gauteng', 'KwaZulu-Natal',
    'Limpopo', 'Mpumalanga', 'North West', 'Northern Cape', 'Western Cape',
  ];

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please grant photo library access to upload a profile picture.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });

    if (!result.canceled && result.assets[0]) {
      await uploadImage(result.assets[0].uri);
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please grant camera access to take a profile picture.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });

    if (!result.canceled && result.assets[0]) {
      await uploadImage(result.assets[0].uri);
    }
  };

  const uploadImage = async (uri: string) => {
    if (!auth.currentUser) return;
    setUploading(true);
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      const storageRef = ref(storage, `profile-images/${auth.currentUser.uid}/profile.jpg`);
      await uploadBytes(storageRef, blob);
      const downloadURL = await getDownloadURL(storageRef);
      setPhotoURL(downloadURL);
      await updateProfile(auth.currentUser, { photoURL: downloadURL });
      await updateUserProfile({ photoURL: downloadURL });
      Alert.alert('Success', 'Profile picture updated!');
    } catch (error) {
      console.log('Upload error:', error);
      Alert.alert('Error', 'Failed to upload image. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const showImageOptions = () => {
    Alert.alert('Profile Picture', 'Choose an option', [
      { text: 'Take Photo', onPress: takePhoto },
      { text: 'Choose from Library', onPress: pickImage },
      ...(photoURL ? [{ text: 'Remove Photo', style: 'destructive' as const, onPress: removePhoto }] : []),
      { text: 'Cancel', style: 'cancel' as const },
    ]);
  };

  const removePhoto = async () => {
    try {
      setPhotoURL('');
      if (auth.currentUser) {
        await updateProfile(auth.currentUser, { photoURL: '' });
      }
      await updateUserProfile({ photoURL: '' });
    } catch (error) {
      console.log('Remove photo error:', error);
    }
  };

  const handleSave = async () => {
    if (isAccountFlagged) {
      Alert.alert('Account Suspended', 'Your account has been flagged. Please contact support.');
      return;
    }

    if (!firstName.trim() || !lastName.trim()) {
      Alert.alert('Error', 'First name and surname are required.');
      return;
    }

    // Validate SA ID format if provided
    if (idNumber.trim() && !isValidSAID(idNumber.trim())) {
      Alert.alert('Invalid ID', 'Please enter a valid 13-digit South African ID number.');
      return;
    }

    const fullName = `${firstName.trim()} ${lastName.trim()}`;
    setSaving(true);

    try {
      // One-shot verification: only verify if ID provided, not already verified, and not already attempted
      const shouldVerify = idNumber.trim() && !isHomeAffairsVerified && !hasAttemptedVerification;

      let verificationData: Record<string, any> = {};

      if (shouldVerify) {
        setVerifying(true);
        try {
          const idToken = await auth.currentUser?.getIdToken();
          if (!idToken) throw new Error('Not authenticated');

          const result = await verifyWithHomeAffairs(idNumber.trim(), idToken);

          if (result.success && result.verification) {
            const { firstName: haFirst, lastName: haLast } = result.verification;

            // Fuzzy match first name
            const firstMatch = fuzzyMatch(firstName.trim(), haFirst);
            // Fuzzy match last name
            const lastMatch = fuzzyMatch(lastName.trim(), haLast);

            if (firstMatch.isFraud || lastMatch.isFraud) {
              // Flag account — block further transactions
              await updateUserProfile({
                accountFlagged: true,
                accountFlaggedReason: `ID verification name mismatch: Captured "${firstName.trim()} ${lastName.trim()}" vs Home Affairs "${haFirst} ${haLast}"`,
                accountFlaggedAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              });
              Alert.alert(
                'Account Flagged',
                'Your account has been flagged due to a significant name mismatch with Home Affairs records. ' +
                'All transactions are suspended. Please send a message to +27 64 340 4602 on WhatsApp requesting a review.',
              );
              setSaving(false);
              setVerifying(false);
              return;
            }

            if (!firstMatch.matches || !lastMatch.matches) {
              // Names don't match well but not fraud-level — let them correct
              Alert.alert(
                'Name Mismatch',
                `Name verification failed. Home Affairs records show: "${haFirst} ${haLast}". ` +
                `Please update your name and surname to match your ID document exactly, then save again.`,
              );
              setSaving(false);
              setVerifying(false);
              return;
            }

            // Names match — save profile with the verified names from Home Affairs
            // Note: The Home Affairs service already writes identityVerification to Firestore
            verificationData = {
              firstName: haFirst,
              lastName: haLast,
              displayName: `${haFirst} ${haLast}`,
            };
            // Update local state with verified names
            setFirstName(haFirst);
            setLastName(haLast);
            setDisplayName(`${haFirst} ${haLast}`);
          } else {
            // Verification API failed — will save profile data anyway but warn user
            verificationData.__warning = result.error || 'Unknown error';
          }
        } catch (err) {
          console.log('[edit-profile] HA verification error:', err);
          // Don't block save if verification service is unavailable
        } finally {
          setVerifying(false);
        }
      }

      const saveName = verificationData.firstName || firstName.trim();
      const saveLast = verificationData.lastName || lastName.trim();
      const saveFullName = `${saveName} ${saveLast}`;

      if (auth.currentUser) {
        await updateProfile(auth.currentUser, { displayName: saveFullName });
      }

      // Strip internal flags before saving to Firestore
      const { __warning, ...saveVerificationData } = verificationData;
      await updateUserProfile({
        firstName: saveName,
        lastName: saveLast,
        displayName: saveFullName,
        phoneNumber: phoneNumber.trim(),
        whatsappNumber: whatsappNumber.trim(),
        idNumber: idNumber.trim(),
        address: {
          street: street.trim(),
          unitNumber: unitNumber.trim(),
          complexName: complexName.trim(),
          suburb: suburb.trim(),
          city: city.trim(),
          province,
          postalCode: postalCode.trim(),
        },
        income: {
          employerName: employerName.trim(),
          employerEmail: employerEmail.trim(),
          grossSalary: grossSalary ? Number(grossSalary) : '',
          netSalary: netSalary ? Number(netSalary) : '',
        },
        updatedAt: new Date().toISOString(),
        ...saveVerificationData,
      });

      const navigateBack = () => {
        if (returnTo) {
          router.replace(returnTo as any);
        } else {
          router.back();
        }
      };

      const successMessage = verificationData.__warning
        ? `Profile saved. ID verification could not be completed: ${verificationData.__warning}`
        : shouldVerify && verificationData.firstName
          ? 'Profile saved and identity verified with Home Affairs! Your name, surname, and ID number are now locked.'
          : 'Profile updated successfully!';
      Alert.alert('Success', successMessage, [
        { text: 'OK', onPress: navigateBack },
      ]);
    } catch (error) {
      console.log('Save error:', error);
      Alert.alert('Error', 'Failed to update profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.avatarSection}>
          <TouchableOpacity onPress={showImageOptions} style={styles.avatarWrapper}>
            {photoURL ? (
              <Image source={{ uri: photoURL }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Ionicons name="person" size={48} color={Colors.primary.blue} />
              </View>
            )}
            <View style={styles.cameraIcon}>
              {uploading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="camera" size={18} color="#fff" />
              )}
            </View>
          </TouchableOpacity>
          <Text style={styles.changePhotoText}>Tap to change photo</Text>
        </View>

        {/* Account Flagged Banner */}
        {isAccountFlagged && (
          <View style={styles.flagBanner}>
            <Ionicons name="alert-circle" size={22} color="#dc2626" />
            <View style={{ flex: 1 }}>
              <Text style={styles.flagBannerTitle}>Account Flagged — Transactions Suspended</Text>
              <Text style={styles.flagBannerDesc}>
                Your account has been flagged due to a name mismatch during identity verification. Please contact support on WhatsApp at +27 64 340 4602.
              </Text>
            </View>
          </View>
        )}

        {/* Verification Status Banner */}
        {isHomeAffairsVerified && (
          <View style={styles.verifiedBanner}>
            <Ionicons name="shield-checkmark" size={22} color="#15803d" />
            <View style={{ flex: 1 }}>
              <Text style={styles.verifiedBannerTitle}>Identity Verified with Home Affairs</Text>
              <Text style={styles.verifiedBannerDesc}>
                Your ID number, name, and surname have been verified and are now locked. You earn 10 points for Personal Details!
              </Text>
            </View>
          </View>
        )}

        {/* Verifying Indicator */}
        {verifying && (
          <View style={styles.verifyingBanner}>
            <ActivityIndicator size="small" color={Colors.primary.blue} />
            <Text style={styles.verifyingText}>Verifying your identity with Home Affairs...</Text>
          </View>
        )}

        {/* Personal Details */}
        <View style={styles.formSection}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <Text style={[styles.sectionLabel, { marginBottom: 0 }]}>Personal Details</Text>
            {isNameLocked && (
              <View style={styles.lockedBadge}>
                <Ionicons name="lock-closed" size={12} color="#15803d" />
                <Text style={styles.lockedBadgeText}>Verified & Locked</Text>
              </View>
            )}
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>First Name *</Text>
            {isNameLocked ? (
              <View style={styles.disabledInput}>
                <Text style={styles.disabledText}>{firstName}</Text>
                <Ionicons name="lock-closed" size={16} color="#15803d" />
              </View>
            ) : (
              <TextInput style={styles.input} value={firstName} onChangeText={(v) => { setFirstName(v); setDisplayName(`${v} ${lastName}`.trim()); }} placeholder="Enter your first name" placeholderTextColor={Colors.text.light} />
            )}
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Surname *</Text>
            {isNameLocked ? (
              <View style={styles.disabledInput}>
                <Text style={styles.disabledText}>{lastName}</Text>
                <Ionicons name="lock-closed" size={16} color="#15803d" />
              </View>
            ) : (
              <TextInput style={styles.input} value={lastName} onChangeText={(v) => { setLastName(v); setDisplayName(`${firstName} ${v}`.trim()); }} placeholder="Enter your surname" placeholderTextColor={Colors.text.light} />
            )}
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email</Text>
            <View style={styles.disabledInput}>
              <Text style={styles.disabledText}>{userProfile?.email}</Text>
              <Ionicons name="lock-closed" size={16} color={Colors.text.light} />
            </View>
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>SA ID Number</Text>
            {isIdLocked ? (
              <View style={styles.disabledInput}>
                <Text style={styles.disabledText}>{idNumber}</Text>
                <Ionicons name="lock-closed" size={16} color="#15803d" />
              </View>
            ) : (
              <TextInput style={styles.input} value={idNumber} onChangeText={setIdNumber} placeholder="e.g. 9001015009087" placeholderTextColor={Colors.text.light} keyboardType="number-pad" maxLength={13} />
            )}
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Phone Number</Text>
            <TextInput style={styles.input} value={phoneNumber} onChangeText={setPhoneNumber} placeholder="e.g. 072 123 4567" placeholderTextColor={Colors.text.light} keyboardType="phone-pad" />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>WhatsApp Number</Text>
            <TextInput style={styles.input} value={whatsappNumber} onChangeText={setWhatsappNumber} placeholder="e.g. 072 123 4567" placeholderTextColor={Colors.text.light} keyboardType="phone-pad" />
          </View>
        </View>

        {/* Physical Address */}
        <View style={styles.formSection}>
          <Text style={styles.sectionLabel}>Physical Address</Text>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Street Address *</Text>
            <TextInput style={styles.input} value={street} onChangeText={setStreet} placeholder="e.g. 123 Main Road" placeholderTextColor={Colors.text.light} />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Unit Number</Text>
            <TextInput style={styles.input} value={unitNumber} onChangeText={setUnitNumber} placeholder="e.g. Unit 4 (optional)" placeholderTextColor={Colors.text.light} />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Complex Name</Text>
            <TextInput style={styles.input} value={complexName} onChangeText={setComplexName} placeholder="e.g. Sunset Estate (optional)" placeholderTextColor={Colors.text.light} />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Suburb *</Text>
            <TextInput style={styles.input} value={suburb} onChangeText={setSuburb} placeholder="e.g. Sandton" placeholderTextColor={Colors.text.light} />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Town / City *</Text>
            <TextInput style={styles.input} value={city} onChangeText={setCity} placeholder="e.g. Johannesburg" placeholderTextColor={Colors.text.light} />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Province *</Text>
            <View style={styles.provinceGrid}>
              {SA_PROVINCES.map((p) => (
                <TouchableOpacity
                  key={p}
                  style={[styles.provinceChip, province === p && styles.provinceChipActive]}
                  onPress={() => setProvince(p)}
                >
                  <Text style={[styles.provinceChipText, province === p && styles.provinceChipTextActive]}>{p}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Postal Code</Text>
            <TextInput style={styles.input} value={postalCode} onChangeText={setPostalCode} placeholder="e.g. 2001 (optional)" placeholderTextColor={Colors.text.light} keyboardType="number-pad" maxLength={5} />
          </View>
        </View>

        {/* Income Details */}
        <View style={styles.formSection}>
          <Text style={styles.sectionLabel}>Income Details</Text>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Employer Name</Text>
            <TextInput style={styles.input} value={employerName} onChangeText={setEmployerName} placeholder="e.g. Acme Corporation" placeholderTextColor={Colors.text.light} />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Employer Email</Text>
            <TextInput style={styles.input} value={employerEmail} onChangeText={setEmployerEmail} placeholder="e.g. hr@acme.co.za" placeholderTextColor={Colors.text.light} keyboardType="email-address" autoCapitalize="none" />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Monthly Gross Salary (R)</Text>
            <TextInput style={styles.input} value={grossSalary} onChangeText={setGrossSalary} placeholder="e.g. 25000" placeholderTextColor={Colors.text.light} keyboardType="number-pad" />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Monthly Net Salary (R)</Text>
            <TextInput style={styles.input} value={netSalary} onChangeText={setNetSalary} placeholder="e.g. 18500" placeholderTextColor={Colors.text.light} keyboardType="number-pad" />
          </View>
        </View>

        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveButtonText}>Save Changes</Text>
          )}
        </TouchableOpacity>

        <View style={styles.bottomPadding} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.light1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  avatarSection: {
    alignItems: 'center',
    paddingVertical: 28,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  avatarWrapper: {
    position: 'relative',
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: Colors.primary.blue,
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.background.light1,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: Colors.primary.blue,
  },
  cameraIcon: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primary.orange,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
  },
  changePhotoText: {
    marginTop: 10,
    fontSize: 14,
    color: Colors.primary.orange,
    fontWeight: '500',
  },
  formSection: {
    marginTop: 16,
    marginHorizontal: 16,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text.secondary,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: Colors.background.light1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: Colors.text.primary,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  textArea: {
    minHeight: 80,
    paddingTop: 14,
  },
  disabledInput: {
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  disabledText: {
    fontSize: 16,
    color: Colors.text.light,
  },
  saveButton: {
    marginHorizontal: 16,
    marginTop: 24,
    backgroundColor: Colors.primary.blue,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.primary.blue,
    marginBottom: 16,
  },
  provinceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  provinceChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.background.light1,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  provinceChipActive: {
    backgroundColor: Colors.primary.blue,
    borderColor: Colors.primary.blue,
  },
  provinceChipText: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.text.secondary,
  },
  provinceChipTextActive: {
    color: '#fff',
  },
  bottomPadding: {
    height: 24,
  },
  flagBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 12,
    padding: 16,
  },
  flagBannerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#dc2626',
  },
  flagBannerDesc: {
    fontSize: 13,
    color: '#991b1b',
    marginTop: 4,
    lineHeight: 19,
  },
  verifiedBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: 12,
    padding: 16,
  },
  verifiedBannerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#15803d',
  },
  verifiedBannerDesc: {
    fontSize: 13,
    color: '#166534',
    marginTop: 4,
    lineHeight: 19,
  },
  verifyingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 12,
    padding: 14,
  },
  verifyingText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.primary.blue,
  },
  lockedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  lockedBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#15803d',
  },
});
