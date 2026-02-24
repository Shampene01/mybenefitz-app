import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { Colors } from '../constants/Colors';

export default function VerifyEmailScreen() {
  const { user, emailVerified, resendVerificationEmail, reloadUser, signOut, loading } = useAuth();
  const router = useRouter();

  const [resending, setResending] = useState(false);
  const [checking, setChecking] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'warning' | null>(null);
  const [error, setError] = useState('');

  // Redirect if no user
  useEffect(() => {
    if (!loading && !user) {
      router.replace('/(auth)/login');
    }
  }, [user, loading]);

  // Redirect if already verified
  useEffect(() => {
    if (!loading && user && emailVerified) {
      router.replace('/(tabs)');
    }
  }, [user, emailVerified, loading]);

  // Poll for verification status every 5 seconds
  useEffect(() => {
    if (!user || emailVerified) return;

    const interval = setInterval(async () => {
      try {
        await reloadUser();
      } catch {
        // ignore reload errors
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [user, emailVerified]);

  // Cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const handleResend = async () => {
    setResending(true);
    setError('');
    setMessage('');
    setMessageType(null);
    try {
      await resendVerificationEmail();
      setMessage('Verification email sent! Check your inbox.');
      setMessageType('success');
      setResendCooldown(60);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to send email.';
      if (msg.includes('too-many-requests') || msg.includes('Too many requests')) {
        setError('Too many requests. Please wait a few minutes before trying again.');
        setResendCooldown(120);
      } else {
        setError(msg);
      }
    } finally {
      setResending(false);
    }
  };

  const handleCheckStatus = async () => {
    setChecking(true);
    setError('');
    try {
      await reloadUser();
      if (!emailVerified) {
        setMessage('Email not yet verified. Please check your inbox and tap the link.');
        setMessageType('warning');
      }
    } catch {
      setError('Could not check verification status. Please try again.');
    } finally {
      setChecking(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    router.replace('/(auth)/login');
  };

  if (loading || !user) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color={Colors.primary.blue} />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={s.scrollContent} style={s.container}>
      <View style={s.header}>
        <Image
          source={require('../assets/logo.png')}
          style={s.logo}
          resizeMode="contain"
        />
      </View>

      <View style={s.card}>
        {/* Icon */}
        <View style={s.iconCircle}>
          <Ionicons name="mail" size={32} color={Colors.primary.blue} />
        </View>

        <Text style={s.title}>Verify your email</Text>
        <Text style={s.subtitle}>We've sent a verification link to</Text>
        <Text style={s.email}>{user.email}</Text>

        {/* Success / Warning message */}
        {message ? (
          <View style={[s.banner, messageType === 'warning' ? s.bannerWarning : s.bannerSuccess]}>
            <Ionicons
              name={messageType === 'warning' ? 'close-circle' : 'checkmark-circle'}
              size={18}
              color={messageType === 'warning' ? '#92400e' : '#15803d'}
            />
            <Text style={[s.bannerText, messageType === 'warning' ? s.bannerTextWarning : s.bannerTextSuccess]}>
              {message}
            </Text>
          </View>
        ) : null}

        {/* Error */}
        {error ? (
          <View style={[s.banner, s.bannerError]}>
            <Ionicons name="alert-circle" size={18} color="#dc2626" />
            <Text style={s.bannerTextError}>{error}</Text>
          </View>
        ) : null}

        {/* Steps */}
        <View style={s.stepsContainer}>
          <View style={s.step}>
            <View style={s.stepNumber}><Text style={s.stepNumberText}>1</Text></View>
            <Text style={s.stepText}>Open your email inbox (check spam/junk too)</Text>
          </View>
          <View style={s.step}>
            <View style={s.stepNumber}><Text style={s.stepNumberText}>2</Text></View>
            <Text style={s.stepText}>Tap the verification link from MyBenefitz</Text>
          </View>
          <View style={s.step}>
            <View style={s.stepNumber}><Text style={s.stepNumberText}>3</Text></View>
            <Text style={s.stepText}>Return here — you'll be redirected automatically</Text>
          </View>
        </View>

        {/* Why verify */}
        <View style={s.whyBanner}>
          <Ionicons name="shield-checkmark" size={20} color={Colors.primary.blue} />
          <Text style={s.whyText}>
            <Text style={{ fontWeight: '700' }}>Why verify?</Text> Email verification ensures only you can access linked financial data and WhatsApp history.
          </Text>
        </View>

        {/* Buttons */}
        <TouchableOpacity
          style={s.primaryButton}
          onPress={handleCheckStatus}
          disabled={checking}
          activeOpacity={0.8}
        >
          {checking ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Ionicons name="refresh" size={18} color="#fff" />
              <Text style={s.primaryButtonText}>I've verified — check status</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[s.secondaryButton, resendCooldown > 0 && s.buttonDisabled]}
          onPress={handleResend}
          disabled={resending || resendCooldown > 0}
          activeOpacity={0.8}
        >
          {resending ? (
            <ActivityIndicator color={Colors.primary.blue} size="small" />
          ) : (
            <>
              <Ionicons name="mail" size={18} color={resendCooldown > 0 ? Colors.text.light : Colors.primary.blue} />
              <Text style={[s.secondaryButtonText, resendCooldown > 0 && { color: Colors.text.light }]}>
                {resendCooldown > 0
                  ? `Resend in ${resendCooldown}s`
                  : 'Resend verification email'}
              </Text>
            </>
          )}
        </TouchableOpacity>

        {/* Sign out */}
        <TouchableOpacity style={s.signOutButton} onPress={handleSignOut} activeOpacity={0.7}>
          <Ionicons name="log-out-outline" size={16} color={Colors.text.secondary} />
          <Text style={s.signOutText}>Sign out and use a different email</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.light1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background.light1,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logo: {
    width: 160,
    height: 100,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
    alignItems: 'center',
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#dbeafe',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.text.primary,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.text.secondary,
  },
  email: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.primary.blue,
    marginTop: 4,
    marginBottom: 20,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    padding: 12,
    borderRadius: 10,
    marginBottom: 16,
  },
  bannerSuccess: {
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  bannerWarning: {
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  bannerError: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  bannerText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
  },
  bannerTextSuccess: {
    color: '#15803d',
  },
  bannerTextWarning: {
    color: '#92400e',
  },
  bannerTextError: {
    flex: 1,
    fontSize: 13,
    color: '#dc2626',
    lineHeight: 19,
  },
  stepsContainer: {
    width: '100%',
    marginBottom: 16,
    gap: 12,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.background.light1,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  stepNumberText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text.secondary,
  },
  stepText: {
    flex: 1,
    fontSize: 14,
    color: Colors.text.primary,
    lineHeight: 20,
  },
  whyBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    width: '100%',
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 10,
    padding: 14,
    marginBottom: 24,
  },
  whyText: {
    flex: 1,
    fontSize: 13,
    color: '#1e40af',
    lineHeight: 19,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
    backgroundColor: Colors.primary.blue,
    paddingVertical: 15,
    borderRadius: 12,
    marginBottom: 12,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
    backgroundColor: '#fff',
    paddingVertical: 15,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.primary.blue,
    marginBottom: 20,
  },
  secondaryButtonText: {
    color: Colors.primary.blue,
    fontSize: 15,
    fontWeight: '600',
  },
  buttonDisabled: {
    borderColor: Colors.border,
    opacity: 0.6,
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  signOutText: {
    fontSize: 13,
    color: Colors.text.secondary,
  },
});
