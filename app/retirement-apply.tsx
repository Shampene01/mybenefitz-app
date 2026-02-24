import { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { doc, setDoc, collection } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Colors } from '../constants/Colors';
import {
  isValidSAID, extractDobFromId, extractGenderFromId, normalizePhone,
  isValidPhone, sendWhatsAppOtp, verifyWhatsAppOtp,
  TITLE_OPTIONS, MARITAL_STATUS_OPTIONS,
} from '../lib/productUtils';
import type { OtpPurpose } from '../lib/productUtils';
import ProfileGuard from '../components/ProfileGuard';

const STEPS = ['Personal', 'Contributions', 'Consent & OTP', 'Review'];
const OTP_PURPOSE: OtpPurpose = 'retirement_annuity_authorization';

export default function RetirementApplyScreen() {
  const router = useRouter();
  const { user, userProfile, updateUserProfile } = useAuth();

  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [idNumber, setIdNumber] = useState(userProfile?.idNumber || '');
  const [title, setTitle] = useState('');
  const [firstName, setFirstName] = useState(userProfile?.firstName || '');
  const [surname, setSurname] = useState(userProfile?.lastName || '');
  const [cellNumber, setCellNumber] = useState(userProfile?.phoneNumber || '');
  const [maritalStatus, setMaritalStatus] = useState('');
  const [grossIncome, setGrossIncome] = useState('');

  const [monthlyContribution, setMonthlyContribution] = useState('');
  const [retirementAge, setRetirementAge] = useState('65');

  const [popiaConsent, setPopiaConsent] = useState(false);
  const [raConsent, setRaConsent] = useState(false);
  const [otpId, setOtpId] = useState('');
  const [otpInput, setOtpInput] = useState(['', '', '', '', '', '']);
  const otpRefs = useRef<(TextInput | null)[]>([]);
  const [otpVerified, setOtpVerified] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const dob = isValidSAID(idNumber) ? extractDobFromId(idNumber) : null;

  const validate = (): boolean => {
    setError('');
    if (step === 0) {
      if (!isValidSAID(idNumber)) { setError('Valid 13-digit SA ID required.'); return false; }
      if (!firstName.trim() || !surname.trim()) { setError('Name and surname required.'); return false; }
      if (!isValidPhone(cellNumber)) { setError('Valid SA phone number required.'); return false; }
      return true;
    }
    if (step === 1) {
      if (!monthlyContribution || isNaN(Number(monthlyContribution))) { setError('Valid monthly contribution required.'); return false; }
      return true;
    }
    if (step === 2) {
      if (!popiaConsent || !raConsent) { setError('Accept both consents.'); return false; }
      if (!otpVerified) { setError('Verify your WhatsApp number.'); return false; }
      return true;
    }
    return true;
  };

  const goNext = () => { if (!validate()) return; setStep((s) => s + 1); };
  const goBack = () => { setError(''); if (step === 0) router.back(); else setStep((s) => s - 1); };

  const handleSendOtp = async () => {
    if (!popiaConsent || !raConsent) { setError('Accept both consents first.'); return; }
    setLoading(true);
    try {
      const result = await sendWhatsAppOtp(cellNumber, OTP_PURPOSE);
      if (result.success) setOtpId(result.otpId);
      else setError(result.message || 'Failed to send OTP.');
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Failed.'); }
    finally { setLoading(false); }
  };

  const handleVerifyOtp = async () => {
    const entered = otpInput.join('');
    if (entered.length !== 6) { setError('Enter full 6-digit OTP.'); return; }
    setLoading(true);
    try {
      const result = await verifyWhatsAppOtp(otpId, entered);
      if (result.verified) setOtpVerified(true);
      else setError(result.attemptsRemaining !== undefined ? `${result.message} (${result.attemptsRemaining} left)` : result.message || 'Invalid OTP.');
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Failed.'); }
    finally { setLoading(false); }
  };

  const handleResendOtp = async () => {
    setLoading(true);
    try {
      const result = await sendWhatsAppOtp(cellNumber, OTP_PURPOSE);
      if (result.success) { setOtpId(result.otpId); setOtpInput(['', '', '', '', '', '']); Alert.alert('Sent', 'New OTP sent.'); }
      else setError(result.message || 'Failed.');
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Failed.'); }
    finally { setLoading(false); }
  };

  const handleOtpChange = (i: number, v: string) => {
    if (!/^\d*$/.test(v)) return;
    const n = [...otpInput]; n[i] = v.slice(-1); setOtpInput(n);
    if (v && i < 5) otpRefs.current[i + 1]?.focus();
  };

  const handleSubmit = async () => {
    if (!user || !userProfile) return;
    setLoading(true);
    try {
      const uid = user.uid;
      const now = new Date().toISOString();
      const fullName = `${firstName} ${surname}`.trim();

      const dobIso = isValidSAID(idNumber) ? extractDobFromId(idNumber)?.dob : null;
      const dobParts = dobIso ? dobIso.split('-') : null;
      const dobDmy = dobParts ? `${dobParts[2]}/${dobParts[1]}/${dobParts[0]}` : '';

      const nextMonth = new Date();
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      nextMonth.setDate(1);
      const paymentStartDate = `${String(nextMonth.getDate()).padStart(2, '0')}/${String(nextMonth.getMonth() + 1).padStart(2, '0')}/${nextMonth.getFullYear()}`;

      const profileAddress = userProfile.address;

      await updateUserProfile({
        idNumber,
        firstName,
        lastName: surname,
        fullName,
        phoneNumber: normalizePhone(cellNumber),
        popiaConsent: true,
        popiaConsentTimestamp: now,
        retirementAnnuityAppliedAt: now,
        retirementAnnuityData: {
          personal: {
            title,
            firstName,
            surname,
            idNumber,
            dateOfBirth: dobDmy,
            gender: extractGenderFromId(idNumber),
            maritalStatus,
          },
          retirement: {
            retirementAge: retirementAge ? Number(retirementAge) : null,
          },
          contribution: {
            contributionType: 'Debit Order',
            contributionAmount: monthlyContribution ? Number(monthlyContribution) : null,
            paymentStartDate,
            contributionFrequency: 'Monthly',
            escalationType: 'None',
            escalationPercentage: null,
            escalationMonth: null,
          },
          address: {
            addressType: 'Residential',
            streetAddress: profileAddress?.street || '',
            suburb: profileAddress?.suburb || '',
            townOrCity: profileAddress?.city || '',
            province: profileAddress?.province || '',
            postalCode: profileAddress?.postalCode || '',
          },
          income: {
            grossMonthlyIncome: grossIncome ? Number(grossIncome) : null,
          },
        },
        updatedAt: now,
      } as Record<string, unknown>);

      const consentRef = doc(collection(db, 'profiles', uid, 'consents'));
      await setDoc(consentRef, {
        consentId: consentRef.id, consentType: 'retirement_annuity_authorization',
        fullName, surname, idNumber, popiaConsent: true,
        otpVerified: true, otpCode: otpId, otpVerifiedAt: now,
        consentGrantedAt: now, channel: 'mobile' as const, createdAt: now,
      });

      const productRef = doc(collection(db, 'clientProducts'));
      await setDoc(productRef, {
        productApplicationId: productRef.id, productType: 'retirement_annuity',
        productName: 'Retirement Annuity', productDescription: `RA — R${Number(monthlyContribution).toLocaleString()}/month`,
        status: 'applied', statusLabel: 'Application Submitted',
        idNumber, waId: userProfile.waId || null, uid, email: userProfile.email,
        clientName: fullName, channel: 'mobile',
        referredBy: (userProfile as unknown as { referredBy?: string }).referredBy || null,
        reference: `RA-${uid.slice(0, 6)}-${consentRef.id}`, consentId: consentRef.id,
        paymentId: null, amount: null,
        createdAt: now, updatedAt: now, paidAt: null, completedAt: null,
      });

      await updateUserProfile({ retirementAnnuityStatus: 'authorization_signed', updatedAt: now } as Record<string, unknown>);

      setSubmitted(true);
    } catch (err) {
      console.error('[RetirementApply] Submit failed:', err);
      Alert.alert('Error', 'Something went wrong.');
    } finally { setLoading(false); }
  };

  const maskedPhone = (() => { const ph = cellNumber || ''; return ph ? ph.slice(0, 3) + '****' + ph.slice(-3) : ''; })();

  if (submitted) {
    return (
      <SafeAreaView style={st.container} edges={['bottom']}>
        <ScrollView contentContainerStyle={st.scrollContent}>
          <View style={st.stepContainer}>
            <View style={[st.iconCircle, { backgroundColor: Colors.status.success + '15' }]}><Ionicons name="checkmark-circle" size={36} color={Colors.status.success} /></View>
            <Text style={st.title}>Application Submitted!</Text>
            <Text style={st.desc}>Your retirement annuity application has been received. A consultant will contact you.</Text>
            <TouchableOpacity style={st.doneBtn} onPress={() => router.back()} activeOpacity={0.8}><Text style={st.doneBtnText}>Done</Text></TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <ProfileGuard>
    <SafeAreaView style={st.container} edges={['bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={st.progressBar}>{STEPS.map((_, i) => <View key={i} style={[st.dot, i <= step && st.dotActive, i === step && st.dotCurrent]} />)}</View>
        <Text style={st.progressLabel}>Step {step + 1}/{STEPS.length}: {STEPS[step]}</Text>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={st.scrollContent} showsVerticalScrollIndicator={false}>
          {step === 0 && (
            <View style={st.stepContainer}>
              <View style={st.iconCircle}><Ionicons name="person" size={28} color={Colors.primary.blue} /></View>
              <Text style={st.title}>Personal Details</Text>
              <TextInput style={st.input} placeholder="SA ID Number" placeholderTextColor={Colors.text.light} value={idNumber} onChangeText={(v) => setIdNumber(v.replace(/\D/g, '').slice(0, 13))} keyboardType="number-pad" maxLength={13} />
              {dob && <Text style={st.hint}>DOB: {dob.dob} • Age: {dob.age}</Text>}
              <TextInput style={st.input} placeholder="First Name" placeholderTextColor={Colors.text.light} value={firstName} onChangeText={setFirstName} />
              <TextInput style={st.input} placeholder="Surname" placeholderTextColor={Colors.text.light} value={surname} onChangeText={setSurname} />
              <TextInput style={st.input} placeholder="Cell Number" placeholderTextColor={Colors.text.light} value={cellNumber} onChangeText={setCellNumber} keyboardType="phone-pad" />
              <TextInput style={st.input} placeholder="Gross Monthly Income (R)" placeholderTextColor={Colors.text.light} value={grossIncome} onChangeText={setGrossIncome} keyboardType="number-pad" />
            </View>
          )}

          {step === 1 && (
            <View style={st.stepContainer}>
              <View style={st.iconCircle}><Ionicons name="trending-up" size={28} color={Colors.primary.blue} /></View>
              <Text style={st.title}>Contribution Details</Text>
              <TextInput style={st.input} placeholder="Monthly Contribution (R)" placeholderTextColor={Colors.text.light} value={monthlyContribution} onChangeText={setMonthlyContribution} keyboardType="number-pad" />
              <TextInput style={st.input} placeholder="Target Retirement Age" placeholderTextColor={Colors.text.light} value={retirementAge} onChangeText={setRetirementAge} keyboardType="number-pad" />
              <View style={[st.card, { backgroundColor: Colors.primary.blue + '08' }]}>
                <Text style={{ fontSize: 13, color: Colors.text.secondary, lineHeight: 19 }}>
                  Contributions to a Retirement Annuity are tax-deductible up to 27.5% of your taxable income (max R350,000/year).
                </Text>
              </View>
            </View>
          )}

          {step === 2 && (
            <View style={st.stepContainer}>
              <View style={st.iconCircle}><Ionicons name="shield-checkmark" size={28} color={Colors.primary.blue} /></View>
              <Text style={st.title}>Consent &amp; Verify</Text>
              <View style={st.card}>
                <TouchableOpacity style={st.checkboxRow} onPress={() => setPopiaConsent(!popiaConsent)}>
                  <View style={[st.checkbox, popiaConsent && st.checkboxChecked]}>{popiaConsent && <Ionicons name="checkmark" size={14} color="#fff" />}</View>
                  <Text style={st.checkboxLabel}>I consent to processing of my personal information (POPIA).</Text>
                </TouchableOpacity>
                <TouchableOpacity style={st.checkboxRow} onPress={() => setRaConsent(!raConsent)}>
                  <View style={[st.checkbox, raConsent && st.checkboxChecked]}>{raConsent && <Ionicons name="checkmark" size={14} color="#fff" />}</View>
                  <Text style={st.checkboxLabel}>I authorise MyBenefitz to process my retirement annuity application.</Text>
                </TouchableOpacity>
              </View>
              {otpVerified ? (
                <View style={st.successBox}><Ionicons name="checkmark-circle" size={16} color="#15803d" /><Text style={st.successText}>WhatsApp verified!</Text></View>
              ) : !otpId ? (
                <TouchableOpacity style={[st.actionBtn, (!popiaConsent || !raConsent) && st.actionBtnDisabled]} onPress={handleSendOtp} disabled={!popiaConsent || !raConsent || loading}>
                  {loading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={st.actionBtnText}>Send Verification Code</Text>}
                </TouchableOpacity>
              ) : (
                <View style={{ width: '100%', alignItems: 'center' }}>
                  <Text style={st.desc}>Enter OTP sent to {maskedPhone}</Text>
                  <View style={st.otpRow}>
                    {otpInput.map((d, i) => (
                      <TextInput key={i} ref={(el) => { otpRefs.current[i] = el; }} style={st.otpBox} value={d}
                        onChangeText={(v) => handleOtpChange(i, v)} keyboardType="number-pad" maxLength={1} textAlign="center"
                        onKeyPress={(e) => { if (e.nativeEvent.key === 'Backspace' && !otpInput[i] && i > 0) otpRefs.current[i - 1]?.focus(); }} />
                    ))}
                  </View>
                  <View style={{ flexDirection: 'row', gap: 12 }}>
                    <TouchableOpacity style={st.actionBtn} onPress={handleVerifyOtp} disabled={otpInput.join('').length !== 6 || loading}>
                      {loading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={st.actionBtnText}>Verify</Text>}
                    </TouchableOpacity>
                    <TouchableOpacity onPress={handleResendOtp} disabled={loading}><Text style={{ color: Colors.primary.blue, fontWeight: '600' }}>Resend</Text></TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          )}

          {step === 3 && (
            <View style={st.stepContainer}>
              <View style={st.iconCircle}><Ionicons name="document-text" size={28} color={Colors.primary.blue} /></View>
              <Text style={st.title}>Review &amp; Submit</Text>
              <View style={st.card}>
                <Text style={st.reviewLabel}>Name</Text><Text style={st.reviewValue}>{firstName} {surname}</Text>
                <Text style={st.reviewLabel}>ID Number</Text><Text style={st.reviewValue}>{idNumber}</Text>
                <Text style={st.reviewLabel}>Monthly Contribution</Text><Text style={st.reviewValue}>R {Number(monthlyContribution).toLocaleString()}</Text>
                <Text style={st.reviewLabel}>Retirement Age</Text><Text style={st.reviewValue}>{retirementAge}</Text>
              </View>
            </View>
          )}

          {error ? <View style={st.errorBox}><Ionicons name="alert-circle" size={16} color={Colors.status.error} /><Text style={st.errorText}>{error}</Text></View> : null}
        </ScrollView>

        <View style={st.bottomNav}>
          <TouchableOpacity style={st.backBtn} onPress={goBack}><Ionicons name="arrow-back" size={20} color={Colors.text.secondary} /><Text style={st.backBtnText}>{step === 0 ? 'Cancel' : 'Back'}</Text></TouchableOpacity>
          <TouchableOpacity style={[st.nextBtn, (step === 2 && !otpVerified) && st.nextBtnDisabled]} onPress={step === 3 ? handleSubmit : goNext} disabled={loading || (step === 2 && !otpVerified)} activeOpacity={0.8}>
            {loading ? <ActivityIndicator color="#fff" size="small" /> : <><Text style={st.nextBtnText}>{step === 3 ? 'Submit' : 'Continue'}</Text><Ionicons name="arrow-forward" size={18} color="#fff" /></>}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
    </ProfileGuard>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background.light1 },
  progressBar: { flexDirection: 'row', justifyContent: 'center', gap: 8, paddingTop: 16, paddingBottom: 4, paddingHorizontal: 16 },
  dot: { flex: 1, height: 4, borderRadius: 2, backgroundColor: Colors.border },
  dotActive: { backgroundColor: Colors.primary.blue + '40' },
  dotCurrent: { backgroundColor: Colors.primary.blue },
  progressLabel: { fontSize: 12, fontWeight: '600', color: Colors.text.secondary, textAlign: 'center', marginTop: 6, marginBottom: 8 },
  scrollContent: { flexGrow: 1, padding: 16 },
  stepContainer: { alignItems: 'center' },
  iconCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: Colors.primary.blue + '10', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  title: { fontSize: 20, fontWeight: '800', color: Colors.text.primary, marginBottom: 8, textAlign: 'center' },
  desc: { fontSize: 13, color: Colors.text.secondary, textAlign: 'center', marginBottom: 16 },
  hint: { fontSize: 12, color: Colors.primary.blue, marginBottom: 8 },
  input: { width: '100%', backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: Colors.text.primary, borderWidth: 1, borderColor: Colors.border, marginBottom: 12 },
  card: { width: '100%', backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: Colors.border },
  checkboxRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 14 },
  checkbox: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: Colors.border, justifyContent: 'center', alignItems: 'center', marginTop: 2 },
  checkboxChecked: { backgroundColor: Colors.primary.blue, borderColor: Colors.primary.blue },
  checkboxLabel: { flex: 1, fontSize: 13, color: Colors.text.primary, lineHeight: 19 },
  otpRow: { flexDirection: 'row', justifyContent: 'center', gap: 10, marginVertical: 12 },
  otpBox: { width: 46, height: 54, backgroundColor: '#fff', borderRadius: 10, borderWidth: 1.5, borderColor: Colors.border, fontSize: 22, fontWeight: '700', color: Colors.text.primary },
  successBox: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, backgroundColor: '#f0fdf4', borderRadius: 10, borderWidth: 1, borderColor: '#bbf7d0', width: '100%' },
  successText: { fontSize: 13, color: '#15803d', fontWeight: '600' },
  actionBtn: { backgroundColor: Colors.primary.orange, paddingVertical: 12, paddingHorizontal: 24, borderRadius: 10, marginTop: 8 },
  actionBtnDisabled: { backgroundColor: Colors.text.light },
  actionBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  reviewLabel: { fontSize: 12, color: Colors.text.light, marginTop: 8 },
  reviewValue: { fontSize: 15, fontWeight: '600', color: Colors.text.primary, marginBottom: 4 },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.status.error + '10', padding: 12, borderRadius: 10, marginTop: 8, width: '100%' },
  errorText: { flex: 1, fontSize: 13, color: Colors.status.error },
  doneBtn: { backgroundColor: Colors.primary.blue, paddingVertical: 14, paddingHorizontal: 36, borderRadius: 12, marginTop: 24 },
  doneBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  bottomNav: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: Colors.border },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10 },
  backBtnText: { fontSize: 14, fontWeight: '500', color: Colors.text.secondary },
  nextBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.primary.orange, paddingVertical: 12, paddingHorizontal: 24, borderRadius: 10 },
  nextBtnDisabled: { backgroundColor: Colors.text.light },
  nextBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
