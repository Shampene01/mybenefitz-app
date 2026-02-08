import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { Colors } from '../../constants/Colors';

const menuItems = [
  { title: 'Edit Profile', icon: 'person-outline', action: 'edit' },
  { title: 'Documents', icon: 'document-text-outline', action: 'documents' },
  { title: 'Notifications', icon: 'notifications-outline', action: 'notifications' },
  { title: 'Security', icon: 'lock-closed-outline', action: 'security' },
  { title: 'Help & Support', icon: 'help-circle-outline', action: 'support' },
  { title: 'About', icon: 'information-circle-outline', action: 'about' },
];

export default function ProfileScreen() {
  const { userProfile, signOut, user } = useAuth();
  const router = useRouter();

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            await signOut();
            router.replace('/(auth)/login');
          },
        },
      ]
    );
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {userProfile?.displayName?.charAt(0).toUpperCase() || 'U'}
          </Text>
        </View>
        <Text style={styles.name}>{userProfile?.displayName || 'User'}</Text>
        <Text style={styles.email}>{user?.email}</Text>
      </View>

      <View style={styles.section}>
        {menuItems.map((item, index) => (
          <TouchableOpacity
            key={index}
            style={styles.menuItem}
            onPress={() => {
              if (item.action === 'edit') router.push('/edit-profile');
            }}
          >
            <View style={styles.menuIcon}>
              <Ionicons name={item.icon as any} size={22} color={Colors.primary.blue} />
            </View>
            <Text style={styles.menuTitle}>{item.title}</Text>
            <Ionicons name="chevron-forward" size={20} color={Colors.text.light} />
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
        <Ionicons name="log-out-outline" size={22} color={Colors.status.error} />
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>

      <Text style={styles.version}>MyBenefitz v1.0.0</Text>
      
      <View style={styles.bottomPadding} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.light1,
  },
  header: {
    backgroundColor: '#fff',
    alignItems: 'center',
    paddingVertical: 32,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.primary.blue,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarText: {
    color: '#fff',
    fontSize: 32,
    fontWeight: 'bold',
  },
  name: {
    fontSize: 22,
    fontWeight: 'bold',
    color: Colors.text.primary,
  },
  email: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginTop: 4,
  },
  section: {
    backgroundColor: '#fff',
    marginTop: 16,
    marginHorizontal: 16,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  menuIcon: {
    width: 40,
    height: 40,
    backgroundColor: Colors.primary.blue + '10',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  menuTitle: {
    flex: 1,
    fontSize: 16,
    color: Colors.text.primary,
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    marginHorizontal: 16,
    backgroundColor: '#fff',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  signOutText: {
    color: Colors.status.error,
    fontSize: 16,
    fontWeight: '600',
  },
  version: {
    textAlign: 'center',
    color: Colors.text.light,
    fontSize: 12,
    marginTop: 24,
  },
  bottomPadding: {
    height: 24,
  },
});
