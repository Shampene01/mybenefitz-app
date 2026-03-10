import { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { doc, setDoc, collection } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Colors } from '../constants/Colors';
import { AvatarImage, AVATARS } from '../components/ChatAvatars';
import type { AvatarProfile } from '../components/ChatAvatars';
import {
  isValidSAID, extractDobFromId, extractGenderFromId, normalizePhone,
  isValidPhone, sendWhatsAppOtp, verifyWhatsAppOtp,
  SA_PROVINCES, EMPLOYMENT_TYPE_OPTIONS, BANK_OPTIONS, ACCOUNT_TYPE_OPTIONS,
  LOAN_QUALIFICATION_OPTIONS, PREFERRED_CONTACT_OPTIONS, CONSENT_FORM_URL,
  submitProductApplication, getReferralInfo,
} from '../lib/productUtils';
import type { OtpPurpose } from '../lib/productUtils';
import ProfileGuard from '../components/ProfileGuard';

const AC = '#d97706', ACBG = '#fffbeb';
const OTP_PURPOSE: OtpPurpose = 'loan_application_authorization';

type StepKey =
  | 'choose_avatar' | 'greeting'
  | 'id_number' | 'first_name' | 'surname' | 'cell_number' | 'email'
  | 'preferred_contact' | 'confirm_address'
  | 'employer_name' | 'occupation' | 'employment_type'
  | 'qualification' | 'smoker' | 'primary_bank' | 'account_type'
  | 'loan_type' | 'loan_amount' | 'repayment_period'
  | 'review' | 'consent' | 'otp' | 'submitting' | 'done';

interface Msg { id: string; from: 'bot' | 'user'; text: string; inputType?: string; options?: { id: string; label: string; sub?: string }[]; placeholder?: string; field?: string; }

function bold(t: string) {
  const parts = t.split(/(\*\*.*?\*\*)/g);
  return parts.map((p, i) => p.startsWith('**') && p.endsWith('**') ? <Text key={i} style={{ fontWeight: '700' }}>{p.slice(2, -2)}</Text> : <Text key={i}>{p}</Text>);
}

export default function LoanApplyScreen() {
  const router = useRouter();
  const { user, userProfile, updateUserProfile, refreshApplications } = useAuth();
  const scrollRef = useRef<ScrollView>(null);
  const idVerified = userProfile?.identityVerification?.status === 'home_affairs_verified';

  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [step, setStepState] = useState<StepKey>('choose_avatar');
  const [avatar, setAvatar] = useState<AvatarProfile>(AVATARS[0]);
  const [avatarChosen, setAvatarChosen] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [data, setData] = useState<Record<string, string>>({});
  const [pending, setPending] = useState<{ s: StepKey; e?: Record<string, string> } | null>(null);
  const [typing, setTyping] = useState(false);

  // Address
  const [addr, setAddr] = useState({ street: '', suburb: '', city: '', province: '' });
  // Consent
  const [popiaC, setPopiaC] = useState(false);
  const [waC, setWaC] = useState(false);
  const [termsC, setTermsC] = useState(false);
  const [creditC, setCreditC] = useState(false);
  const [debtNo, setDebtNo] = useState(false);
  // OTP
  const [otpId, setOtpId] = useState('');
  const [otpMsgId, setOtpMsgId] = useState('');
  const [otpInput, setOtpInput] = useState(['', '', '', '', '', '']);
  const otpRefs = useRef<(TextInput | null)[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const scroll = () => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 200);
  const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const addBot = useCallback((text: string, extra?: Partial<Msg>) => { setMsgs(p => [...p, { id: uid(), from: 'bot', text, ...extra }]); scroll(); }, []);
  const addUser = useCallback((text: string) => { setMsgs(p => [...p, { id: uid(), from: 'user', text }]); scroll(); }, []);

  const progressTo = useCallback((next: StepKey, extra?: Record<string, string>) => {
    if (extra) setData(d => ({ ...d, ...extra }));
    setPending({ s: next, e: extra });
  }, []);

  useEffect(() => {
    if (!pending) return;
    const { s: next } = pending;
    setPending(null);
    setStepState(next);
    setTyping(true);
    const t = setTimeout(() => {
      setTyping(false);
      const d = { ...data, ...pending?.e };
      const name = avatar.name;
      switch (next) {
        case 'greeting': addBot(`Hi ${userProfile?.firstName || 'there'}! I'm ${name}, your loan assistant. Let's get your application started.\n\nFirst, what is your **SA ID Number**?`, { inputType: 'text', placeholder: '13-digit SA ID', field: 'idNumber' }); break;
        case 'id_number': addBot('Please enter your **SA ID Number** (13 digits):', { inputType: 'text', placeholder: '13-digit SA ID', field: 'idNumber' }); break;
        case 'first_name': addBot('What is your **first name**?', { inputType: 'text', placeholder: 'First name', field: 'firstName' }); break;
        case 'surname': addBot('And your **surname**?', { inputType: 'text', placeholder: 'Surname', field: 'surname' }); break;
        case 'cell_number': addBot('What is your **cell phone number**?', { inputType: 'text', placeholder: '0XX XXX XXXX', field: 'cellNumber' }); break;
        case 'email': addBot('What is your **email address**?', { inputType: 'text', placeholder: 'email@example.com', field: 'email' }); break;
        case 'preferred_contact': addBot('How would you prefer we contact you?', { inputType: 'buttons', options: PREFERRED_CONTACT_OPTIONS }); break;
        case 'confirm_address': addBot('Please confirm your **residential address**:', { inputType: 'none' }); break;
        case 'employer_name': addBot('Who is your **employer**?', { inputType: 'text', placeholder: 'Employer name', field: 'employerName' }); break;
        case 'occupation': addBot('What is your **occupation/job title**?', { inputType: 'text', placeholder: 'Occupation', field: 'occupation' }); break;
        case 'employment_type': addBot('What is your **employment type**?', { inputType: 'buttons', options: EMPLOYMENT_TYPE_OPTIONS }); break;
        case 'qualification': addBot('What is your **highest qualification**?', { inputType: 'buttons', options: LOAN_QUALIFICATION_OPTIONS }); break;
        case 'smoker': addBot('Are you a **smoker**?', { inputType: 'buttons', options: [{ id: 'yes', label: 'Yes' }, { id: 'no', label: 'No' }] }); break;
        case 'primary_bank': addBot('Which **bank** do you use?', { inputType: 'buttons', options: BANK_OPTIONS }); break;
        case 'account_type': addBot('What **type of account**?', { inputType: 'buttons', options: ACCOUNT_TYPE_OPTIONS }); break;
        case 'loan_type': addBot('What **type of loan** are you looking for?', { inputType: 'buttons', options: [{ id: 'personal', label: 'Personal Loan' }, { id: 'debt_consolidation', label: 'Debt Consolidation' }, { id: 'education', label: 'Education Loan' }] }); break;
        case 'loan_amount': addBot('How much would you like to borrow? (R)', { inputType: 'text', placeholder: 'e.g. 10000', field: 'loanAmount' }); break;
        case 'repayment_period': addBot('Over how many **months** would you like to repay?', { inputType: 'buttons', options: [{ id: '12', label: '12 Months' }, { id: '24', label: '24 Months' }, { id: '36', label: '36 Months' }, { id: '48', label: '48 Months' }, { id: '60', label: '60 Months' }] }); break;
        case 'review': {
          const lines = [
            '📋 **Application Summary**\n',
            `**Name:** ${d.firstName} ${d.surname}`,
            `**ID:** ${d.idNumber}`,
            `**Phone:** ${d.cellNumber}`,
            `**Email:** ${d.email}`,
            `**Employer:** ${d.employerName}`,
            `**Occupation:** ${d.occupation}`,
            `**Bank:** ${BANK_OPTIONS.find(b => b.id === d.primaryBank)?.label || d.primaryBank}`,
            `**Loan Type:** ${d.loanType}`,
            `**Amount:** R ${Number(d.loanAmount || 0).toLocaleString()}`,
            `**Repayment:** ${d.repaymentPeriod} months`,
          ];
          addBot(lines.join('\n'), { inputType: 'none' });
          break;
        }
        case 'consent': addBot('Please review and accept the consent terms below.', { inputType: 'none' }); break;
        case 'otp': addBot('A 6-digit code has been sent to your WhatsApp. Please enter it below.', { inputType: 'none' }); break;
        case 'submitting': addBot('⏳ Submitting your loan application...', { inputType: 'none' }); break;
        case 'done': addBot('🎉 **Application Submitted!**\n\nYour loan application has been received. Our team will review it and get back to you.\n\nTrack your application in **My Products**.', { inputType: 'none' }); break;
      }
    }, 600);
    return () => clearTimeout(t);
  }, [pending]);

  const handleAvatarSelect = (av: AvatarProfile) => { setAvatar(av); setAvatarChosen(true); progressTo('greeting'); };

  const handleButtonClick = (optionId: string, label: string) => {
    addUser(label);
    setError('');
    switch (step) {
      case 'preferred_contact': progressTo('confirm_address', { preferredContact: optionId }); break;
      case 'employment_type': progressTo('qualification', { employmentType: optionId }); break;
      case 'qualification': progressTo('smoker', { qualification: optionId }); break;
      case 'smoker': progressTo('primary_bank', { smoker: optionId }); break;
      case 'primary_bank': progressTo('account_type', { primaryBank: optionId }); break;
      case 'account_type': progressTo('loan_type', { accountType: optionId }); break;
      case 'loan_type': progressTo('loan_amount', { loanType: label }); break;
      case 'repayment_period': progressTo('review', { repaymentPeriod: optionId }); break;
    }
  };

  const handleTextSubmit = useCallback(() => {
    const val = textInput.trim();
    if (!val) return;
    setTextInput('');
    setError('');
    addUser(val);
    switch (step) {
      case 'greeting': case 'id_number': {
        const raw = val.replace(/\D/g, '');
        if (!isValidSAID(raw)) { setError('Enter a valid 13-digit SA ID.'); return; }
        const dob = extractDobFromId(raw);
        const gender = extractGenderFromId(raw);
        const extra: Record<string, string> = { idNumber: raw };
        if (dob) { extra.dob = dob.dob; extra.age = String(dob.age); }
        if (gender) extra.gender = gender;
        if (idVerified && userProfile?.firstName) { extra.firstName = userProfile.firstName; extra.surname = userProfile?.lastName || ''; addBot(`Got it! Your verified name is **${userProfile.firstName} ${userProfile.lastName || ''}**.`); progressTo('cell_number', extra); }
        else progressTo('first_name', extra);
        break;
      }
      case 'first_name': progressTo('surname', { firstName: val }); break;
      case 'surname': progressTo('cell_number', { surname: val }); break;
      case 'cell_number': if (!isValidPhone(val)) { setError('Enter a valid SA phone number.'); return; } progressTo('email', { cellNumber: val }); break;
      case 'email': progressTo('preferred_contact', { email: val }); break;
      case 'employer_name': progressTo('occupation', { employerName: val }); break;
      case 'occupation': progressTo('employment_type', { occupation: val }); break;
      case 'loan_amount': { const n = parseFloat(val.replace(/[^\d.]/g, '')); if (isNaN(n) || n < 500) { setError('Minimum loan amount is R500.'); return; } progressTo('repayment_period', { loanAmount: String(n) }); break; }
    }
  }, [textInput, step, data, addUser, addBot, progressTo, idVerified, userProfile]);

  const handleAddressConfirm = () => {
    if (!addr.street || !addr.city || !addr.province) { setError('Please fill in street, city, and province.'); return; }
    setError('');
    addUser(`📍 ${addr.street}, ${addr.city}, ${addr.province}`);
    setData(d => ({ ...d, ...addr }));
    progressTo('employer_name');
  };

  const handleSendOtp = async () => {
    if (!popiaC || !waC || !termsC || !creditC || !debtNo) { setError('Please accept all required consents.'); return; }
    setLoading(true);
    try {
      const phone = data.cellNumber || '';
      const result = await sendWhatsAppOtp(phone, OTP_PURPOSE);
      if (result.success) { setOtpId(result.otpId); const mid = (result as unknown as Record<string, string>).messageId; if (mid) setOtpMsgId(mid); setStepState('otp'); addBot('A 6-digit code has been sent to your WhatsApp. Please enter it below.', { inputType: 'none' }); }
      else setError(result.message || 'Failed to send OTP.');
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Failed to send OTP.'); }
    finally { setLoading(false); }
  };

  const handleOtpChange = (i: number, v: string) => {
    if (!/^\d*$/.test(v)) return;
    const n = [...otpInput]; n[i] = v.slice(-1); setOtpInput(n);
    if (v && i < 5) otpRefs.current[i + 1]?.focus();
  };

  const handleVerifyOtp = async () => {
    const entered = otpInput.join('');
    if (entered.length !== 6) { setError('Enter the full 6-digit code.'); return; }
    setLoading(true);
    try {
      const result = await verifyWhatsAppOtp(otpId, entered);
      if (result.verified) { setStepState('submitting'); addBot('⏳ Submitting your loan application...', { inputType: 'none' }); await handleFinalSubmit(); }
      else setError(result.message || 'Invalid code. Try again.');
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Verification failed.'); }
    finally { setLoading(false); }
  };

  const handleFinalSubmit = async () => {
    if (!user || !userProfile) return;
    try {
      const uid2 = user.uid;
      const now = new Date().toISOString();
      const fullName = `${data.firstName} ${data.surname}`.trim();
      const phone = normalizePhone(data.cellNumber);

      const applicationData = {
        personal: { firstName: data.firstName, surname: data.surname, idNumber: data.idNumber, dateOfBirth: data.dob, age: data.age ? parseInt(data.age) : null, gender: data.gender, cellNumber: phone, whatsAppNumber: phone, isWhatsAppSame: true, email: data.email, preferredContact: data.preferredContact || 'whatsapp', address: { streetAddress: addr.street, suburb: addr.suburb || '', city: addr.city, province: addr.province } },
        employment: { employerName: data.employerName, occupation: data.occupation, employmentType: data.employmentType, highestQualification: data.qualification, isSmoker: data.smoker === 'yes', primaryBank: data.primaryBank, accountType: data.accountType },
        loanDetails: { loanType: data.loanType, loanAmount: parseFloat(data.loanAmount || '0'), repaymentPeriod: parseInt(data.repaymentPeriod || '0', 10) },
        consent: { creditCheckConsent: true, isUnderDebtReview: false, popiaConsent: true, whatsappConsent: true, termsConsent: true, marketingConsent: false, otpVerified: true, otpVerifiedAt: now },
        status: 'submitted' as const, submittedAt: now, createdAt: now, updatedAt: now,
      };

      await updateUserProfile({ idNumber: data.idNumber, firstName: data.firstName, lastName: data.surname, fullName, email: data.email, phoneNumber: data.cellNumber, whatsappNumber: data.cellNumber, address: { street: addr.street, suburb: addr.suburb, city: addr.city, province: addr.province }, income: { employerName: data.employerName }, updatedAt: now } as Record<string, unknown>);

      try { await fetch(CONSENT_FORM_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ client_id: `LOAN-${uid2.slice(0, 8)}`, wa_id: phone, id_number: data.idNumber, full_name: fullName, cell_number: phone, otp_code: otpInput.join(''), otp_verified_at: now, message_id: otpMsgId || `mobile-otp-${Date.now()}`, purpose: 'Loan Application', form_type: 'loan_application' }) }); } catch { /* non-fatal */ }

      const consentRef = doc(collection(db, 'profiles', uid2, 'consents'));
      await setDoc(consentRef, { consentId: consentRef.id, consentType: 'loan_application', fullName, surname: data.surname, idNumber: data.idNumber, clientPhone: phone, popiaConsent: true, creditReportConsent: true, whatsAppContactConsent: true, otpVerified: true, otpCode: otpId, otpVerifiedAt: now, consentGrantedAt: now, messageId: otpMsgId || null, purpose: 'Loan Application Authorization', status: 'active' as const, channel: 'mobile_app' as const, createdAt: now });

      const { registrationType, referrerCode, referredBy } = getReferralInfo(userProfile as unknown as Record<string, unknown>);
      await submitProductApplication({ uid: uid2, productType: 'loan', productName: 'Personal Loan', productDescription: 'Loan Application', status: 'applied', statusLabel: 'Application Submitted', applicationData: applicationData as unknown as Record<string, unknown>, consent: { consentId: consentRef.id, consentType: 'loan_application', otpVerified: true, otpCode: otpId, otpMessageId: otpMsgId || null, otpVerifiedAt: now, consentGrantedAt: now, messageId: otpMsgId || null }, reference: `LOAN-${uid2.slice(0, 6)}-${Date.now().toString(36)}`, idNumber: data.idNumber, waId: (userProfile as unknown as Record<string, unknown>).waId as string || null, email: data.email, clientName: fullName, registrationType, referrerCode, referredBy });

      await refreshApplications();
      setStepState('done');
      addBot('🎉 **Application Submitted!**\n\nYour loan application has been received. Our team will review it and get back to you.\n\nTrack your application in **My Products**.', { inputType: 'none' });
    } catch (err) { console.error('[LoanChatbot] Submit failed:', err); setError('Something went wrong. Please try again.'); setStepState('review'); }
  };

  const maskedPhone = data.cellNumber ? data.cellNumber.replace(/(\d{3})\d{4}(\d+)/, '$1****$2') : '';
  const lastBot = [...msgs].reverse().find(m => m.from === 'bot');
  const showTextBar = avatarChosen && lastBot?.inputType === 'text' && !['done', 'submitting', 'review', 'confirm_address', 'consent', 'otp'].includes(step);

  // ── Avatar chooser ────────────────────────────────────────────────
  if (!avatarChosen) {
    return (
      <ProfileGuard>
      <SafeAreaView style={s.ctr} edges={['bottom']}>
        <View style={s.hdr}><TouchableOpacity onPress={() => router.back()} style={s.hdrBack}><Ionicons name="arrow-back" size={22} color="#fff" /></TouchableOpacity><Text style={s.hdrTitle}>Loan Application</Text></View>
        <ScrollView contentContainerStyle={{ padding: 24, alignItems: 'center' }}>
          <View style={[s.badge, { backgroundColor: ACBG }]}><Ionicons name="wallet" size={13} color={AC} /><Text style={{ color: '#92400e', fontSize: 12, fontWeight: '500' }}>Loan Application — Chat Mode</Text></View>
          <Text style={{ fontSize: 18, fontWeight: '800', color: '#111827', marginTop: 12, textAlign: 'center' }}>Choose Your Assistant</Text>
          <Text style={{ fontSize: 13, color: '#6b7280', textAlign: 'center', marginTop: 4, marginBottom: 20 }}>Pick who you'd like to guide you through your loan application.</Text>
          <View style={{ flexDirection: 'row', gap: 12, width: '100%' }}>
            {AVATARS.map(av => (
              <TouchableOpacity key={av.id} style={s.avCard} onPress={() => handleAvatarSelect(av)}>
                <AvatarImage avatar={av} size={56} />
                <Text style={{ fontWeight: '700', fontSize: 14, color: '#111827', marginTop: 8 }}>{av.name}</Text>
                <Text style={{ fontSize: 10, color: '#9ca3af' }}>{av.gender} Digital Assistant</Text>
                <Text style={{ fontSize: 11, color: '#6b7280', textAlign: 'center', marginTop: 4 }}>{av.personality}</Text>
                <View style={[s.avBtn, { backgroundColor: AC }]}><Text style={{ color: '#fff', fontWeight: '600', fontSize: 12 }}>Chat with {av.name}</Text></View>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
      </ProfileGuard>
    );
  }

  // ── Chat UI ───────────────────────────────────────────────────────
  return (
    <ProfileGuard>
    <SafeAreaView style={s.ctr} edges={['bottom']}>
      <View style={s.hdr}><TouchableOpacity onPress={() => router.back()} style={s.hdrBack}><Ionicons name="arrow-back" size={22} color="#fff" /></TouchableOpacity><Text style={s.hdrTitle}>Loan Application</Text></View>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={0}>
        <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={s.chatScroll}>
          {msgs.map(m => (
            <View key={m.id} style={[s.msgRow, m.from === 'user' && { justifyContent: 'flex-end' }]}>
              {m.from === 'bot' && <AvatarImage avatar={avatar} size={30} />}
              <View style={[s.bubble, m.from === 'user' ? s.userBubble : s.botBubble]}>
                <Text style={[s.bubbleText, m.from === 'user' && { color: '#fff' }]}>{bold(m.text)}</Text>
              </View>
            </View>
          ))}
          {typing && <View style={s.msgRow}><AvatarImage avatar={avatar} size={30} /><View style={s.botBubble}><Text style={s.bubbleText}>...</Text></View></View>}

          {/* Button options */}
          {lastBot?.inputType === 'buttons' && lastBot.options && !typing && (
            <View style={s.optWrap}>{lastBot.options.map(o => (
              <TouchableOpacity key={o.id} style={s.optBtn} onPress={() => handleButtonClick(o.id, o.label)}><Text style={s.optBtnText}>{o.label}</Text></TouchableOpacity>
            ))}</View>
          )}

          {/* Address form */}
          {step === 'confirm_address' && !typing && (
            <View style={s.formCard}>
              <Text style={s.formTitle}>Residential Address</Text>
              <TextInput style={s.input} placeholder="Street Address" placeholderTextColor={Colors.text.light} value={addr.street} onChangeText={v => setAddr(a => ({ ...a, street: v }))} />
              <TextInput style={s.input} placeholder="Suburb" placeholderTextColor={Colors.text.light} value={addr.suburb} onChangeText={v => setAddr(a => ({ ...a, suburb: v }))} />
              <TextInput style={s.input} placeholder="City" placeholderTextColor={Colors.text.light} value={addr.city} onChangeText={v => setAddr(a => ({ ...a, city: v }))} />
              <View style={s.optWrap}>{SA_PROVINCES.map(p => (<TouchableOpacity key={p} style={[s.optBtn, addr.province === p && { backgroundColor: AC, borderColor: AC }]} onPress={() => setAddr(a => ({ ...a, province: p }))}><Text style={[s.optBtnText, addr.province === p && { color: '#fff' }]}>{p}</Text></TouchableOpacity>))}</View>
              <TouchableOpacity style={[s.primaryBtn, { backgroundColor: AC }]} onPress={handleAddressConfirm}><Text style={s.primaryBtnText}>Confirm Address</Text></TouchableOpacity>
            </View>
          )}

          {/* Review → consent */}
          {step === 'review' && !typing && (
            <TouchableOpacity style={[s.primaryBtn, { backgroundColor: AC, marginTop: 8 }]} onPress={() => progressTo('consent')}><Text style={s.primaryBtnText}>Proceed to Consent</Text></TouchableOpacity>
          )}

          {/* Consent form */}
          {step === 'consent' && !typing && (
            <View style={s.formCard}>
              <Text style={s.formTitle}>Consent & Authorisation</Text>
              {[ [popiaC, setPopiaC, 'I consent to processing of my personal information (POPIA).'],
                 [waC, setWaC, 'I consent to being contacted via WhatsApp.'],
                 [termsC, setTermsC, 'I accept the Terms & Conditions.'],
                 [creditC, setCreditC, 'I authorise a credit check.'],
                 [debtNo, setDebtNo, 'I confirm I am NOT under debt review.'],
              ].map(([v, fn, label], i) => (
                <TouchableOpacity key={i} style={s.checkRow} onPress={() => (fn as (v: boolean) => void)(!(v as boolean))}>
                  <View style={[s.checkBox, (v as boolean) && s.checkBoxOn]}>{(v as boolean) && <Ionicons name="checkmark" size={13} color="#fff" />}</View>
                  <Text style={s.checkLabel}>{label as string}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity style={[s.primaryBtn, { backgroundColor: AC, marginTop: 12 }]} onPress={handleSendOtp} disabled={loading}>
                {loading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.primaryBtnText}>Send OTP & Continue</Text>}
              </TouchableOpacity>
            </View>
          )}

          {/* OTP */}
          {step === 'otp' && !typing && (
            <View style={s.formCard}>
              <Text style={s.formTitle}>Verify OTP</Text>
              <Text style={{ fontSize: 13, color: Colors.text.secondary, marginBottom: 8 }}>Code sent to {maskedPhone}</Text>
              <View style={s.otpRow}>{otpInput.map((d, i) => (
                <TextInput key={i} ref={el => { otpRefs.current[i] = el; }} style={s.otpBox} value={d} onChangeText={v => handleOtpChange(i, v)} keyboardType="number-pad" maxLength={1} textAlign="center" onKeyPress={e => { if (e.nativeEvent.key === 'Backspace' && !otpInput[i] && i > 0) otpRefs.current[i - 1]?.focus(); }} />
              ))}</View>
              <TouchableOpacity style={[s.primaryBtn, { backgroundColor: AC }]} onPress={handleVerifyOtp} disabled={loading}>
                {loading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.primaryBtnText}>Verify & Submit</Text>}
              </TouchableOpacity>
            </View>
          )}

          {/* Done */}
          {step === 'done' && (
            <TouchableOpacity style={[s.primaryBtn, { backgroundColor: AC, marginTop: 8 }]} onPress={() => router.push('/my-products' as any)}><Text style={s.primaryBtnText}>View My Products</Text></TouchableOpacity>
          )}

          {error ? <View style={s.errorBox}><Ionicons name="alert-circle" size={16} color={Colors.status.error} /><Text style={s.errorText}>{error}</Text></View> : null}
        </ScrollView>

        {/* Text input bar */}
        {showTextBar && (
          <View style={s.inputBar}>
            <TextInput style={s.inputBarField} placeholder={lastBot?.placeholder || 'Type here...'} placeholderTextColor={Colors.text.light} value={textInput} onChangeText={setTextInput} onSubmitEditing={handleTextSubmit} returnKeyType="send" keyboardType={lastBot?.field === 'loanAmount' ? 'number-pad' : lastBot?.field === 'email' ? 'email-address' : lastBot?.field === 'cellNumber' ? 'phone-pad' : 'default'} autoCapitalize={lastBot?.field === 'email' ? 'none' : 'words'} />
            <TouchableOpacity style={[s.sendBtn, { backgroundColor: AC }]} onPress={handleTextSubmit}><Ionicons name="send" size={18} color="#fff" /></TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
    </ProfileGuard>
  );
}

const s = StyleSheet.create({
  ctr: { flex: 1, backgroundColor: '#f8fafc' },
  hdr: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#0f172a', paddingHorizontal: 16, paddingVertical: 14 },
  hdrBack: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.12)', justifyContent: 'center', alignItems: 'center' },
  hdrTitle: { fontSize: 16, fontWeight: '700', color: '#fff' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 16 },
  avCard: { flex: 1, alignItems: 'center', padding: 16, borderRadius: 14, borderWidth: 2, borderColor: '#e5e7eb', backgroundColor: '#fff' },
  avBtn: { marginTop: 10, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8 },
  chatScroll: { padding: 16, paddingBottom: 24 },
  msgRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 12 },
  bubble: { maxWidth: '78%', padding: 12, borderRadius: 16 },
  botBubble: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb', borderBottomLeftRadius: 4 },
  userBubble: { backgroundColor: AC, borderBottomRightRadius: 4 },
  bubbleText: { fontSize: 14, color: Colors.text.primary, lineHeight: 20 },
  optWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12, paddingLeft: 38 },
  optBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: AC, backgroundColor: '#fff' },
  optBtnText: { fontSize: 13, fontWeight: '500', color: AC },
  formCard: { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#e5e7eb', marginLeft: 38 },
  formTitle: { fontSize: 15, fontWeight: '700', color: Colors.text.primary, marginBottom: 12 },
  input: { backgroundColor: '#f8fafc', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: Colors.text.primary, borderWidth: 1, borderColor: Colors.border, marginBottom: 10 },
  primaryBtn: { paddingVertical: 12, paddingHorizontal: 24, borderRadius: 10, alignItems: 'center', alignSelf: 'center' },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  checkRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 12 },
  checkBox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: Colors.border, justifyContent: 'center', alignItems: 'center', marginTop: 1 },
  checkBoxOn: { backgroundColor: AC, borderColor: AC },
  checkLabel: { flex: 1, fontSize: 13, color: Colors.text.primary, lineHeight: 18 },
  otpRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginVertical: 12 },
  otpBox: { width: 44, height: 52, backgroundColor: '#f8fafc', borderRadius: 10, borderWidth: 1.5, borderColor: Colors.border, fontSize: 22, fontWeight: '700', color: Colors.text.primary },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.status.error + '10', padding: 12, borderRadius: 10, marginTop: 8 },
  errorText: { flex: 1, fontSize: 13, color: Colors.status.error },
  inputBar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: Colors.border },
  inputBarField: { flex: 1, backgroundColor: '#f8fafc', borderRadius: 24, paddingHorizontal: 16, paddingVertical: 10, fontSize: 14, borderWidth: 1, borderColor: Colors.border, color: Colors.text.primary },
  sendBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
});
