import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  Modal,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import { Colors } from '../constants/Colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DRAWER_WIDTH = SCREEN_WIDTH * 0.78;

interface DrawerMenuProps {
  visible: boolean;
  onClose: () => void;
}

const menuItems = [
  { title: 'Dashboard', icon: 'grid-outline', route: '/(tabs)' },
  { title: 'My Products', icon: 'briefcase-outline', route: '/my-products' },
  { title: 'Products', icon: 'cube-outline', route: '/products' },
  { title: 'Credit Clinic', icon: 'shield-checkmark-outline', route: '/(tabs)/credit' },
  { title: 'Contact Us', icon: 'mail-outline', route: null },
  { title: 'Terms and Conditions', icon: 'document-text-outline', route: null },
];

export default function DrawerMenu({ visible, onClose }: DrawerMenuProps) {
  const slideAnim = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { userProfile, signOut } = useAuth();

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: -DRAWER_WIDTH,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const handleMenuPress = (route: string | null) => {
    onClose();
    if (route) {
      setTimeout(() => router.push(route as any), 300);
    }
  };

  const handleLogout = async () => {
    onClose();
    try {
      await signOut();
      setTimeout(() => router.replace('/(auth)/login'), 300);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  if (!visible) return null;

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Animated.View
          style={[styles.backdrop, { opacity: fadeAnim }]}
        >
          <TouchableOpacity style={styles.backdropTouch} onPress={onClose} activeOpacity={1} />
        </Animated.View>

        <Animated.View
          style={[
            styles.drawer,
            { transform: [{ translateX: slideAnim }], paddingTop: insets.top },
          ]}
        >
          <View style={styles.drawerHeader}>
            <View style={styles.drawerProfileRow}>
              <View style={styles.drawerAvatar}>
                {userProfile?.photoURL ? (
                  <Image source={{ uri: userProfile.photoURL }} style={styles.drawerAvatarImage} />
                ) : (
                  <Ionicons name="person" size={28} color={Colors.primary.blue} />
                )}
              </View>
              <View style={styles.drawerUserInfo}>
                <Text style={styles.drawerUserName}>
                  {userProfile?.displayName || 'User'}
                </Text>
                <Text style={styles.drawerUserEmail}>
                  {userProfile?.email || ''}
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={Colors.text.secondary} />
            </TouchableOpacity>
          </View>

          <View style={styles.divider} />

          <View style={styles.menuList}>
            {menuItems.map((item, index) => (
              <TouchableOpacity
                key={index}
                style={styles.menuItem}
                onPress={() => handleMenuPress(item.route)}
              >
                <Ionicons name={item.icon as any} size={22} color={Colors.primary.blue} />
                <Text style={styles.menuItemText}>{item.title}</Text>
                <Ionicons name="chevron-forward" size={18} color={Colors.text.light} />
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.drawerFooter}>
            <View style={styles.divider} />
            <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
              <Ionicons name="log-out-outline" size={22} color="#dc2626" />
              <Text style={styles.logoutText}>Logout</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  backdropTouch: {
    flex: 1,
  },
  drawer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: DRAWER_WIDTH,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 10,
  },
  drawerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  drawerProfileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  drawerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.background.light1,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  drawerAvatarImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  drawerUserInfo: {
    flex: 1,
  },
  drawerUserName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  drawerUserEmail: {
    fontSize: 13,
    color: Colors.text.secondary,
    marginTop: 2,
  },
  closeButton: {
    padding: 4,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginHorizontal: 20,
  },
  menuList: {
    flex: 1,
    paddingTop: 12,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  menuItemText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: Colors.text.primary,
    marginLeft: 16,
  },
  drawerFooter: {
    paddingBottom: 32,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  logoutText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#dc2626',
    marginLeft: 16,
  },
});
