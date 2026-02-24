import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, ActivityIndicator } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { Colors } from '../constants/Colors';

export default function ProfileGuard({ children }: { children: React.ReactNode }) {
  const { isProfileComplete, isAccountFlagged, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;
    if (isAccountFlagged) return;
    if (!isProfileComplete) {
      router.replace({
        pathname: '/edit-profile',
        params: { returnTo: pathname },
      } as any);
    }
  }, [loading, isProfileComplete, isAccountFlagged]);

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color={Colors.primary.blue} />
      </View>
    );
  }

  if (isAccountFlagged) {
    return (
      <View style={s.center}>
        <View style={[s.iconCircle, { backgroundColor: Colors.status.error + '15' }]}>
          <Ionicons name="alert-circle" size={40} color={Colors.status.error} />
        </View>
        <Text style={s.title}>Account Suspended</Text>
        <Text style={s.desc}>
          Your account has been flagged due to a name mismatch during identity
          verification. All applications and transactions are suspended until
          this is resolved.
        </Text>
        <TouchableOpacity
          style={s.whatsappBtn}
          onPress={() => Linking.openURL('https://wa.me/27653404602')}
          activeOpacity={0.8}
        >
          <Ionicons name="logo-whatsapp" size={20} color="#fff" />
          <Text style={s.whatsappText}>Contact Support on WhatsApp</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Text style={s.backText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!isProfileComplete) {
    return (
      <View style={s.center}>
        <Ionicons name="person-circle" size={48} color={Colors.status.warning} />
        <Text style={s.title}>Profile Incomplete</Text>
        <Text style={s.desc}>Redirecting to complete your profile...</Text>
      </View>
    );
  }

  return <>{children}</>;
}

const s = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    backgroundColor: Colors.background.light1,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text.primary,
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  desc: {
    fontSize: 14,
    color: Colors.text.secondary,
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 24,
    paddingHorizontal: 16,
  },
  whatsappBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#25D366',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  whatsappText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  backBtn: {
    marginTop: 16,
    paddingVertical: 10,
  },
  backText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text.secondary,
  },
});
