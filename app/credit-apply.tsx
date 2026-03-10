import { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { doc, setDoc, collection } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Colors } from '../constants/Colors';
import ProfileGuard from '../components/ProfileGuard';
import {
  isValidSAID,
  extractDobFromId,
  extractGenderFromId,
  normalizePhone,
  sendWhatsAppOtp,
  verifyWhatsAppOtp,
  generatePaymentLink,
  pollPaymentStatus,
  generateClientId,
  CONSENT_FORM_URL,
} from '../lib/productUtils';
import type { OtpPurpose } from '../lib/productUtils';
import { AvatarImage, AVATARS } from '../components/ChatAvatars';
import type { AvatarProfile } from '../components/ChatAvatars';

// ── Constants ────────────────────────────────────────────────────────────
const ACCENT = '#7c3aed';
const ACCENT_BG = '#f5f3ff';
const CREDIT_PRICE = 99;
const OTP_PURPOSE: OtpPurpose = 'credit_report';

interface ChatMessage {
  id: string;
  from: 'bot' | 'user';
  text: string;
  inputType?: 'text' | 'none';
  placeholder?: string;
  field?: string;
}

type StepKey =
  | 'choose_avatar' | 'greeting'
  | 'id_number' | 'whatsapp_number'
  | 'consent_step' | 'otp_step'
  | 'submitting' | 'payment_step' | 'done';

// ── Bold text renderer ───────────────────────────────────────────────────
function BoldText({ text, style }: { text: string; style?: object }) {
  const parts = text.split(/(<b>.*?<\/b>)/g);
  return (
    <Text style={[styles.msgText, style]}>
      {parts.map((part, i) => {
        if (part.startsWith('<b>') && part.endsWith('</b>'))
          return <Text key={i} style={{ fontWeight: '700' }}>{part.slice(3, -4)}</Text>;
        return part;
      })}
    </Text>
  );
}


// ══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════════════
export default function CreditApplyScreen() {
  const router = useRouter();
  const { user, userProfile, updateUserProfile, isHomeAffairsVerified } = useAuth();
  const idVerified = isHomeAffairsVerified;
  const hasPhone = !!(userProfile?.phoneNumber || userProfile?.whatsappNumber);
  const firstName = userProfile?.firstName || userProfile?.displayName?.split(' ')[0] || 'there';

  // ── Chat state ──────────────────────────────────────────────────────
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentStep, setCurrentStep] = useState<StepKey>('choose_avatar');
  const [textInput, setTextInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const [data, setData] = useState<Record<string, string>>({});
  const [selectedAvatar, setSelectedAvatar] = useState<AvatarProfile>(AVATARS[0]);
  const [avatarChosen, setAvatarChosen] = useState(false);
  const [pendingStep, setPendingStep] = useState<{ step: StepKey; extra?: Record<string, string> } | null>(null);

  // Consent & OTP
  const [popiaConsent, setPopiaConsent] = useState(false);
  const [creditConsent, setCreditConsent] = useState(false);
  const [otpId, setOtpId] = useState('');
  const [otpInput, setOtpInput] = useState(['', '', '', '', '', '']);
  const otpRefs = useRef<(TextInput | null)[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Payment
  const [paymentUrl, setPaymentUrl] = useState('');
  const [paymentId, setPaymentId] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<'pending' | 'polling' | 'complete' | 'cancelled' | 'timeout' | ''>('');

  // Pre-fill from profile
  useEffect(() => {
    if (!userProfile) return;
    const d: Record<string, string> = {};
    if (userProfile.idNumber && isValidSAID(userProfile.idNumber)) d.idNumber = userProfile.idNumber;
    if (userProfile.phoneNumber) d.whatsappNumber = userProfile.phoneNumber;
    else if (userProfile.whatsappNumber) d.whatsappNumber = userProfile.whatsappNumber;
    if (Object.keys(d).length) setData((prev) => ({ ...prev, ...d }));
  }, [userProfile]);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 150);
  }, []);

  const addBotMessage = useCallback((text: string, opts?: Partial<ChatMessage>) => {
    setIsTyping(true);
    setTimeout(() => {
      setIsTyping(false);
      setMessages((m) => [...m, { id: `b-${Date.now()}-${Math.random()}`, from: 'bot', text, ...opts }]);
      scrollToBottom();
    }, 500 + Math.random() * 400);
  }, [scrollToBottom]);

  const addUserMessage = useCallback((text: string) => {
    setMessages((m) => [...m, { id: `u-${Date.now()}`, from: 'user', text }]);
    scrollToBottom();
  }, [scrollToBottom]);

  // ── Pending step effect ─────────────────────────────────────────────
  useEffect(() => {
    if (!pendingStep) return;
    const t = setTimeout(() => { progressTo(pendingStep.step, pendingStep.extra); setPendingStep(null); }, 600);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingStep]);

  // ── Avatar selection ────────────────────────────────────────────────
  const handleAvatarSelect = (av: AvatarProfile) => {
    setSelectedAvatar(av);
    setAvatarChosen(true);
    setTimeout(() => {
      addBotMessage(
        `Hey ${firstName}! 👋 I'm ${av.name}, and I'll help you get your credit report and AI analysis today.\n\nThe service costs <b>R${CREDIT_PRICE}.00</b> — a once-off fee for your full credit assessment.\n\nLet's get started!`,
        { inputType: 'none' },
      );
      setTimeout(() => setPendingStep({ step: 'id_number' }), 1800);
    }, 300);
  };

  // ── Step progression ────────────────────────────────────────────────
  const progressTo = useCallback((step: StepKey, extra?: Record<string, string>) => {
    const merged = { ...data, ...extra };
    if (extra) setData((d) => ({ ...d, ...extra }));
    setCurrentStep(step);

    switch (step) {
      case 'id_number':
        if (idVerified && merged.idNumber) {
          const di = extractDobFromId(merged.idNumber);
          const g = extractGenderFromId(merged.idNumber);
          addBotMessage(`ID Verified ✅\n🆔 ${merged.idNumber}\n📅 ${di?.dob || ''} • Age: ${di?.age || ''}\n♀♂ ${g || ''}`, { inputType: 'none' });
          setData((d) => ({ ...d, idNumber: merged.idNumber!, dob: di?.dob || '', age: String(di?.age || ''), gender: g || '' }));
          if (hasPhone) setTimeout(() => setPendingStep({ step: 'consent_step' }), 1200);
          else setTimeout(() => setPendingStep({ step: 'whatsapp_number' }), 1200);
        } else {
          addBotMessage("First, I'll need your <b>SA ID Number</b>. This is used to pull your credit report. 🆔", { inputType: 'text', placeholder: '13-digit SA ID', field: 'idNumber' });
        }
        break;
      case 'whatsapp_number':
        addBotMessage("I need your <b>WhatsApp number</b> to send you an OTP for verification. 📱", { inputType: 'text', placeholder: '082 123 4567', field: 'whatsappNumber' });
        break;
      case 'consent_step':
        addBotMessage("Great! Now I need your consent to proceed. 📋\n\nPlease review the consent terms below.", { inputType: 'none' });
        break;
      case 'otp_step':
        addBotMessage('A 6-digit verification code has been sent to your WhatsApp. Please enter it below. 🔐', { inputType: 'none' });
        break;
      case 'submitting':
        addBotMessage('⏳ Setting up your credit assessment...', { inputType: 'none' });
        break;
      case 'payment_step':
        addBotMessage(`✅ <b>Application submitted!</b>\n\nComplete the payment of <b>R${CREDIT_PRICE}.00</b> below to activate your credit assessment.`, { inputType: 'none' });
        break;
      case 'done':
        addBotMessage('🎉 <b>Payment Confirmed!</b>\n\nYour credit report assessment is now active. Our team will analyse your report and send you the results via WhatsApp.\n\nYou can track progress in <b>My Products</b>.', { inputType: 'none' });
        break;
    }
  }, [data, addBotMessage, idVerified, hasPhone]);

  // ── Text submit ─────────────────────────────────────────────────────
  const handleTextSubmit = useCallback(() => {
    const v = textInput.trim();
    if (!v) return;
    setTextInput('');
    addUserMessage(v);

    switch (currentStep) {
      case 'id_number':
        if (!isValidSAID(v)) {
          addBotMessage("⚠️ That doesn't look right. Please enter a valid 13-digit SA ID number.", { inputType: 'text', placeholder: '13-digit SA ID', field: 'idNumber' });
          return;
        }
        {
          const di = extractDobFromId(v);
          const g = extractGenderFromId(v);
          addBotMessage(`📅 DOB: ${di?.dob || 'N/A'} • Age: ${di?.age || 'N/A'} • Gender: ${g || 'N/A'}`, { inputType: 'none' });
          if (hasPhone) {
            setPendingStep({ step: 'consent_step', extra: { idNumber: v, dob: di?.dob || '', age: String(di?.age || ''), gender: g || '' } });
          } else {
            setPendingStep({ step: 'whatsapp_number', extra: { idNumber: v, dob: di?.dob || '', age: String(di?.age || ''), gender: g || '' } });
          }
        }
        break;
      case 'whatsapp_number':
        if (v.replace(/\D/g, '').length < 10) {
          addBotMessage('⚠️ Please enter a valid phone number (at least 10 digits).', { inputType: 'text', placeholder: '082 123 4567', field: 'whatsappNumber' });
          return;
        }
        setPendingStep({ step: 'consent_step', extra: { whatsappNumber: v } });
        break;
      default: break;
    }
  }, [textInput, currentStep, addUserMessage, addBotMessage, hasPhone]);

  // ── Consent → Send OTP ──────────────────────────────────────────────
  const handleSendOtp = async () => {
    setError('');
    if (!popiaConsent || !creditConsent) { setError('Please accept both consent checkboxes.'); return; }
    setLoading(true);
    try {
      const phoneToUse = userProfile?.phoneNumber || userProfile?.whatsappNumber || data.whatsappNumber || '';
      const result = await sendWhatsAppOtp(phoneToUse, OTP_PURPOSE);
      if (result.success) {
        setOtpId(result.otpId);
        setCurrentStep('otp_step');
        addBotMessage('A 6-digit code has been sent to your WhatsApp. Enter it below. 🔐', { inputType: 'none' });
      } else {
        setError(result.message || 'Failed to send OTP.');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to send OTP.');
    } finally { setLoading(false); }
  };

  // ── OTP handlers ────────────────────────────────────────────────────
  const handleOtpChange = (i: number, v: string) => {
    if (!/^\d*$/.test(v)) return;
    const n = [...otpInput]; n[i] = v.slice(-1); setOtpInput(n);
    if (v && i < 5) otpRefs.current[i + 1]?.focus();
  };

  const maskedPhone = (() => {
    const ph = userProfile?.phoneNumber || userProfile?.whatsappNumber || data.whatsappNumber || '';
    return ph ? ph.slice(0, 3) + '****' + ph.slice(-3) : '';
  })();

  // ── Verify OTP → Submit ─────────────────────────────────────────────
  const handleVerifyOtp = async () => {
    setError('');
    const entered = otpInput.join('');
    if (entered.length !== 6) { setError('Enter the full 6-digit code.'); return; }
    if (!user || !userProfile) return;

    setLoading(true);
    try {
      const verifyResult = await verifyWhatsAppOtp(otpId, entered);
      if (!verifyResult.verified) {
        const remaining = verifyResult.attemptsRemaining;
        setError(remaining !== undefined ? `${verifyResult.message} (${remaining} attempts remaining)` : verifyResult.message || 'Invalid code.');
        setLoading(false);
        return;
      }

      addUserMessage('OTP verified ✅');
      setCurrentStep('submitting');
      addBotMessage('⏳ Setting up your credit assessment...', { inputType: 'none' });

      const uid = user.uid;
      const now = new Date().toISOString();
      const fullName = `${userProfile.firstName || ''} ${userProfile.lastName || ''}`.trim() || userProfile.displayName;
      const surname = userProfile.lastName || userProfile.displayName?.split(' ').pop() || '';
      const phoneToUse = userProfile.phoneNumber || userProfile.whatsappNumber || data.whatsappNumber || '';
      const phone = normalizePhone(phoneToUse);

      // Save consent record
      const consentRef = doc(collection(db, 'profiles', uid, 'consents'));
      await setDoc(consentRef, {
        consentId: consentRef.id, consentType: 'credit_report',
        fullName, surname, idNumber: data.idNumber,
        clientPhone: phone, popiaConsent: true, creditReportConsent: true,
        whatsAppContactConsent: true, otpVerified: true, otpCode: otpId,
        otpVerifiedAt: verifyResult.verifiedAt || now, consentGrantedAt: now,
        purpose: 'Credit Clinic Assessment',
        status: 'active', channel: 'mobile', createdAt: now,
      });

      // Consent PDF (non-blocking)
      const clientId = generateClientId();
      let consentPdfResult: { consent_uid?: string; document_url?: string; document_hash?: string } = {};
      try {
        const pdfRes = await fetch(CONSENT_FORM_URL, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            client_id: clientId, wa_id: verifyResult.waId || phone.replace('+', ''),
            id_number: data.idNumber, full_name: fullName, cell_number: phone,
            otp_code: entered, otp_verified_at: verifyResult.verifiedAt || now,
            message_id: `mobile-otp-${Date.now()}`,
            purpose: 'Credit Clinic Assessment', form_type: 'credit_check',
          }),
        });
        if (pdfRes.ok) consentPdfResult = await pdfRes.json();
      } catch { /* non-blocking */ }

      if (consentPdfResult.consent_uid) {
        await updateUserProfile({
          latestConsentUid: consentPdfResult.consent_uid,
          latestConsentDocumentUrl: consentPdfResult.document_url,
          latestConsentDocumentHash: consentPdfResult.document_hash,
          updatedAt: now,
        } as Record<string, unknown>);
      }

      // Write application
      const reference = `CR-${uid.slice(0, 8)}-${consentRef.id}`;
      const appRef = doc(collection(db, 'profiles', uid, 'applications'));
      await setDoc(appRef, {
        applicationId: appRef.id,
        productType: 'credit_repair', productName: 'Credit Clinic',
        productDescription: 'Credit Report Assessment & Analysis',
        status: 'pending_payment', statusLabel: 'Pending Payment',
        applicationData: { idNumber: data.idNumber, fullName, phone, consentId: consentRef.id },
        consent: {
          consentId: consentRef.id, consentType: 'credit_report',
          otpVerified: true, otpCode: otpId,
          otpVerifiedAt: verifyResult.verifiedAt || now, consentGrantedAt: now,
        },
        consentFormDocumentUrl: consentPdfResult.document_url || null,
        consentFormUid: consentPdfResult.consent_uid || null,
        consentFormDocumentHash: consentPdfResult.document_hash || null,
        reference,
        idNumber: data.idNumber,
        waId: verifyResult.waId || (userProfile as unknown as Record<string, unknown>).waId || null,
        uid, email: userProfile.email, clientName: fullName,
        amount: CREDIT_PRICE, channel: 'mobile',
        referredBy: (userProfile as unknown as { referredBy?: string }).referredBy || null,
        createdAt: now, updatedAt: now,
      });

      // Update activeProducts on profile
      await updateUserProfile({
        [`activeProducts.credit_repair`]: {
          applicationId: appRef.id, productType: 'credit_repair',
          status: 'pending_payment', statusLabel: 'Pending Payment',
          reference, createdAt: now, updatedAt: now,
        },
        applicationSubmittedAt: now, updatedAt: now,
      } as Record<string, unknown>);

      // Generate payment link
      let payRes: { paymentId?: string; paymentUrl?: string } = {};
      try {
        const payData = await generatePaymentLink({
          amount: CREDIT_PRICE,
          itemName: 'Credit Report Assessment',
          itemDescription: 'MyBenefitz Credit Clinic - Credit Report & Analysis',
          reference: `${reference}-ATT1`, productType: 'credit_repair',
        });
        payRes = { paymentId: payData.paymentId, paymentUrl: payData.paymentUrl };
      } catch { /* non-fatal */ }

      if (payRes.paymentId) setPaymentId(payRes.paymentId);
      if (payRes.paymentUrl) { setPaymentUrl(payRes.paymentUrl); setPaymentStatus('pending'); }

      setCurrentStep('payment_step');
      addBotMessage(`✅ <b>Application submitted!</b>\n\nComplete the payment of <b>R${CREDIT_PRICE}.00</b> below to activate your credit assessment.`, { inputType: 'none' });
    } catch (err) {
      console.error('[CreditClinicChat] Submit failed:', err);
      setError('Something went wrong. Please try again.');
      setCurrentStep('otp_step');
    } finally { setLoading(false); }
  };

  // ── Payment handlers ────────────────────────────────────────────────
  const handleOpenPayment = async () => {
    if (!paymentUrl) return;
    await Linking.openURL(paymentUrl);
    if (!paymentId) return;
    setPaymentStatus('polling');
    const result = await pollPaymentStatus(paymentId);
    if (result.complete) {
      setPaymentStatus('complete');
      setCurrentStep('done');
      addBotMessage('🎉 <b>Payment Confirmed!</b>\n\nYour credit report is now being processed. We\'ll send you the results via WhatsApp.\n\nTrack progress in <b>My Products</b>.', { inputType: 'none' });
    } else {
      setPaymentStatus(result.status === 'CANCELLED' ? 'cancelled' : 'pending');
    }
  };

  // ── Derived ─────────────────────────────────────────────────────────
  const lastBotMsg = [...messages].reverse().find((m) => m.from === 'bot');
  const showTextBar = avatarChosen && lastBotMsg?.inputType === 'text'
    && !['done', 'submitting', 'consent_step', 'otp_step', 'payment_step'].includes(currentStep);

  // ══════════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════════
  return (
    <ProfileGuard>
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>

      {/* ── Avatar chooser ─────────────────────────────────────────── */}
      {!avatarChosen && (
        <ScrollView contentContainerStyle={styles.avatarScreen}>
          <View style={styles.avatarCard}>
            <View style={styles.avatarBadge}>
              <Ionicons name="card" size={13} color={ACCENT} />
              <Text style={styles.avatarBadgeText}>Credit Clinic — Chat Mode</Text>
            </View>
            <Text style={styles.avatarTitle}>Choose Your Assistant</Text>
            <Text style={styles.avatarSubtitle}>
              Pick who you'd like to guide you through the credit assessment process.
            </Text>
            <View style={styles.avatarGrid}>
              {AVATARS.map((av) => (
                <TouchableOpacity key={av.id} style={styles.avatarOption} onPress={() => handleAvatarSelect(av)} activeOpacity={0.7}>
                  <AvatarImage avatar={av} size={52} />
                  <Text style={styles.avatarName}>{av.name}</Text>
                  <Text style={styles.avatarGender}>{av.gender} Digital Assistant</Text>
                  <Text style={styles.avatarPersonality}>{av.personality}</Text>
                  <View style={styles.avatarCta}>
                    <Text style={styles.avatarCtaText}>Chat with {av.name}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.feeNote}>
              <Ionicons name="information-circle" size={14} color={ACCENT} />
              <Text style={styles.feeNoteText}>
                <Text style={{ fontWeight: '700' }}>Service Fee:</Text> R{CREDIT_PRICE}.00 once-off for your full credit report assessment and AI analysis.
              </Text>
            </View>
          </View>
        </ScrollView>
      )}

      {/* ── Chat container ─────────────────────────────────────────── */}
      {avatarChosen && (
        <View style={styles.chatWrap}>
          {/* Header */}
          <View style={styles.chatHeader}>
            <AvatarImage avatar={selectedAvatar} size={34} />
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={styles.headerName}>{selectedAvatar.name}</Text>
                <View style={styles.aiBadge}><Text style={styles.aiBadgeText}>AI</Text></View>
                <View style={styles.onlineDot} />
              </View>
              <Text style={styles.headerSub}>Credit Clinic — Assessment</Text>
            </View>
            <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={22} color="rgba(255,255,255,0.7)" />
            </TouchableOpacity>
          </View>

          <View style={styles.disclaimerBar}>
            <Ionicons name="information-circle" size={12} color="#d97706" />
            <Text style={styles.disclaimerText}>{selectedAvatar.name} is an AI assistant — does not provide financial advice.</Text>
          </View>

          {/* Messages */}
          <ScrollView ref={scrollRef} style={styles.msgScroll} contentContainerStyle={styles.msgScrollContent} showsVerticalScrollIndicator={false}>
            {messages.map((msg) => (
              <View key={msg.id} style={[styles.msgRow, msg.from === 'user' ? styles.msgRowUser : styles.msgRowBot]}>
                {msg.from === 'bot' && <AvatarImage avatar={selectedAvatar} size={24} />}
                <View style={msg.from === 'bot' ? styles.bubbleBot : styles.bubbleUser}>
                  <BoldText text={msg.text} />
                </View>
              </View>
            ))}

            {isTyping && (
              <View style={[styles.msgRow, styles.msgRowBot]}>
                <AvatarImage avatar={selectedAvatar} size={24} />
                <View style={styles.bubbleBot}>
                  <Text style={styles.typingDots}>• • •</Text>
                </View>
              </View>
            )}

            {/* ── Consent inline form ─────────────────────────────── */}
            {currentStep === 'consent_step' && (
              <View style={styles.inlineCard}>
                <View style={styles.inlineHeader}>
                  <Ionicons name="shield-checkmark" size={16} color={ACCENT} />
                  <Text style={styles.inlineTitle}>Consent & Authorization</Text>
                </View>
                <TouchableOpacity style={styles.checkRow} onPress={() => setPopiaConsent(!popiaConsent)} activeOpacity={0.7}>
                  <View style={[styles.checkbox, popiaConsent && styles.checkboxOn]}>
                    {popiaConsent && <Ionicons name="checkmark" size={14} color="#fff" />}
                  </View>
                  <Text style={styles.checkLabel}>I consent to the processing of my personal information in terms of POPIA.</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.checkRow} onPress={() => setCreditConsent(!creditConsent)} activeOpacity={0.7}>
                  <View style={[styles.checkbox, creditConsent && styles.checkboxOn]}>
                    {creditConsent && <Ionicons name="checkmark" size={14} color="#fff" />}
                  </View>
                  <Text style={styles.checkLabel}>I authorise MyBenefitz to access my credit report from the VCCB credit bureau.</Text>
                </TouchableOpacity>
                {maskedPhone ? <Text style={styles.phoneHint}>A verification code will be sent to <Text style={{ fontWeight: '600' }}>{maskedPhone}</Text></Text> : null}
                {error ? <Text style={styles.errorText}>{error}</Text> : null}
                <TouchableOpacity
                  style={[styles.primaryBtn, !(popiaConsent && creditConsent) && styles.primaryBtnOff]}
                  onPress={handleSendOtp}
                  disabled={!(popiaConsent && creditConsent) || loading}
                  activeOpacity={0.8}
                >
                  {loading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.primaryBtnText}>Send Verification Code</Text>}
                </TouchableOpacity>
              </View>
            )}

            {/* ── OTP inline form ─────────────────────────────────── */}
            {currentStep === 'otp_step' && (
              <View style={styles.inlineCard}>
                <Text style={styles.inlineTitle}>Enter Verification Code</Text>
                <Text style={styles.otpHint}>Sent to {maskedPhone} via WhatsApp</Text>
                <View style={styles.otpRow}>
                  {otpInput.map((d, i) => (
                    <TextInput
                      key={i}
                      ref={(el) => { otpRefs.current[i] = el; }}
                      style={styles.otpBox}
                      value={d}
                      onChangeText={(v) => handleOtpChange(i, v)}
                      keyboardType="number-pad"
                      maxLength={1}
                      textAlign="center"
                      onKeyPress={(e) => { if (e.nativeEvent.key === 'Backspace' && !otpInput[i] && i > 0) otpRefs.current[i - 1]?.focus(); }}
                    />
                  ))}
                </View>
                {error ? <Text style={styles.errorText}>{error}</Text> : null}
                <TouchableOpacity
                  style={[styles.primaryBtn, otpInput.join('').length !== 6 && styles.primaryBtnOff]}
                  onPress={handleVerifyOtp}
                  disabled={otpInput.join('').length !== 6 || loading}
                  activeOpacity={0.8}
                >
                  {loading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.primaryBtnText}>Verify & Submit</Text>}
                </TouchableOpacity>
              </View>
            )}

            {/* ── Payment inline ──────────────────────────────────── */}
            {currentStep === 'payment_step' && (
              <View style={styles.inlineCard}>
                <View style={styles.paySummary}>
                  <View style={styles.payRow}>
                    <Text style={styles.payLabel}>Credit Report Assessment</Text>
                    <Text style={styles.payAmt}>R{CREDIT_PRICE}.00</Text>
                  </View>
                  <View style={styles.payDivider} />
                  <View style={styles.payRow}>
                    <Text style={styles.payTotalLabel}>Total</Text>
                    <Text style={styles.payTotal}>R{CREDIT_PRICE}.00</Text>
                  </View>
                </View>
                {paymentStatus === 'polling' && (
                  <View style={styles.statusRow}>
                    <ActivityIndicator size="small" color={ACCENT} />
                    <Text style={styles.statusText}>Waiting for payment confirmation...</Text>
                  </View>
                )}
                {paymentStatus === 'cancelled' && (
                  <View style={styles.statusRow}>
                    <Ionicons name="close-circle" size={16} color={Colors.status.error} />
                    <Text style={styles.statusText}>Payment was cancelled. You can try again.</Text>
                  </View>
                )}
                <TouchableOpacity
                  style={styles.payBtn}
                  onPress={handleOpenPayment}
                  disabled={!paymentUrl || paymentStatus === 'polling'}
                  activeOpacity={0.8}
                >
                  <Ionicons name="card" size={18} color="#fff" />
                  <Text style={styles.payBtnText}>
                    {paymentStatus === 'polling' ? 'Checking...' : `Pay R${CREDIT_PRICE}.00`}
                  </Text>
                </TouchableOpacity>
                <View style={styles.secureRow}>
                  <Ionicons name="shield-checkmark" size={12} color={Colors.status.success} />
                  <Text style={styles.secureText}>Secure PayFast payment. Card details are never stored.</Text>
                </View>
              </View>
            )}

            {/* ── Done CTA ────────────────────────────────────────── */}
            {currentStep === 'done' && (
              <View style={styles.inlineCard}>
                <TouchableOpacity style={styles.primaryBtn} onPress={() => router.back()} activeOpacity={0.8}>
                  <Text style={styles.primaryBtnText}>Back to Credit Clinic</Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>

          {/* ── Text input bar ──────────────────────────────────────── */}
          {showTextBar && (
            <View style={styles.inputBar}>
              <TextInput
                style={styles.textInput}
                value={textInput}
                onChangeText={setTextInput}
                placeholder={lastBotMsg?.placeholder || 'Type your answer...'}
                placeholderTextColor={Colors.text.light}
                returnKeyType="send"
                onSubmitEditing={handleTextSubmit}
              />
              <TouchableOpacity
                style={[styles.sendBtn, !textInput.trim() && styles.sendBtnOff]}
                onPress={handleTextSubmit}
                disabled={!textInput.trim()}
              >
                <Ionicons name="send" size={18} color="#fff" />
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.footerBar}>
            <Ionicons name="lock-closed" size={10} color={Colors.text.light} />
            <Text style={styles.footerText}>Encrypted</Text>
            <Text style={styles.footerDot}>•</Text>
            <Text style={styles.footerText}>Powered by MyBenefitz</Text>
          </View>
        </View>
      )}

    </KeyboardAvoidingView>
    </SafeAreaView>
    </ProfileGuard>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// STYLES
// ══════════════════════════════════════════════════════════════════════════
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background.light1 },

  // Avatar screen
  avatarScreen: { flexGrow: 1, justifyContent: 'center', padding: 16 },
  avatarCard: { backgroundColor: '#fff', borderRadius: 16, padding: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 3 },
  avatarBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'center', paddingHorizontal: 12, paddingVertical: 4, backgroundColor: ACCENT_BG, borderRadius: 16, marginBottom: 12 },
  avatarBadgeText: { fontSize: 11, fontWeight: '500', color: ACCENT },
  avatarTitle: { fontSize: 20, fontWeight: '800', color: Colors.text.primary, textAlign: 'center', marginBottom: 4 },
  avatarSubtitle: { fontSize: 13, color: Colors.text.secondary, textAlign: 'center', lineHeight: 19, marginBottom: 20 },
  avatarGrid: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  avatarOption: { flex: 1, alignItems: 'center', padding: 16, borderRadius: 14, borderWidth: 2, borderColor: Colors.border, gap: 6 },
  avatarName: { fontSize: 15, fontWeight: '700', color: Colors.text.primary },
  avatarGender: { fontSize: 10, color: Colors.text.light },
  avatarPersonality: { fontSize: 11, color: Colors.text.secondary, textAlign: 'center', lineHeight: 15 },
  avatarCta: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8, backgroundColor: ACCENT, marginTop: 4 },
  avatarCtaText: { color: '#fff', fontWeight: '600', fontSize: 11 },
  feeNote: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, backgroundColor: ACCENT_BG, borderRadius: 8, padding: 10, borderWidth: 1, borderColor: '#ddd6fe' },
  feeNoteText: { flex: 1, fontSize: 11, color: '#6d28d9', lineHeight: 16 },

  // Chat wrapper
  chatWrap: { flex: 1, backgroundColor: '#fff', borderRadius: 12, margin: 4, overflow: 'hidden', borderWidth: 1, borderColor: Colors.border },
  chatHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: ACCENT },
  headerName: { fontWeight: '700', fontSize: 15, color: '#fff' },
  aiBadge: { backgroundColor: 'rgba(255,255,255,0.25)', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 6 },
  aiBadgeText: { fontSize: 8, fontWeight: '600', color: '#fff' },
  onlineDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#4ade80' },
  headerSub: { fontSize: 10, color: 'rgba(255,255,255,0.85)', marginTop: 1 },
  disclaimerBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 4, paddingHorizontal: 14, backgroundColor: '#fffbeb', borderBottomWidth: 1, borderBottomColor: '#fde68a' },
  disclaimerText: { fontSize: 9, color: '#92400e' },

  // Messages
  msgScroll: { flex: 1, backgroundColor: '#f0f2f5' },
  msgScrollContent: { padding: 14, paddingBottom: 24 },
  msgRow: { flexDirection: 'row', marginBottom: 10, gap: 6 },
  msgRowBot: { alignItems: 'flex-start' },
  msgRowUser: { justifyContent: 'flex-end' },
  bubbleBot: { backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 2, borderTopRightRadius: 12, borderBottomRightRadius: 12, borderBottomLeftRadius: 12, maxWidth: '82%', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 2, elevation: 1 },
  bubbleUser: { backgroundColor: '#ede9fe', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderBottomRightRadius: 2, maxWidth: '75%' },
  msgText: { fontSize: 14, color: Colors.text.primary, lineHeight: 20 },
  typingDots: { fontSize: 18, color: Colors.text.light, letterSpacing: 2 },

  // Inline cards
  inlineCard: { marginLeft: 30, backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: Colors.border, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3, elevation: 1 },
  inlineHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 14 },
  inlineTitle: { fontSize: 15, fontWeight: '700', color: Colors.text.primary },

  // Checkbox
  checkRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 14 },
  checkbox: { width: 22, height: 22, borderRadius: 5, borderWidth: 2, borderColor: Colors.border, justifyContent: 'center', alignItems: 'center', marginTop: 1 },
  checkboxOn: { backgroundColor: ACCENT, borderColor: ACCENT },
  checkLabel: { flex: 1, fontSize: 13, color: Colors.text.secondary, lineHeight: 18 },
  phoneHint: { fontSize: 12, color: Colors.text.secondary, marginBottom: 10 },
  errorText: { fontSize: 12, color: Colors.status.error, marginBottom: 10, fontWeight: '500' },

  // Primary button
  primaryBtn: { backgroundColor: ACCENT, borderRadius: 10, paddingVertical: 13, alignItems: 'center', marginTop: 4 },
  primaryBtnOff: { opacity: 0.5 },
  primaryBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  // OTP
  otpHint: { fontSize: 12, color: Colors.text.secondary, marginBottom: 14 },
  otpRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 14 },
  otpBox: { width: 42, height: 50, backgroundColor: '#f9fafb', borderRadius: 10, borderWidth: 1.5, borderColor: Colors.border, fontSize: 22, fontWeight: '700', color: Colors.text.primary },

  // Payment
  paySummary: { marginBottom: 14 },
  payRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  payLabel: { fontSize: 13, color: Colors.text.secondary },
  payAmt: { fontSize: 13, fontWeight: '600', color: Colors.text.primary },
  payDivider: { height: 1, backgroundColor: Colors.border, marginVertical: 10 },
  payTotalLabel: { fontSize: 15, fontWeight: '700', color: Colors.text.primary },
  payTotal: { fontSize: 20, fontWeight: '800', color: ACCENT },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  statusText: { flex: 1, fontSize: 12, color: Colors.text.secondary },
  payBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: ACCENT, borderRadius: 10, paddingVertical: 13, marginBottom: 10 },
  payBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  secureRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  secureText: { fontSize: 10, color: Colors.text.light },

  // Input bar
  inputBar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10, paddingVertical: 8, borderTopWidth: 1, borderTopColor: Colors.border, backgroundColor: '#fff' },
  textInput: { flex: 1, backgroundColor: '#f9fafb', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 14, color: Colors.text.primary, borderWidth: 1, borderColor: Colors.border },
  sendBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: ACCENT, justifyContent: 'center', alignItems: 'center' },
  sendBtnOff: { backgroundColor: Colors.text.light },

  // Footer
  footerBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 5, backgroundColor: '#f9fafb', borderTopWidth: 1, borderTopColor: Colors.border },
  footerText: { fontSize: 9, color: Colors.text.light },
  footerDot: { fontSize: 9, color: Colors.text.light },
});
