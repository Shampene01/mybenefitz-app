import { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
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
  normalizePhone,
  sendWhatsAppOtp,
  verifyWhatsAppOtp,
  generatePaymentLink,
  pollPaymentStatus,
  generateClientId,
  CONSENT_FORM_URL,
} from '../lib/productUtils';
import type { OtpPurpose } from '../lib/productUtils';

const TOTAL_STEPS = 5;
const CREDIT_PRICE = 79;
const OTP_PURPOSE: OtpPurpose = 'credit_report';

const stepLabels = [
  'ID Number',
  'Consent',
  'Verify OTP',
  'Payment',
  'Complete',
];

export default function CreditApplyScreen() {
  const router = useRouter();
  const { user, userProfile, updateUserProfile } = useAuth();

  const [step, setStep] = useState(1);
  const [idNumber, setIdNumber] = useState(userProfile?.idNumber || '');
  const [popiaAccepted, setPopiaAccepted] = useState(false);
  const [creditConsent, setCreditConsent] = useState(false);
  const [processing, setProcessing] = useState(false);

  // OTP state
  const [otpId, setOtpId] = useState('');
  const [otpInput, setOtpInput] = useState(['', '', '', '', '', '']);
  const otpRefs = useRef<(TextInput | null)[]>([]);

  // Payment state
  const [paymentUrl, setPaymentUrl] = useState('');
  const [paymentId, setPaymentId] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<'pending' | 'polling' | 'complete' | 'cancelled' | ''>('');

  const canProceed = () => {
    switch (step) {
      case 1: return idNumber.length === 13 && isValidSAID(idNumber);
      case 2: return popiaAccepted && creditConsent;
      case 3: return otpInput.join('').length === 6;
      case 4: return true;
      default: return false;
    }
  };

  // ── Step 1 → 2: Save ID
  const handleIdSubmit = async () => {
    if (!isValidSAID(idNumber)) {
      Alert.alert('Invalid ID', 'Please enter a valid 13-digit South African ID number.');
      return;
    }
    setProcessing(true);
    try {
      await updateUserProfile({ idNumber, updatedAt: new Date().toISOString() });
      setStep(2);
    } catch {
      Alert.alert('Error', 'Failed to save ID number.');
    } finally {
      setProcessing(false);
    }
  };

  // ── Step 2 → 3: Send OTP
  const handleConsentSubmit = async () => {
    if (!popiaAccepted || !creditConsent) {
      Alert.alert('Consent Required', 'Please accept both consent checkboxes.');
      return;
    }
    const phone = userProfile?.phoneNumber || userProfile?.whatsappNumber || '';
    setProcessing(true);
    try {
      const result = await sendWhatsAppOtp(phone, OTP_PURPOSE);
      if (result.success) {
        setOtpId(result.otpId);
        setStep(3);
      } else {
        Alert.alert('OTP Error', result.message || 'Failed to send OTP.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to send OTP.';
      Alert.alert('Error', msg);
    } finally {
      setProcessing(false);
    }
  };

  const handleResendOtp = async () => {
    const phone = userProfile?.phoneNumber || userProfile?.whatsappNumber || '';
    setProcessing(true);
    try {
      const result = await sendWhatsAppOtp(phone, OTP_PURPOSE);
      if (result.success) {
        setOtpId(result.otpId);
        setOtpInput(['', '', '', '', '', '']);
        Alert.alert('OTP Sent', 'A new OTP has been sent to your WhatsApp.');
      } else {
        Alert.alert('Error', result.message || 'Failed to resend OTP.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to resend OTP.';
      Alert.alert('Error', msg);
    } finally {
      setProcessing(false);
    }
  };

  // ── Step 3 → 4: Verify OTP + create records + generate payment
  const handleOtpSubmit = async () => {
    const entered = otpInput.join('');
    if (entered.length !== 6) {
      Alert.alert('Invalid OTP', 'Please enter the full 6-digit OTP.');
      return;
    }
    if (!user || !userProfile) return;

    setProcessing(true);
    try {
      // 1. Verify OTP
      const verifyResult = await verifyWhatsAppOtp(otpId, entered);
      if (!verifyResult.verified) {
        const remaining = verifyResult.attemptsRemaining;
        Alert.alert('Invalid OTP',
          remaining !== undefined
            ? `${verifyResult.message} (${remaining} attempts remaining)`
            : verifyResult.message || 'Invalid OTP.',
        );
        setProcessing(false);
        return;
      }

      const uid = user.uid;
      const now = new Date().toISOString();
      const fullName = `${userProfile.firstName || ''} ${userProfile.lastName || ''}`.trim() || userProfile.displayName;
      const surname = userProfile.lastName || userProfile.displayName.split(' ').pop() || '';
      const phone = normalizePhone(userProfile.phoneNumber || userProfile.whatsappNumber || '');

      await updateUserProfile({
        idNumber,
        fullName,
        lastName: surname,
        phoneNumber: phone,
        popiaConsent: true,
        popiaConsentTimestamp: now,
        creditClinicAppliedAt: now,
        updatedAt: now,
      } as Record<string, unknown>);

      // 2. Save consent
      const consentRef = doc(collection(db, 'profiles', uid, 'consents'));
      await setDoc(consentRef, {
        consentId: consentRef.id,
        consentType: 'credit_report',
        fullName, surname, idNumber,
        popiaConsent: true, creditReportConsent: true,
        whatsAppContactConsent: true,
        otpVerified: true, otpCode: otpId,
        otpVerifiedAt: verifyResult.verifiedAt || now,
        consentGrantedAt: now, channel: 'mobile' as const, createdAt: now,
      });

      // 3. Consent PDF (non-blocking)
      const clientId = generateClientId();
      try {
        await fetch(CONSENT_FORM_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            client_id: clientId,
            wa_id: verifyResult.waId || phone.replace('+', ''),
            id_number: idNumber,
            full_name: fullName,
            cell_number: phone,
            otp_code: entered,
            otp_verified_at: verifyResult.verifiedAt || now,
            message_id: `mobile-otp-${Date.now()}`,
            purpose: 'Credit Clinic Assessment',
            form_type: 'credit_check',
          }),
        });
      } catch { /* non-blocking */ }

      // 4. clientProducts record
      const productRef = doc(collection(db, 'clientProducts'));
      const reference = `CR-${uid.slice(0, 8)}-${consentRef.id}`;
      await setDoc(productRef, {
        productApplicationId: productRef.id,
        productType: 'credit_repair',
        productName: 'Credit Repair',
        productDescription: 'Credit Report Assessment & Analysis',
        status: 'pending_payment', statusLabel: 'Pending Payment',
        idNumber, waId: verifyResult.waId || userProfile.waId || null,
        uid, email: userProfile.email, clientName: fullName,
        channel: 'mobile', reference, consentId: consentRef.id,
        referredBy: (userProfile as unknown as { referredBy?: string }).referredBy || null,
        paymentId: null, amount: CREDIT_PRICE,
        createdAt: now, updatedAt: now, paidAt: null, completedAt: null,
      });

      // 5. Generate payment link
      try {
        const payData = await generatePaymentLink({
          amount: CREDIT_PRICE,
          itemName: 'Credit Report Assessment',
          itemDescription: 'MyBenefitz Credit Clinic - Credit Report & Analysis',
          reference,
          productType: 'credit_repair',
        });
        if (payData.paymentUrl) setPaymentUrl(payData.paymentUrl);
        if (payData.paymentId) {
          setPaymentId(payData.paymentId);
          setPaymentStatus('pending');
        }
      } catch (payErr) {
        console.warn('[CreditApply] Payment link failed:', payErr);
      }

      setStep(4);
    } catch (err) {
      console.error('[CreditApply] Submit failed:', err);
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  // ── Payment
  const handleOpenPayment = async () => {
    if (!paymentUrl) return;
    await Linking.openURL(paymentUrl);

    if (!paymentId) return;
    setPaymentStatus('polling');
    const result = await pollPaymentStatus(paymentId);
    if (result.complete) {
      setPaymentStatus('complete');
      setStep(5);
    } else {
      setPaymentStatus(result.status === 'CANCELLED' ? 'cancelled' : 'pending');
    }
  };

  const handleNext = async () => {
    if (step === 1) return handleIdSubmit();
    if (step === 2) return handleConsentSubmit();
    if (step === 3) return handleOtpSubmit();
    if (step === 4) return handleOpenPayment();
  };

  const handleBack = () => {
    if (step === 1) {
      router.back();
    } else {
      setStep((s) => s - 1);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newOtp = [...otpInput];
    newOtp[index] = value.slice(-1);
    setOtpInput(newOtp);
    if (value && index < 5) otpRefs.current[index + 1]?.focus();
  };

  const maskedPhone = (() => {
    const ph = userProfile?.phoneNumber || userProfile?.whatsappNumber || '';
    return ph ? ph.slice(0, 3) + '****' + ph.slice(-3) : '';
  })();

  const dobInfo = isValidSAID(idNumber) ? extractDobFromId(idNumber) : null;

  return (
    <ProfileGuard>
    <SafeAreaView style={styles.container} edges={['bottom']}>
    <KeyboardAvoidingView style={styles.innerContainer} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      {/* Progress */}
      <View style={styles.progressBar}>
        {stepLabels.map((_, i) => (
          <View
            key={i}
            style={[
              styles.progressDot,
              i + 1 <= step && styles.progressDotActive,
              i + 1 === step && styles.progressDotCurrent,
            ]}
          />
        ))}
      </View>
      <Text style={styles.progressLabel}>Step {Math.min(step, TOTAL_STEPS)} of {TOTAL_STEPS}: {stepLabels[Math.min(step, TOTAL_STEPS) - 1]}</Text>

      <ScrollView style={styles.scrollArea} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* ── Step 1: ID Number ── */}
        {step === 1 && (
          <View style={styles.stepContainer}>
            <View style={styles.stepIconCircle}>
              <Ionicons name="finger-print" size={28} color={Colors.primary.blue} />
            </View>
            <Text style={styles.stepTitle}>Your 13-Digit SA ID Number</Text>
            <Text style={styles.stepDesc}>We need your ID number to pull your credit profile securely.</Text>
            <TextInput
              style={styles.input}
              value={idNumber}
              onChangeText={(v) => setIdNumber(v.replace(/\D/g, '').slice(0, 13))}
              placeholder="e.g. 9001015009087"
              placeholderTextColor={Colors.text.light}
              keyboardType="number-pad"
              maxLength={13}
            />
            <Text style={styles.inputHint}>{idNumber.length}/13 digits</Text>
            {dobInfo && (
              <View style={styles.paymentNote}>
                <Ionicons name="information-circle" size={16} color={Colors.primary.blue} />
                <Text style={styles.paymentNoteText}>DOB: {dobInfo.dob} • Age: {dobInfo.age}</Text>
              </View>
            )}
          </View>
        )}

        {/* ── Step 2: Consent ── */}
        {step === 2 && (
          <View style={styles.stepContainer}>
            <View style={styles.stepIconCircle}>
              <Ionicons name="lock-closed" size={28} color={Colors.primary.blue} />
            </View>
            <Text style={styles.stepTitle}>Consent &amp; Disclosure</Text>
            <Text style={styles.stepDesc}>Please accept both consents to proceed.</Text>

            <View style={styles.consentCard}>
              <Text style={styles.consentText}>
                I consent to MyBenefitz processing my personal information in accordance with POPIA for the purpose of obtaining and analysing my credit report.
              </Text>
            </View>

            <TouchableOpacity style={styles.checkboxRow} onPress={() => setPopiaAccepted(!popiaAccepted)} activeOpacity={0.7}>
              <View style={[styles.checkbox, popiaAccepted && styles.checkboxChecked]}>
                {popiaAccepted && <Ionicons name="checkmark" size={16} color="#fff" />}
              </View>
              <Text style={styles.checkboxLabel}>I provide my POPIA consent</Text>
            </TouchableOpacity>

            <View style={[styles.consentCard, { marginTop: 16 }]}>
              <Text style={styles.consentText}>
                I authorise MyBenefitz to access my credit report from the VCCB credit bureau on my behalf, including credit score, account history, and payment records.
              </Text>
            </View>

            <TouchableOpacity style={styles.checkboxRow} onPress={() => setCreditConsent(!creditConsent)} activeOpacity={0.7}>
              <View style={[styles.checkbox, creditConsent && styles.checkboxChecked]}>
                {creditConsent && <Ionicons name="checkmark" size={16} color="#fff" />}
              </View>
              <Text style={styles.checkboxLabel}>I authorise credit report access</Text>
            </TouchableOpacity>

            <View style={[styles.paymentNote, { marginTop: 16 }]}>
              <Ionicons name="information-circle" size={16} color={Colors.primary.blue} />
              <Text style={styles.paymentNoteText}>A once-off fee of R{CREDIT_PRICE}.00 is payable after OTP verification.</Text>
            </View>
          </View>
        )}

        {/* ── Step 3: OTP Verification ── */}
        {step === 3 && (
          <View style={styles.stepContainer}>
            <View style={styles.stepIconCircle}>
              <Ionicons name="chatbubble-ellipses" size={28} color={Colors.primary.blue} />
            </View>
            <Text style={styles.stepTitle}>Verify Your Identity</Text>
            <Text style={styles.stepDesc}>Enter the 6-digit OTP sent to your WhatsApp {maskedPhone}</Text>

            <View style={styles.otpRow}>
              {otpInput.map((digit, i) => (
                <TextInput
                  key={i}
                  ref={(el) => { otpRefs.current[i] = el; }}
                  style={styles.otpBox}
                  value={digit}
                  onChangeText={(v) => handleOtpChange(i, v)}
                  onKeyPress={(e) => {
                    if (e.nativeEvent.key === 'Backspace' && !otpInput[i] && i > 0) {
                      otpRefs.current[i - 1]?.focus();
                    }
                  }}
                  keyboardType="number-pad"
                  maxLength={1}
                  textAlign="center"
                />
              ))}
            </View>

            <Text style={[styles.inputHint, { marginTop: 12 }]}>OTP is valid for 10 minutes. Check your WhatsApp.</Text>

            <TouchableOpacity onPress={handleResendOtp} disabled={processing} style={{ marginTop: 12 }}>
              <Text style={{ color: Colors.primary.blue, fontWeight: '600', fontSize: 14 }}>Resend OTP</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Step 4: Payment ── */}
        {step === 4 && (
          <View style={styles.stepContainer}>
            <View style={styles.stepIconCircle}>
              <Ionicons name="card" size={28} color={Colors.primary.blue} />
            </View>
            <Text style={styles.stepTitle}>Complete Payment</Text>
            <Text style={styles.stepDesc}>Credit Report Assessment — once-off fee</Text>

            <View style={styles.paymentSummary}>
              <View style={styles.paymentRow}>
                <Text style={styles.paymentLabel}>Credit Report Assessment</Text>
                <Text style={styles.paymentAmount}>R{CREDIT_PRICE}.00</Text>
              </View>
              <View style={styles.paymentDivider} />
              <View style={styles.paymentRow}>
                <Text style={styles.paymentTotalLabel}>Total</Text>
                <Text style={styles.paymentTotalAmount}>R{CREDIT_PRICE}.00</Text>
              </View>
            </View>

            {paymentStatus === 'polling' && (
              <View style={[styles.paymentNote, { backgroundColor: Colors.primary.blue + '10' }]}>
                <ActivityIndicator size="small" color={Colors.primary.blue} />
                <Text style={styles.paymentNoteText}>Waiting for payment confirmation...</Text>
              </View>
            )}
            {paymentStatus === 'cancelled' && (
              <View style={[styles.paymentNote, { backgroundColor: Colors.status.error + '10' }]}>
                <Ionicons name="close-circle" size={16} color={Colors.status.error} />
                <Text style={styles.paymentNoteText}>Payment was cancelled. You can try again.</Text>
              </View>
            )}
            {paymentStatus !== 'polling' && (
              <View style={styles.paymentNote}>
                <Ionicons name="shield-checkmark" size={16} color={Colors.status.success} />
                <Text style={styles.paymentNoteText}>Secure PayFast payment. Your card details are never stored.</Text>
              </View>
            )}
          </View>
        )}

        {/* ── Step 5: Complete ── */}
        {step === 5 && (
          <View style={styles.stepContainer}>
            <View style={[styles.stepIconCircle, { backgroundColor: Colors.status.success + '15' }]}>
              <Ionicons name="checkmark-circle" size={36} color={Colors.status.success} />
            </View>
            <Text style={styles.stepTitle}>{paymentStatus === 'complete' ? 'Payment Successful!' : 'Application Submitted!'}</Text>
            <Text style={styles.stepDesc}>
              Your Credit Report Assessment is now active. We'll process your assessment and share it with you via WhatsApp.
            </Text>

            <View style={styles.completeCard}>
              <Text style={styles.completeCardTitle}>What happens next?</Text>
              <CompleteStep num="1" text="We pull your credit report securely" />
              <CompleteStep num="2" text="Our team reviews your credit profile" />
              <CompleteStep num="3" text="You receive your assessment via WhatsApp" />
              <CompleteStep num="4" text="We explain your recommended options" />
              <CompleteStep num="5" text="You may accept or decline any further services" />
            </View>

            <TouchableOpacity style={styles.doneButton} onPress={() => router.back()} activeOpacity={0.8}>
              <Text style={styles.doneButtonText}>Back to Credit Clinic</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Bottom nav (not shown on completion step) */}
      {step < 5 && (
        <View style={styles.bottomNav}>
          <TouchableOpacity style={styles.backBtn} onPress={handleBack} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={20} color={Colors.text.secondary} />
            <Text style={styles.backBtnText}>{step === 1 ? 'Cancel' : 'Back'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.nextBtn, !canProceed() && styles.nextBtnDisabled]}
            onPress={handleNext}
            disabled={!canProceed() || processing}
            activeOpacity={0.8}
          >
            {processing ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Text style={styles.nextBtnText}>
                  {step === 2 ? 'Accept & Send OTP' : step === 3 ? 'Verify OTP' : step === 4 ? `Pay R${CREDIT_PRICE}` : 'Continue'}
                </Text>
                <Ionicons name="arrow-forward" size={18} color="#fff" />
              </>
            )}
          </TouchableOpacity>
        </View>
      )}
    </KeyboardAvoidingView>
    </SafeAreaView>
    </ProfileGuard>
  );
}

function TermItem({ num, text }: { num: string; text: string }) {
  return (
    <View style={termStyles.row}>
      <View style={termStyles.numCircle}>
        <Text style={termStyles.num}>{num}</Text>
      </View>
      <Text style={termStyles.text}>{text}</Text>
    </View>
  );
}

function CompleteStep({ num, text }: { num: string; text: string }) {
  return (
    <View style={termStyles.row}>
      <View style={[termStyles.numCircle, { backgroundColor: Colors.status.success + '15', borderColor: Colors.status.success + '30' }]}>
        <Text style={[termStyles.num, { color: Colors.status.success }]}>{num}</Text>
      </View>
      <Text style={termStyles.text}>{text}</Text>
    </View>
  );
}

const termStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 12,
  },
  numCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.primary.blue + '10',
    borderWidth: 1,
    borderColor: Colors.primary.blue + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 1,
  },
  num: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primary.blue,
  },
  text: {
    flex: 1,
    fontSize: 13,
    color: Colors.text.secondary,
    lineHeight: 19,
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.light1,
  },
  innerContainer: {
    flex: 1,
  },
  progressBar: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    paddingTop: 16,
    paddingBottom: 4,
    paddingHorizontal: 16,
  },
  progressDot: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
  },
  progressDotActive: {
    backgroundColor: Colors.primary.blue + '40',
  },
  progressDotCurrent: {
    backgroundColor: Colors.primary.blue,
  },
  progressLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text.secondary,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 8,
  },
  scrollArea: { flex: 1 },
  scrollContent: { flexGrow: 1, padding: 16 },
  stepContainer: {
    alignItems: 'center',
  },
  stepIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.primary.blue + '10',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  stepTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.text.primary,
    marginBottom: 8,
    textAlign: 'center',
  },
  stepDesc: {
    fontSize: 13,
    color: Colors.text.secondary,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  input: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 20,
    fontWeight: '600',
    color: Colors.text.primary,
    borderWidth: 1,
    borderColor: Colors.border,
    textAlign: 'center',
    letterSpacing: 2,
  },
  inputHint: {
    fontSize: 12,
    color: Colors.text.light,
    marginTop: 8,
  },
  consentCard: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  consentText: {
    fontSize: 13,
    color: Colors.text.secondary,
    lineHeight: 20,
    marginBottom: 12,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    width: '100%',
    paddingVertical: 4,
  },
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: Colors.primary.blue,
    borderColor: Colors.primary.blue,
  },
  checkboxLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  termsCard: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  paymentSummary: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 16,
  },
  paymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  paymentLabel: {
    fontSize: 14,
    color: Colors.text.secondary,
  },
  paymentAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  paymentDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 14,
  },
  paymentTotalLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  paymentTotalAmount: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.primary.blue,
  },
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    width: '100%',
    marginBottom: 8,
  },
  otpBox: {
    width: 46,
    height: 54,
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: Colors.border,
    fontSize: 22,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  paymentNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    backgroundColor: Colors.status.success + '10',
    padding: 12,
    borderRadius: 10,
    marginTop: 12,
  },
  paymentNoteText: {
    flex: 1,
    fontSize: 12,
    color: Colors.text.secondary,
    lineHeight: 17,
  },
  completeCard: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 18,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  completeCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text.primary,
    marginBottom: 14,
  },
  doneButton: {
    backgroundColor: Colors.primary.blue,
    paddingVertical: 14,
    paddingHorizontal: 36,
    borderRadius: 12,
  },
  doneButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
  bottomNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  backBtnText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text.secondary,
  },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.primary.orange,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
  },
  nextBtnDisabled: {
    backgroundColor: Colors.text.light,
  },
  nextBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
});
