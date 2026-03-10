import { useState, useRef, useCallback, useEffect } from 'react';
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
import ProfileGuard from '../components/ProfileGuard';
import { AvatarImage, AVATARS } from '../components/ChatAvatars';
import type { AvatarProfile } from '../components/ChatAvatars';
import {
  isValidSAID, extractDobFromId, extractGenderFromId, normalizePhone,
  sendWhatsAppOtp, verifyWhatsAppOtp,
  TITLE_OPTIONS, MARITAL_STATUS_OPTIONS, CONTRIBUTION_FREQUENCY_OPTIONS,
  ESCALATION_TYPE_OPTIONS, MONTHS, SA_PROVINCES, formatCurrency,
  submitProductApplication, getReferralInfo, CONSENT_FORM_URL,
} from '../lib/productUtils';
import type { OtpPurpose } from '../lib/productUtils';

const AC = '#10b981', ACD = '#059669', ACBG = '#ecfdf5';

interface ChatMessage { id: string; from: 'bot' | 'user'; text: string; }

type StepKey =
  | 'choose_avatar' | 'id_number' | 'title' | 'first_name' | 'surname' | 'phone'
  | 'marital_status' | 'retirement_age' | 'contribution_type' | 'frequency'
  | 'amount' | 'escalation_type' | 'escalation_pct' | 'escalation_month'
  | 'start_date' | 'confirm_address' | 'review_summary' | 'consent_step' | 'otp_step' | 'submitting' | 'done';

const CONTRIB_TYPES = [
  { id: 'debit_order', label: 'Debit Order', icon: '🏦' },
  { id: 'salary_deduction', label: 'Salary Deduction', icon: '💼' },
];
const RET_AGES = ['55', '60', '65', '70'];

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

export default function RetirementApplyScreen() {
  const router = useRouter();
  const { user, userProfile, updateUserProfile, isHomeAffairsVerified } = useAuth();
  const idV = isHomeAffairsVerified;
  const firstName = userProfile?.displayName?.split(' ')[0] || userProfile?.firstName || 'there';
  const scrollRef = useRef<ScrollView>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentStep, setCurrentStep] = useState<StepKey>('choose_avatar');
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [selectedAvatar, setSelectedAvatar] = useState<AvatarProfile>(AVATARS[0]);
  const [avatarChosen, setAvatarChosen] = useState(false);
  const [data, setData] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Address
  const [addr, setAddr] = useState({ street: '', suburb: '', city: '', province: '', postalCode: '' });

  // Consent & OTP
  const [popiaConsent, setPopiaConsent] = useState(false);
  const [raConsent, setRaConsent] = useState(false);
  const [otpId, setOtpId] = useState(''); const [otpMsgId, setOtpMsgId] = useState('');
  const [otpInput, setOtpInput] = useState('');

  useEffect(() => {
    if (!userProfile) return;
    const a = userProfile.address || {} as any;
    setAddr({ street: a.street || '', suburb: a.suburb || '', city: a.city || '', province: a.province || '', postalCode: a.postalCode || '' });
    const p: Record<string, string> = {};
    if (userProfile.idNumber) p.idNumber = userProfile.idNumber;
    if (userProfile.firstName) p.firstName = userProfile.firstName;
    if (userProfile.lastName) p.surname = userProfile.lastName;
    if (userProfile.phoneNumber) p.phone = userProfile.phoneNumber;
    if (userProfile.maritalStatus) p.maritalStatus = userProfile.maritalStatus;
    if (Object.keys(p).length) setData(x => ({ ...x, ...p }));
  }, [userProfile]);

  const scroll = useCallback(() => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 150), []);
  const addBot = useCallback((text: string) => { setIsTyping(true); setTimeout(() => { setIsTyping(false); setMessages(p => [...p, { id: `b-${Date.now()}-${Math.random()}`, from: 'bot', text }]); scroll(); }, 500 + Math.random() * 300); }, [scroll]);
  const addUser = useCallback((text: string) => { setMessages(p => [...p, { id: `u-${Date.now()}`, from: 'user', text }]); scroll(); }, [scroll]);

  const progressTo = useCallback((step: StepKey, extra?: Record<string, string>) => {
    const m = { ...data, ...extra };
    if (extra) setData(x => ({ ...x, ...extra }));
    setCurrentStep(step);
    switch (step) {
      case 'id_number':
        if (idV && m.idNumber) {
          const di = extractDobFromId(m.idNumber), g = extractGenderFromId(m.idNumber);
          addBot(`Verified ✅\n🆔 ${m.idNumber}\n📅 ${di?.dob || ''} • Age: ${di?.age || ''}\n♀♂ ${g || ''}`);
          setTimeout(() => progressTo('title'), 1200);
        } else addBot("Let's start! Your <b>13-digit SA ID</b>. 🆔");
        break;
      case 'title': addBot("Title?"); break;
      case 'first_name':
        if (idV && m.firstName) { addBot(`Name: <b>${m.firstName}</b> ✅`); setTimeout(() => progressTo('surname'), 800); }
        else addBot("First name?"); break;
      case 'surname':
        if (idV && m.surname) { addBot(`Surname: <b>${m.surname}</b> ✅`); setTimeout(() => progressTo('phone'), 800); }
        else addBot("Surname?"); break;
      case 'phone':
        if (m.phone) { addBot(`Phone: <b>${m.phone}</b> ✅`); setTimeout(() => progressTo('marital_status'), 800); }
        else addBot("Cell number? 📱"); break;
      case 'marital_status': addBot("Marital status?"); break;
      case 'retirement_age': addBot("What age would you like to retire? 🎯"); break;
      case 'contribution_type': addBot("How would you like to contribute? 💰"); break;
      case 'frequency': addBot("How often? 📅"); break;
      case 'amount': {
        const freq = CONTRIBUTION_FREQUENCY_OPTIONS.find(f => f.id === (m.frequency || 'monthly'))?.label || 'monthly';
        addBot(`${freq} contribution amount? (R)\n\n💡 RA contributions are tax-deductible up to 27.5% of taxable income (max R350k/year).`);
        break;
      }
      case 'escalation_type': addBot("Annual escalation preference?"); break;
      case 'escalation_pct': addBot("Escalation percentage? (e.g. 5, 10)"); break;
      case 'escalation_month': addBot("Which month should escalation apply?"); break;
      case 'start_date': {
        const nm = new Date(); nm.setMonth(nm.getMonth() + 1); nm.setDate(1);
        const def = `${MONTHS[nm.getMonth()]} ${nm.getFullYear()}`;
        addBot(`When should your first contribution start?\n\nSuggested: <b>${def}</b>\n\nType a date or press Continue.`);
        break;
      }
      case 'confirm_address': {
        const as = [addr.street, addr.suburb, addr.city, addr.province, addr.postalCode].filter(Boolean).join(', ');
        addBot(as ? `Address on file:\n📍 ${as}\n\nEdit if needed.` : 'Enter your address. 🏡');
        break;
      }
      case 'review_summary': {
        const freq = CONTRIBUTION_FREQUENCY_OPTIONS.find(f => f.id === m.frequency)?.label || m.frequency;
        const esc = ESCALATION_TYPE_OPTIONS.find(e => e.id === m.escalationType)?.label || 'None';
        const as = [addr.street, addr.suburb, addr.city, addr.province, addr.postalCode].filter(Boolean).join(', ');
        addBot(`📋 Summary\n\n<b>Personal</b>\n  👤 ${m.title || ''} ${m.firstName || ''} ${m.surname || ''}\n  🆔 ${m.idNumber || ''}\n  📱 ${m.phone || ''}\n  💍 ${m.maritalStatus || ''}\n\n<b>Retirement Plan</b>\n  🎯 Retire at ${m.retirementAge || '65'}\n  💰 R ${Number(m.amount || 0).toLocaleString()} ${freq}\n  📈 ${esc}${m.escalationPct ? ' — ' + m.escalationPct + '%' : ''}${m.escalationMonth ? ' from ' + m.escalationMonth : ''}\n  📅 Start: ${m.startDate || 'Next month'}\n\n<b>Address</b>\n  📍 ${as}`);
        break;
      }
      case 'consent_step': addBot("Accept consents and sign with OTP. 📝"); break;
      case 'otp_step': addBot("Enter 6-digit code sent to WhatsApp. 🔐"); break;
      case 'done': break;
    }
  }, [data, addBot, addr, idV]);

  const handleAvatarSelect = useCallback((av: AvatarProfile) => {
    setSelectedAvatar(av); setAvatarChosen(true);
    addBot(`Hey ${firstName}! I'm <b>${av.name}</b> 📈 Let's set up your Retirement Annuity — your future self will thank you!`);
    setTimeout(() => progressTo('id_number'), 1500);
  }, [addBot, firstName, progressTo]);

  const handleButtonClick = useCallback((optId: string, label: string, field?: string) => {
    addUser(label);
    if (field === 'title') { progressTo('first_name', { title: optId }); return; }
    if (field === 'maritalStatus') { progressTo('retirement_age', { maritalStatus: optId }); return; }
    if (field === 'retirementAge') { progressTo('contribution_type', { retirementAge: optId }); return; }
    if (field === 'contributionType') { progressTo('frequency', { contributionType: optId }); return; }
    if (field === 'frequency') { progressTo('amount', { frequency: optId }); return; }
    if (field === 'escalationType') {
      if (optId === 'none') progressTo('start_date', { escalationType: optId });
      else if (optId === 'cpi') progressTo('escalation_month', { escalationType: optId });
      else progressTo('escalation_pct', { escalationType: optId });
      return;
    }
    if (field === 'escalationMonth') { progressTo('start_date', { escalationMonth: optId }); return; }
    if (field === 'startDateConfirm') {
      const nm = new Date(); nm.setMonth(nm.getMonth() + 1); nm.setDate(1);
      progressTo('confirm_address', { startDate: `${MONTHS[nm.getMonth()]} ${nm.getFullYear()}` });
      return;
    }
  }, [addUser, progressTo]);

  const handleTextSubmit = useCallback(() => {
    const v = inputText.trim(); if (!v) return; addUser(v); setInputText('');
    if (currentStep === 'id_number') {
      const c = v.replace(/\D/g, '');
      if (!isValidSAID(c)) { addBot("Invalid ID."); return; }
      const di = extractDobFromId(c), g = extractGenderFromId(c);
      addBot(`✅ ${di?.dob || ''} • Age: ${di?.age || ''} • ${g || ''}`);
      setTimeout(() => progressTo('title', { idNumber: c, dob: di?.dob || '', age: String(di?.age || ''), gender: g || '' }), 1200);
      return;
    }
    if (currentStep === 'first_name') { progressTo('surname', { firstName: v }); return; }
    if (currentStep === 'surname') { progressTo('phone', { surname: v }); return; }
    if (currentStep === 'phone') { progressTo('marital_status', { phone: v }); return; }
    if (currentStep === 'amount') {
      const n = v.replace(/[^\d.]/g, '');
      if (!n || isNaN(Number(n))) { addBot("Enter a valid amount."); return; }
      addBot(`✅ R ${Number(n).toLocaleString()} per ${CONTRIBUTION_FREQUENCY_OPTIONS.find(f => f.id === (data.frequency || 'monthly'))?.label || 'month'}`);
      setTimeout(() => progressTo('escalation_type', { amount: n }), 800);
      return;
    }
    if (currentStep === 'escalation_pct') {
      const n = v.replace(/[^\d.]/g, '');
      if (!n) { addBot("Enter a percentage."); return; }
      progressTo('escalation_month', { escalationPct: n });
      return;
    }
    if (currentStep === 'start_date') {
      progressTo('confirm_address', { startDate: v });
      return;
    }
  }, [inputText, currentStep, addUser, addBot, progressTo, data]);

  const handleAddressConfirm = useCallback(() => {
    if (!addr.street || !addr.city || !addr.province || !addr.postalCode) { setError('Fill required fields.'); return; }
    setError(''); addUser(`Address: ${[addr.street, addr.suburb, addr.city, addr.province, addr.postalCode].filter(Boolean).join(', ')}`);
    progressTo('review_summary');
  }, [addr, addUser, progressTo]);

  const handleProceed = useCallback(() => { addUser("Confirmed ✅"); progressTo('consent_step'); }, [addUser, progressTo]);

  const ph = userProfile?.phoneNumber || userProfile?.whatsappNumber || data.phone || '';
  const mPh = ph ? ph.slice(0, 3) + '****' + ph.slice(-3) : '';

  const handleSendOtp = useCallback(async () => {
    setIsLoading(true); setError('');
    try {
      const r = await sendWhatsAppOtp(normalizePhone(ph), 'retirement_annuity_authorization' as OtpPurpose);
      if (r.otpId || r.success) { setOtpId(r.otpId); if (r.message) setOtpMsgId(r.message); progressTo('otp_step'); }
      else setError(r.message || 'Failed');
    } catch { setError('Failed.'); } finally { setIsLoading(false); }
  }, [ph, progressTo]);

  const handleVerifyOtp = useCallback(async () => {
    if (otpInput.length !== 6) return;
    setIsLoading(true); setError('');
    try {
      const r = await verifyWhatsAppOtp(otpId, otpInput);
      if (r.verified) { addUser("OTP verified ✅"); await handleSubmit(otpInput); }
      else setError(r.message || 'Invalid.');
    } catch { setError('Failed.'); } finally { setIsLoading(false); }
  }, [otpId, otpInput]);

  const handleSubmit = useCallback(async (otp?: string) => {
    if (!user || !userProfile) return;
    setIsLoading(true); setError(''); setCurrentStep('submitting'); addBot("Submitting... 🚀");
    try {
      const uid = user.uid, now = new Date().toISOString();
      const pN = data.firstName || '', pS = data.surname || '', full = `${pN} ${pS}`.trim();
      const phone = normalizePhone(data.phone || userProfile.phoneNumber || '');
      const idN = data.idNumber || '', di = extractDobFromId(idN), g = extractGenderFromId(idN);
      const { registrationType, referrerCode, referredBy } = getReferralInfo(userProfile as unknown as Record<string, unknown>);
      const freq = CONTRIBUTION_FREQUENCY_OPTIONS.find(f => f.id === data.frequency)?.label || data.frequency;
      const esc = ESCALATION_TYPE_OPTIONS.find(e => e.id === data.escalationType)?.label || 'None';

      const appData = {
        title: data.title || '', firstName: pN, surname: pS, idNumber: idN,
        dateOfBirth: di?.dob || null, gender: g || null, age: di?.age ?? null,
        cellphone: phone, email: userProfile.email || '', maritalStatus: data.maritalStatus || '',
        retirementAge: data.retirementAge ? Number(data.retirementAge) : 65,
        contributionType: data.contributionType || 'debit_order',
        contributionFrequency: data.frequency || 'monthly', contributionFrequencyLabel: freq,
        contributionAmount: data.amount ? Number(data.amount) : 0,
        escalationType: data.escalationType || 'none', escalationTypeLabel: esc,
        escalationPercentage: data.escalationPct ? Number(data.escalationPct) : null,
        escalationMonth: data.escalationMonth || null,
        startDate: data.startDate || null,
        address: { streetAddress: addr.street, suburb: addr.suburb, townOrCity: addr.city, province: addr.province, postalCode: addr.postalCode },
        preferredCommsMethod: 'whatsapp',
        status: 'application_submitted', applicationSubmittedAt: now, createdAt: now, updatedAt: now,
      };

      await updateUserProfile({ idNumber: idN, firstName: pN, lastName: pS, fullName: full, maritalStatus: data.maritalStatus, applicationSubmittedAt: now, updatedAt: now } as any);

      const cR = doc(collection(db, 'profiles', uid, 'consents'));
      await setDoc(cR, { consentId: cR.id, consentType: 'retirement_annuity_authorization', fullName: full, surname: pS, idNumber: idN, clientPhone: phone, popiaConsent: true, whatsAppContactConsent: true, otpVerified: true, otpCode: otpId, otpVerifiedAt: now, consentGrantedAt: now, messageId: otpMsgId || null, purpose: 'Retirement Annuity Authorization', status: 'active', channel: 'chat_mode', createdAt: now });

      await submitProductApplication({ uid, productType: 'retirement_annuity', productName: 'Retirement Annuity', productDescription: `RA — R${Number(data.amount || 0).toLocaleString()} ${freq}`, status: 'applied', statusLabel: 'Application Submitted', applicationData: appData as unknown as Record<string, unknown>, consent: { consentId: cR.id, consentType: 'retirement_annuity_authorization', otpVerified: true, otpCode: otpId, otpMessageId: otpMsgId || null, otpVerifiedAt: now, consentGrantedAt: now, messageId: otpMsgId || null }, reference: `RA-${uid.slice(0, 6)}-${cR.id}`, idNumber: idN, waId: userProfile.waId || null, email: userProfile.email, clientName: full, amount: data.amount ? Number(data.amount) : 0, registrationType, referrerCode, referredBy });

      setCurrentStep('done');
      addBot(`🎉 Submitted!\n\nRef: RA-${uid.slice(0, 6)}-${cR.id}\n📈 R ${Number(data.amount || 0).toLocaleString()} ${freq}\n🎯 Retire at ${data.retirementAge || '65'}\n\nA consultant will be in touch. Track in "My Products".`);
    } catch (e) { console.error('[RA]', e); setError('Failed.'); setCurrentStep('consent_step'); }
    finally { setIsLoading(false); }
  }, [user, userProfile, data, addr, otpId, otpMsgId, addBot, updateUserProfile]);

  const textSteps: StepKey[] = ['id_number', 'first_name', 'surname', 'phone', 'amount', 'escalation_pct', 'start_date'];
  const showTextInput = textSteps.includes(currentStep);

  const buttonConfigs: Partial<Record<StepKey, { options: { id: string; label: string; icon?: string }[]; field: string }>> = {
    title: { options: TITLE_OPTIONS.map(t => ({ id: t, label: t })), field: 'title' },
    marital_status: { options: MARITAL_STATUS_OPTIONS.map(x => ({ id: x, label: x })), field: 'maritalStatus' },
    retirement_age: { options: RET_AGES.map(a => ({ id: a, label: `${a} years` })), field: 'retirementAge' },
    contribution_type: { options: CONTRIB_TYPES, field: 'contributionType' },
    frequency: { options: CONTRIBUTION_FREQUENCY_OPTIONS.map(f => ({ id: f.id, label: f.label })), field: 'frequency' },
    escalation_type: { options: ESCALATION_TYPE_OPTIONS.map(e => ({ id: e.id, label: e.label })), field: 'escalationType' },
    escalation_month: { options: MONTHS.map(m => ({ id: m, label: m })), field: 'escalationMonth' },
    start_date: { options: [{ id: 'next', label: 'Continue with suggested date', icon: '✅' }], field: 'startDateConfirm' },
  };
  const currentButtons = buttonConfigs[currentStep];

  return (
    <ProfileGuard>
      <SafeAreaView style={styles.container} edges={['top']}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          {!avatarChosen && (
            <ScrollView contentContainerStyle={styles.avatarScroll}>
              <View style={styles.avatarCard}>
                <View style={styles.avatarBadge}><Ionicons name="trending-up" size={13} color={AC} /><Text style={styles.avatarBadgeText}>Retirement Annuity — Chat Mode</Text></View>
                <Text style={styles.avatarTitle}>Choose Your Assistant</Text>
                <Text style={styles.avatarSubtitle}>Pick who you'd like to guide you through your RA application.</Text>
                <View style={styles.avatarGrid}>
                  {AVATARS.map((av) => (
                    <TouchableOpacity key={av.id} style={styles.avatarOption} onPress={() => handleAvatarSelect(av)} activeOpacity={0.7}>
                      <AvatarImage avatar={av} size={52} />
                      <Text style={styles.avatarName}>{av.name}</Text>
                      <Text style={styles.avatarGender}>{av.gender} Digital Assistant</Text>
                      <Text style={styles.avatarPersonality}>{av.personality}</Text>
                      <View style={styles.avatarCta}><Text style={styles.avatarCtaText}>Chat with {av.name}</Text></View>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </ScrollView>
          )}

          {avatarChosen && (
            <View style={styles.chatWrap}>
              <View style={styles.chatHeader}>
                <AvatarImage avatar={selectedAvatar} size={34} />
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={styles.headerName}>{selectedAvatar.name}</Text>
                    <View style={styles.aiBadge}><Text style={styles.aiBadgeText}>AI</Text></View>
                    <View style={styles.onlineDot} />
                  </View>
                  <Text style={styles.headerSub}>Retirement Annuity — Application</Text>
                </View>
                <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="close" size={22} color="rgba(255,255,255,0.7)" />
                </TouchableOpacity>
              </View>

              <View style={styles.disclaimerBar}><Ionicons name="information-circle" size={12} color="#d97706" /><Text style={styles.disclaimerText}>{selectedAvatar.name} is an AI assistant — does not provide financial advice.</Text></View>

              <ScrollView ref={scrollRef} style={styles.msgScroll} contentContainerStyle={styles.msgScrollContent} showsVerticalScrollIndicator={false}>
                {messages.map((msg) => (
                  <View key={msg.id} style={[styles.msgRow, msg.from === 'user' ? styles.msgRowUser : styles.msgRowBot]}>
                    {msg.from === 'bot' && <AvatarImage avatar={selectedAvatar} size={24} />}
                    <View style={msg.from === 'bot' ? styles.bubbleBot : styles.bubbleUser}><BoldText text={msg.text} /></View>
                  </View>
                ))}
                {isTyping && (<View style={[styles.msgRow, styles.msgRowBot]}><AvatarImage avatar={selectedAvatar} size={24} /><View style={styles.bubbleBot}><Text style={styles.typingDots}>• • •</Text></View></View>)}

                {currentButtons && (
                  <View style={styles.buttonsWrap}>
                    {currentButtons.options.map((o) => (
                      <TouchableOpacity key={o.id} style={styles.optionBtn} onPress={() => handleButtonClick(o.id, o.label, currentButtons.field)} activeOpacity={0.7}>
                        {o.icon ? <Text style={styles.optionIcon}>{o.icon}</Text> : null}
                        <Text style={styles.optionLabel}>{o.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                {currentStep === 'confirm_address' && (
                  <View style={styles.inlineCard}>
                    <Text style={styles.inlineTitle}>📍 Address</Text>
                    <TextInput style={styles.inlineInput} placeholder="Street *" value={addr.street} onChangeText={v => setAddr({ ...addr, street: v })} />
                    <TextInput style={styles.inlineInput} placeholder="Suburb" value={addr.suburb} onChangeText={v => setAddr({ ...addr, suburb: v })} />
                    <TextInput style={styles.inlineInput} placeholder="City *" value={addr.city} onChangeText={v => setAddr({ ...addr, city: v })} />
                    <TextInput style={styles.inlineInput} placeholder="Province *" value={addr.province} onChangeText={v => setAddr({ ...addr, province: v })} />
                    <TextInput style={styles.inlineInput} placeholder="Postal Code *" value={addr.postalCode} onChangeText={v => setAddr({ ...addr, postalCode: v.replace(/\D/g, '') })} maxLength={4} keyboardType="number-pad" />
                    {error ? <Text style={styles.errorText}>{error}</Text> : null}
                    <TouchableOpacity style={styles.confirmBtn} onPress={handleAddressConfirm}><Text style={styles.confirmBtnText}>Confirm</Text></TouchableOpacity>
                  </View>
                )}

                {currentStep === 'review_summary' && (
                  <View style={{ paddingHorizontal: 8, marginTop: 8, gap: 8 }}>
                    <TouchableOpacity style={styles.confirmBtn} onPress={handleProceed}><Text style={styles.confirmBtnText}>✅ Confirm & Proceed</Text></TouchableOpacity>
                  </View>
                )}

                {currentStep === 'consent_step' && (
                  <View style={styles.inlineCard}>
                    <Text style={styles.inlineTitle}>📝 Consent</Text>
                    <TouchableOpacity style={styles.checkRow} onPress={() => setPopiaConsent(!popiaConsent)}><Ionicons name={popiaConsent ? 'checkbox' : 'square-outline'} size={20} color={AC} /><Text style={styles.checkText}>I consent to POPIA processing.</Text></TouchableOpacity>
                    <TouchableOpacity style={styles.checkRow} onPress={() => setRaConsent(!raConsent)}><Ionicons name={raConsent ? 'checkbox' : 'square-outline'} size={20} color={AC} /><Text style={styles.checkText}>I authorise RA application processing.</Text></TouchableOpacity>
                    {mPh ? <Text style={{ fontSize: 12, color: '#6b7280', marginTop: 8 }}>Code sent to {mPh}</Text> : null}
                    {error ? <Text style={styles.errorText}>{error}</Text> : null}
                    <TouchableOpacity style={[styles.confirmBtn, !(popiaConsent && raConsent) && { opacity: 0.5 }]} onPress={handleSendOtp} disabled={!(popiaConsent && raConsent) || isLoading}>
                      {isLoading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.confirmBtnText}>Send OTP</Text>}
                    </TouchableOpacity>
                  </View>
                )}

                {currentStep === 'otp_step' && (
                  <View style={styles.inlineCard}>
                    <Text style={styles.inlineTitle}>🔐 Enter Code</Text>
                    <TextInput style={[styles.inlineInput, { textAlign: 'center', letterSpacing: 8, fontSize: 20, fontWeight: '700' }]} value={otpInput} onChangeText={v => setOtpInput(v.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" maxLength={6} placeholder="000000" />
                    {error ? <Text style={styles.errorText}>{error}</Text> : null}
                    <TouchableOpacity style={[styles.confirmBtn, otpInput.length !== 6 && { opacity: 0.5 }]} onPress={handleVerifyOtp} disabled={otpInput.length !== 6 || isLoading}>
                      {isLoading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.confirmBtnText}>Verify & Submit</Text>}
                    </TouchableOpacity>
                  </View>
                )}

                {currentStep === 'done' && (
                  <View style={{ paddingHorizontal: 8, marginTop: 12, gap: 8 }}>
                    <TouchableOpacity style={styles.confirmBtn} onPress={() => router.replace('/(tabs)')}><Text style={styles.confirmBtnText}>📋 View My Products</Text></TouchableOpacity>
                    <TouchableOpacity style={[styles.confirmBtn, { backgroundColor: '#fff', borderWidth: 1.5, borderColor: AC }]} onPress={() => router.replace('/(tabs)')}><Text style={[styles.confirmBtnText, { color: AC }]}>Dashboard</Text></TouchableOpacity>
                  </View>
                )}

                {currentStep === 'submitting' && (<View style={{ alignItems: 'center', padding: 20 }}><ActivityIndicator size="large" color={AC} /><Text style={{ marginTop: 12, color: '#6b7280' }}>Processing...</Text></View>)}
              </ScrollView>

              {showTextInput && (
                <View style={styles.inputBar}>
                  <TextInput style={styles.textInput} value={inputText} onChangeText={setInputText} placeholder="Type your answer..." onSubmitEditing={handleTextSubmit} returnKeyType="send" keyboardType={['id_number', 'phone', 'amount', 'escalation_pct'].includes(currentStep) ? 'number-pad' : 'default'} />
                  <TouchableOpacity style={[styles.sendBtn, !inputText.trim() && { opacity: 0.4 }]} onPress={handleTextSubmit} disabled={!inputText.trim()}><Ionicons name="send" size={18} color="#fff" /></TouchableOpacity>
                </View>
              )}
            </View>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ProfileGuard>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  avatarScroll: { flexGrow: 1, justifyContent: 'center', padding: 20 },
  avatarCard: { backgroundColor: '#fff', borderRadius: 16, padding: 24, borderWidth: 1, borderColor: '#e5e7eb' },
  avatarBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'center', backgroundColor: ACBG, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12, marginBottom: 12 },
  avatarBadgeText: { fontSize: 11, fontWeight: '600', color: ACD },
  avatarTitle: { fontSize: 20, fontWeight: '800', color: '#111827', textAlign: 'center', marginBottom: 4 },
  avatarSubtitle: { fontSize: 13, color: '#6b7280', textAlign: 'center', marginBottom: 20 },
  avatarGrid: { flexDirection: 'row', gap: 12 },
  avatarOption: { flex: 1, alignItems: 'center', padding: 16, borderRadius: 14, borderWidth: 2, borderColor: '#e5e7eb', backgroundColor: '#fff', gap: 6 },
  avatarName: { fontSize: 15, fontWeight: '700', color: '#111827' },
  avatarGender: { fontSize: 10, color: '#9ca3af' },
  avatarPersonality: { fontSize: 11, color: '#6b7280', textAlign: 'center' },
  avatarCta: { paddingHorizontal: 14, paddingVertical: 5, borderRadius: 8, backgroundColor: AC },
  avatarCtaText: { color: '#fff', fontWeight: '600', fontSize: 11 },
  chatWrap: { flex: 1, backgroundColor: '#fff', borderRadius: 12, margin: 4, borderWidth: 1, borderColor: '#d1d5db', overflow: 'hidden' },
  chatHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: ACD },
  headerName: { fontWeight: '700', fontSize: 14, color: '#fff' },
  aiBadge: { backgroundColor: 'rgba(255,255,255,0.25)', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 6 },
  aiBadgeText: { fontSize: 8, fontWeight: '600', color: '#fff' },
  onlineDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#4ade80' },
  headerSub: { fontSize: 10, color: 'rgba(255,255,255,0.85)' },
  disclaimerBar: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 14, paddingVertical: 4, backgroundColor: '#fffbeb', borderBottomWidth: 1, borderBottomColor: '#fde68a', justifyContent: 'center' },
  disclaimerText: { fontSize: 9, color: '#92400e' },
  msgScroll: { flex: 1, backgroundColor: '#f0f2f5' },
  msgScrollContent: { padding: 14, paddingBottom: 20 },
  msgRow: { flexDirection: 'row', marginBottom: 10, gap: 6 },
  msgRowBot: { justifyContent: 'flex-start', alignItems: 'flex-start' },
  msgRowUser: { justifyContent: 'flex-end' },
  bubbleBot: { backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 2, borderTopRightRadius: 12, borderBottomLeftRadius: 12, borderBottomRightRadius: 12, maxWidth: '80%', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 2, elevation: 1 },
  bubbleUser: { backgroundColor: '#d1fae5', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderBottomRightRadius: 2, maxWidth: '75%' },
  msgText: { fontSize: 14, lineHeight: 20, color: '#111827' },
  typingDots: { fontSize: 16, color: '#9ca3af', letterSpacing: 2 },
  buttonsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 4, marginTop: 6 },
  optionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, borderWidth: 1.5, borderColor: '#a7f3d0', backgroundColor: ACBG },
  optionIcon: { fontSize: 14 },
  optionLabel: { fontSize: 13, fontWeight: '500', color: '#111827' },
  inlineCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#e5e7eb', marginTop: 8, marginHorizontal: 4 },
  inlineTitle: { fontSize: 14, fontWeight: '700', color: '#111827', marginBottom: 12 },
  inlineInput: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, marginBottom: 8, backgroundColor: '#fafbfc' },
  confirmBtn: { backgroundColor: ACD, paddingVertical: 12, paddingHorizontal: 20, borderRadius: 10, alignItems: 'center', marginTop: 4 },
  confirmBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  errorText: { color: '#ef4444', fontSize: 12, marginTop: 4, marginBottom: 4 },
  checkRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 10 },
  checkText: { flex: 1, fontSize: 13, color: '#374151', lineHeight: 18 },
  inputBar: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#f3f4f6', backgroundColor: '#fff' },
  textInput: { flex: 1, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, fontSize: 14, backgroundColor: '#fafbfc' },
  sendBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: ACD, justifyContent: 'center', alignItems: 'center' },
});
