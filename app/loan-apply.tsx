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
  isValidPhone, sendWhatsAppOtp, verifyWhatsAppOtp, generateClientId,
  SA_PROVINCES, MARITAL_STATUS_OPTIONS, EMPLOYMENT_TYPE_OPTIONS, CONSENT_FORM_URL,
} from '../lib/productUtils';
import type { OtpPurpose } from '../lib/productUtils';
import ProfileGuard from '../components/ProfileGuard';

const STEPS = ['Personal', 'Employment', 'Consent & OTP', 'Submit'];
const OTP_PURPOSE: OtpPurpose = 'loan_application_authorization';

export default function LoanApplyScreen() {
  const router = useRouter();
  const { user, userProfile, updateUserProfile } = useAuth();

  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Personal
  const [idNumber, setIdNumber] = useState(userProfile?.idNumber || '');
  const [firstName, setFirstName] = useState(userProfile?.firstName || '');
  const [surname, setSurname] = useState(userProfile?.lastName || '');
  const [cellNumber, setCellNumber] = useState(userProfile?.phoneNumber || '');
  const [email, setEmail] = useState(userProfile?.email || '');
  const [maritalStatus, setMaritalStatus] = useState('');

  // Employment
  const [employmentType, setEmploymentType] = useState('');
  const [employer, setEmployer] = useState('');
  const [grossIncome, setGrossIncome] = useState('');
  const [netIncome, setNetIncome] = useState('');
  const [loanAmount, setLoanAmount] = useState('');
  const [loanPurpose, setLoanPurpose] = useState('');

  // OTP
  const [popiaConsent, setPopiaConsent] = useState(false);
  const [loanConsent, setLoanConsent] = useState(false);
  const [otpId, setOtpId] = useState('');
  const [otpInput, setOtpInput] = useState(['', '', '', '', '', '']);
  const otpRefs = useRef<(TextInput | null)[]>([]);
  const [otpVerified, setOtpVerified] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const validate = (): boolean => {
    setError('');
    if (step === 0) {
      if (!isValidSAID(idNumber)) { setError('Valid 13-digit SA ID required.'); return false; }
      if (!firstName.trim() || !surname.trim()) { setError('Name and surname required.'); return false; }
      if (!isValidPhone(cellNumber)) { setError('Valid SA phone number required.'); return false; }
      return true;
    }
    if (step === 1) {
      if (!employmentType) { setError('Select employment type.'); return false; }
      if (!grossIncome || isNaN(Number(grossIncome))) { setError('Valid gross income required.'); return false; }
      if (!loanAmount || isNaN(Number(loanAmount))) { setError('Valid loan amount required.'); return false; }
      return true;
    }
    if (step === 2) {
      if (!popiaConsent || !loanConsent) { setError('Accept both consents.'); return false; }
      if (!otpVerified) { setError('Verify your WhatsApp number.'); return false; }
      return true;
    }
    return true;
  };

  const goNext = () => { if (!validate()) return; setStep((s) => s + 1); };
  const goBack = () => { setError(''); if (step === 0) router.back(); else setStep((s) => s - 1); };

  const handleSendOtp = async () => {
    if (!popiaConsent || !loanConsent) { setError('Accept both consents first.'); return; }
    setLoading(true);
    try {
      const result = await sendWhatsAppOtp(cellNumber, OTP_PURPOSE);
      if (result.success) setOtpId(result.otpId);
      else setError(result.message || 'Failed to send OTP.');
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Failed to send OTP.'); }
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
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Verification failed.'); }
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
      const phone = normalizePhone(cellNumber);
      const dob = extractDobFromId(idNumber);
      const gender = extractGenderFromId(idNumber);

      const applicationData = {
        personal: { firstName, surname, idNumber, dateOfBirth: dob?.dob, gender, age: dob?.age, cellNumber: phone, email, maritalStatus },
        employment: { employmentType, employer, grossIncome: Number(grossIncome), netIncome: netIncome ? Number(netIncome) : null },
        loan: { amount: Number(loanAmount), purpose: loanPurpose },
        otpVerified: true, consentGrantedAt: now,
        status: 'submitted', submittedAt: now, createdAt: now, updatedAt: now,
      };

      await updateUserProfile({ idNumber, firstName, lastName: surname, fullName, updatedAt: now } as Record<string, unknown>);

      const consentRef = doc(collection(db, 'profiles', uid, 'consents'));
      await setDoc(consentRef, {
        consentId: consentRef.id, consentType: 'loan_application_authorization',
        fullName, surname, idNumber, popiaConsent: true,
        otpVerified: true, otpCode: otpId, otpVerifiedAt: now,
        consentGrantedAt: now, channel: 'mobile' as const, createdAt: now,
      });

      const productRef = doc(collection(db, 'clientProducts'));
      await setDoc(productRef, {
        productApplicationId: productRef.id, productType: 'personal_loan',
        productName: 'Personal Loan', productDescription: `Loan Application — R${Number(loanAmount).toLocaleString()}`,
        status: 'applied', statusLabel: 'Application Submitted',
        idNumber, waId: userProfile.waId || null, uid, email: userProfile.email,
        clientName: fullName, channel: 'mobile',
        reference: `LN-${uid.slice(0, 6)}-${consentRef.id}`, consentId: consentRef.id,
        paymentId: null, amount: Number(loanAmount),
        createdAt: now, updatedAt: now, paidAt: null, completedAt: null,
      });

      setSubmitted(true);
    } catch (err) {
      console.error('[LoanApply] Submit failed:', err);
      Alert.alert('Error', 'Something went wrong.');
    } finally { setLoading(false); }
  };

  const maskedPhone = (() => { const ph = cellNumber || ''; return ph ? ph.slice(0, 3) + '****' + ph.slice(-3) : ''; })();

  if (submitted) {
    return (
      <SafeAreaView style={s.container} edges={['bottom']}>
        <ScrollView contentContainerStyle={s.scrollContent}>
          <View style={s.stepContainer}>
            <View style={[s.iconCircle, { backgroundColor: Colors.status.success + '15' }]}>
              <Ionicons name="checkmark-circle" size={36} color={Colors.status.success} />
            </View>
            <Text style={s.title}>Application Submitted!</Text>
            <Text style={s.desc}>Your loan application has been received. We'll be in touch via WhatsApp.</Text>
            <TouchableOpacity style={s.doneBtn} onPress={() => router.back()} activeOpacity={0.8}>
              <Text style={s.doneBtnText}>Back to Loans</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <ProfileGuard>
    <SafeAreaView style={s.container} edges={['bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={s.progressBar}>
          {STEPS.map((_, i) => (
            <View key={i} style={[s.dot, i <= step && s.dotActive, i === step && s.dotCurrent]} />
          ))}
        </View>
        <Text style={s.progressLabel}>Step {step + 1} of {STEPS.length}: {STEPS[step]}</Text>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
          {step === 0 && (
            <View style={s.stepContainer}>
              <View style={s.iconCircle}><Ionicons name="person" size={28} color={Colors.primary.blue} /></View>
              <Text style={s.title}>Personal Details</Text>
              <TextInput style={s.input} placeholder="SA ID Number (13 digits)" placeholderTextColor={Colors.text.light} value={idNumber} onChangeText={(v) => setIdNumber(v.replace(/\D/g, '').slice(0, 13))} keyboardType="number-pad" maxLength={13} />
              <TextInput style={s.input} placeholder="First Name" placeholderTextColor={Colors.text.light} value={firstName} onChangeText={setFirstName} />
              <TextInput style={s.input} placeholder="Surname" placeholderTextColor={Colors.text.light} value={surname} onChangeText={setSurname} />
              <TextInput style={s.input} placeholder="Cell Number (e.g. 0731234567)" placeholderTextColor={Colors.text.light} value={cellNumber} onChangeText={setCellNumber} keyboardType="phone-pad" />
              <TextInput style={s.input} placeholder="Email" placeholderTextColor={Colors.text.light} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
            </View>
          )}

          {step === 1 && (
            <View style={s.stepContainer}>
              <View style={s.iconCircle}><Ionicons name="briefcase" size={28} color={Colors.primary.blue} /></View>
              <Text style={s.title}>Employment &amp; Loan</Text>
              <View style={s.pickerWrap}>
                {EMPLOYMENT_TYPE_OPTIONS.map((o) => (
                  <TouchableOpacity key={o.id} style={[s.chip, employmentType === o.id && s.chipActive]} onPress={() => setEmploymentType(o.id)}>
                    <Text style={[s.chipText, employmentType === o.id && s.chipTextActive]}>{o.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TextInput style={s.input} placeholder="Employer Name" placeholderTextColor={Colors.text.light} value={employer} onChangeText={setEmployer} />
              <TextInput style={s.input} placeholder="Gross Monthly Income (R)" placeholderTextColor={Colors.text.light} value={grossIncome} onChangeText={setGrossIncome} keyboardType="number-pad" />
              <TextInput style={s.input} placeholder="Net Monthly Income (R)" placeholderTextColor={Colors.text.light} value={netIncome} onChangeText={setNetIncome} keyboardType="number-pad" />
              <TextInput style={s.input} placeholder="Loan Amount Needed (R)" placeholderTextColor={Colors.text.light} value={loanAmount} onChangeText={setLoanAmount} keyboardType="number-pad" />
              <TextInput style={s.input} placeholder="Purpose of Loan (optional)" placeholderTextColor={Colors.text.light} value={loanPurpose} onChangeText={setLoanPurpose} />
            </View>
          )}

          {step === 2 && (
            <View style={s.stepContainer}>
              <View style={s.iconCircle}><Ionicons name="shield-checkmark" size={28} color={Colors.primary.blue} /></View>
              <Text style={s.title}>Consent &amp; Verify</Text>
              <View style={s.card}>
                <TouchableOpacity style={s.checkboxRow} onPress={() => setPopiaConsent(!popiaConsent)}>
                  <View style={[s.checkbox, popiaConsent && s.checkboxChecked]}>{popiaConsent && <Ionicons name="checkmark" size={14} color="#fff" />}</View>
                  <Text style={s.checkboxLabel}>I consent to processing of my personal information (POPIA).</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.checkboxRow} onPress={() => setLoanConsent(!loanConsent)}>
                  <View style={[s.checkbox, loanConsent && s.checkboxChecked]}>{loanConsent && <Ionicons name="checkmark" size={14} color="#fff" />}</View>
                  <Text style={s.checkboxLabel}>I authorise MyBenefitz to process my loan application.</Text>
                </TouchableOpacity>
              </View>
              {otpVerified ? (
                <View style={s.successBox}><Ionicons name="checkmark-circle" size={16} color="#15803d" /><Text style={s.successText}>WhatsApp verified!</Text></View>
              ) : !otpId ? (
                <TouchableOpacity style={[s.actionBtn, (!popiaConsent || !loanConsent) && s.actionBtnDisabled]} onPress={handleSendOtp} disabled={!popiaConsent || !loanConsent || loading}>
                  {loading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.actionBtnText}>Send Verification Code</Text>}
                </TouchableOpacity>
              ) : (
                <View style={{ width: '100%', alignItems: 'center' }}>
                  <Text style={s.desc}>Enter OTP sent to {maskedPhone}</Text>
                  <View style={s.otpRow}>
                    {otpInput.map((d, i) => (
                      <TextInput key={i} ref={(el) => { otpRefs.current[i] = el; }} style={s.otpBox} value={d}
                        onChangeText={(v) => handleOtpChange(i, v)} keyboardType="number-pad" maxLength={1} textAlign="center"
                        onKeyPress={(e) => { if (e.nativeEvent.key === 'Backspace' && !otpInput[i] && i > 0) otpRefs.current[i - 1]?.focus(); }} />
                    ))}
                  </View>
                  <View style={{ flexDirection: 'row', gap: 12 }}>
                    <TouchableOpacity style={s.actionBtn} onPress={handleVerifyOtp} disabled={otpInput.join('').length !== 6 || loading}>
                      {loading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.actionBtnText}>Verify</Text>}
                    </TouchableOpacity>
                    <TouchableOpacity onPress={handleResendOtp} disabled={loading}><Text style={{ color: Colors.primary.blue, fontWeight: '600' }}>Resend</Text></TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          )}

          {step === 3 && (
            <View style={s.stepContainer}>
              <View style={s.iconCircle}><Ionicons name="document-text" size={28} color={Colors.primary.blue} /></View>
              <Text style={s.title}>Review &amp; Submit</Text>
              <View style={s.card}>
                <Text style={s.reviewLabel}>Name</Text><Text style={s.reviewValue}>{firstName} {surname}</Text>
                <Text style={s.reviewLabel}>ID Number</Text><Text style={s.reviewValue}>{idNumber}</Text>
                <Text style={s.reviewLabel}>Cell</Text><Text style={s.reviewValue}>{cellNumber}</Text>
                <Text style={s.reviewLabel}>Employment</Text><Text style={s.reviewValue}>{employmentType} — {employer}</Text>
                <Text style={s.reviewLabel}>Gross Income</Text><Text style={s.reviewValue}>R {Number(grossIncome).toLocaleString()}</Text>
                <Text style={s.reviewLabel}>Loan Amount</Text><Text style={s.reviewValue}>R {Number(loanAmount).toLocaleString()}</Text>
              </View>
            </View>
          )}

          {error ? <View style={s.errorBox}><Ionicons name="alert-circle" size={16} color={Colors.status.error} /><Text style={s.errorText}>{error}</Text></View> : null}
        </ScrollView>

        <View style={s.bottomNav}>
          <TouchableOpacity style={s.backBtn} onPress={goBack}><Ionicons name="arrow-back" size={20} color={Colors.text.secondary} /><Text style={s.backBtnText}>{step === 0 ? 'Cancel' : 'Back'}</Text></TouchableOpacity>
          <TouchableOpacity style={[s.nextBtn, (step === 2 && !otpVerified) && s.nextBtnDisabled]} onPress={step === 3 ? handleSubmit : goNext} disabled={loading || (step === 2 && !otpVerified)} activeOpacity={0.8}>
            {loading ? <ActivityIndicator color="#fff" size="small" /> : <><Text style={s.nextBtnText}>{step === 3 ? 'Submit Application' : 'Continue'}</Text><Ionicons name="arrow-forward" size={18} color="#fff" /></>}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
    </ProfileGuard>
  );
}

const s = StyleSheet.create({
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
  input: { width: '100%', backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: Colors.text.primary, borderWidth: 1, borderColor: Colors.border, marginBottom: 12 },
  card: { width: '100%', backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: Colors.border },
  pickerWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, width: '100%', marginBottom: 12 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: Colors.border, backgroundColor: '#fff' },
  chipActive: { backgroundColor: Colors.primary.blue, borderColor: Colors.primary.blue },
  chipText: { fontSize: 13, color: Colors.text.secondary },
  chipTextActive: { color: '#fff', fontWeight: '600' },
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
