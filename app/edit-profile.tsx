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
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { updateProfile } from 'firebase/auth';
import { useAuth } from '../contexts/AuthContext';
import { auth, storage } from '../lib/firebase';
import { Colors } from '../constants/Colors';

export default function EditProfileScreen() {
  const { userProfile, updateUserProfile } = useAuth();
  const router = useRouter();

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
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
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
    if (!firstName.trim() || !lastName.trim()) {
      Alert.alert('Error', 'First name and surname are required.');
      return;
    }

    const fullName = `${firstName.trim()} ${lastName.trim()}`;
    setSaving(true);
    try {
      if (auth.currentUser) {
        await updateProfile(auth.currentUser, { displayName: fullName });
      }
      await updateUserProfile({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        displayName: fullName,
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
      });
      Alert.alert('Success', 'Profile updated successfully!', [
        { text: 'OK', onPress: () => router.back() },
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

        {/* Personal Details */}
        <View style={styles.formSection}>
          <Text style={styles.sectionLabel}>Personal Details</Text>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>First Name *</Text>
            <TextInput style={styles.input} value={firstName} onChangeText={(v) => { setFirstName(v); setDisplayName(`${v} ${lastName}`.trim()); }} placeholder="Enter your first name" placeholderTextColor={Colors.text.light} />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Surname *</Text>
            <TextInput style={styles.input} value={lastName} onChangeText={(v) => { setLastName(v); setDisplayName(`${firstName} ${v}`.trim()); }} placeholder="Enter your surname" placeholderTextColor={Colors.text.light} />
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
            <TextInput style={styles.input} value={idNumber} onChangeText={setIdNumber} placeholder="e.g. 9001015009087" placeholderTextColor={Colors.text.light} keyboardType="number-pad" maxLength={13} />
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
});
