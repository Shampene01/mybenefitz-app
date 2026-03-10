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
  generateClientId,
  CONSENT_FORM_URL,
  SA_PROVINCES,
  TITLE_OPTIONS,
  MARITAL_STATUS_OPTIONS,
  QUALIFICATION_OPTIONS,
} from '../lib/productUtils';
import type { OtpPurpose } from '../lib/productUtils';

// ── Constants ────────────────────────────────────────────────────────────
const ACCENT = '#2563eb';
const ACCENT_BG = '#eff6ff';

interface ChatMessage {
  id: string;
  from: 'bot' | 'user';
  text: string;
  inputType?: 'buttons' | 'text' | 'none';
  options?: { id: string; label: string; icon?: string }[];
  placeholder?: string;
  field?: string;
}

interface AvatarProfile {
  id: string; name: string; gender: string; personality: string;
}

const AVATARS: AvatarProfile[] = [
  { id: 'tshepo', name: 'Tshepo', gender: 'Male', personality: 'Warm, confident and straight-talking.' },
  { id: 'palesa', name: 'Palesa', gender: 'Female', personality: 'Caring, detail-oriented and reassuring.' },
];

type StepKey =
  | 'choose_avatar' | 'greeting'
  | 'id_number' | 'title' | 'first_name' | 'surname' | 'marital_status'
  | 'qualification' | 'occupation' | 'hazardous_occupation' | 'monthly_income' | 'spouse_income' | 'smoker'
  | 'confirm_address'
  | 'review_summary' | 'consent_step' | 'otp_step' | 'submitting' | 'done';

const QUALIFICATION_BUTTONS = QUALIFICATION_OPTIONS.map((q) => ({ id: q.id, label: q.label }));

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

function AvatarCircle({ avatar, size = 30 }: { avatar: AvatarProfile; size?: number }) {
  const bg = avatar.id === 'tshepo' ? '#1d4ed8' : '#a78bfa';
  return (
    <View style={{ width: size, height: size, borderRadius: size * 0.3, backgroundColor: bg, justifyContent: 'center', alignItems: 'center' }}>
      <Text style={{ color: '#fff', fontWeight: '700', fontSize: size * 0.42 }}>{avatar.name[0]}</Text>
    </View>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════════════
export default function LifeInsuranceApplyScreen() {
  const router = useRouter();
  const { user, userProfile, updateUserProfile, isHomeAffairsVerified } = useAuth();
  const idVerified = isHomeAffairsVerified;
  const firstName = userProfile?.displayName?.split(' ')[0] || userProfile?.firstName || 'there';

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentStep, setCurrentStep] = useState<StepKey>('choose_avatar');
  const [textInput, setTextInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const [data, setData] = useState<Record<string, string>>({});
  const [selectedAvatar, setSelectedAvatar] = useState<AvatarProfile>(AVATARS[0]);
  const [avatarChosen, setAvatarChosen] = useState(false);
  const [pendingStep, setPendingStep] = useState<{ step: StepKey; extra?: Record<string, string> } | null>(null);

  // Address
  const [saleAddress, setSaleAddress] = useState({ street: '', suburb: '', city: '', province: '', postalCode: '' });

  // Consent & OTP
  const [popiaConsent, setPopiaConsent] = useState(false);
  const [insuranceConsent, setInsuranceConsent] = useState(false);
  const [otpId, setOtpId] = useState('');
  const [otpInput, setOtpInput] = useState(['', '', '', '', '', '']);
  const otpRefs = useRef<(TextInput | null)[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Pre-fill from profile
  useEffect(() => {
    if (!userProfile) return;
    const addr = (userProfile.address || {}) as Record<string, string | undefined>;
    setSaleAddress({
      street: addr.street || '', suburb: addr.suburb || '',
      city: addr.city || '', province: addr.province || '', postalCode: addr.postalCode || '',
    });
    const prefill: Record<string, string> = {};
    if (userProfile.idNumber) prefill.idNumber = userProfile.idNumber;
    if (userProfile.title) prefill.title = userProfile.title;
    if (userProfile.firstName) prefill.firstName = userProfile.firstName;
    if (userProfile.lastName) prefill.surname = userProfile.lastName;
    if (userProfile.maritalStatus) prefill.maritalStatus = userProfile.maritalStatus;
    if (userProfile.highestQualification) prefill.qualification = userProfile.highestQualification;
    if (userProfile.occupation) prefill.occupation = userProfile.occupation;
    if (userProfile.income?.grossSalary) prefill.monthlyIncome = String(userProfile.income.grossSalary);
    if (Object.keys(prefill).length > 0) setData((d) => ({ ...d, ...prefill }));
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
    }, 500 + Math.random() * 300);
  }, [scrollToBottom]);

  const addUserMessage = useCallback((text: string) => {
    setMessages((m) => [...m, { id: `u-${Date.now()}`, from: 'user', text }]);
    scrollToBottom();
  }, [scrollToBottom]);

  // ── Pending step effect ─────────────────────────────────────────────
  useEffect(() => {
    if (!pendingStep) return;
    const { step, extra } = pendingStep;
    setPendingStep(null);
    progressTo(step, extra);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingStep]);

  // ── Avatar selection ────────────────────────────────────────────────
  const handleAvatarSelect = useCallback((av: AvatarProfile) => {
    setSelectedAvatar(av);
    setAvatarChosen(true);
    setCurrentStep('greeting');
    const greeting = av.id === 'tshepo'
      ? `Hey ${firstName}! ❤️ I'm Tshepo — let's get you covered with the right life insurance, quickly and easily!`
      : `Hi ${firstName}! ❤️ I'm Palesa — I'll walk you through your life insurance application step by step. No pressure, just the right cover for you!`;
    addBotMessage(greeting, { inputType: 'none' });
    setTimeout(() => setPendingStep({ step: 'id_number' }), 1500);
  }, [addBotMessage, firstName]);

  // ── Step progression ────────────────────────────────────────────────
  const progressTo = useCallback((step: StepKey, extraData?: Record<string, string>) => {
    const merged = { ...data, ...extraData };
    if (extraData) setData((d) => ({ ...d, ...extraData }));
    setCurrentStep(step);

    switch (step) {
      case 'id_number':
        if (idVerified && merged.idNumber) {
          const di = extractDobFromId(merged.idNumber);
          const g = extractGenderFromId(merged.idNumber);
          addBotMessage(
            `I can see your identity has been verified ✅\n\n🆔 ID: ${merged.idNumber}\n📅 DOB: ${di?.dob || 'N/A'}\n👤 Gender: ${g || 'N/A'}\n\nLet's continue with a few more details.`,
            { inputType: 'none' },
          );
          setData((d) => ({ ...d, idNumber: merged.idNumber!, dob: di?.dob || '', age: String(di?.age || ''), gender: g || '' }));
          setTimeout(() => setPendingStep({ step: 'title' }), 1500);
        } else {
          addBotMessage("Let's start with your <b>SA ID Number</b>. This helps me extract your date of birth and gender automatically. 🆔", {
            inputType: 'text', placeholder: 'Enter your 13-digit SA ID number', field: 'idNumber',
          });
        }
        break;
      case 'title':
        addBotMessage("What's your title?", {
          inputType: 'buttons',
          options: TITLE_OPTIONS.map((t) => ({ id: t, label: t })),
          field: 'title',
        });
        break;
      case 'first_name':
        if (idVerified && merged.firstName) {
          addBotMessage(`I have your name on file as <b>${merged.firstName}</b>. ✅`, { inputType: 'none' });
          setTimeout(() => setPendingStep({ step: 'surname' }), 1000);
        } else {
          addBotMessage("What's your first name?", { inputType: 'text', placeholder: 'Your first name', field: 'firstName' });
        }
        break;
      case 'surname':
        if (idVerified && merged.surname) {
          addBotMessage(`And your surname is <b>${merged.surname}</b>. ✅`, { inputType: 'none' });
          setTimeout(() => setPendingStep({ step: 'marital_status' }), 1000);
        } else {
          addBotMessage(`Great, ${merged.firstName || 'there'}! What's your surname?`, { inputType: 'text', placeholder: 'Your surname', field: 'surname' });
        }
        break;
      case 'marital_status':
        addBotMessage("What's your marital status?", {
          inputType: 'buttons',
          options: MARITAL_STATUS_OPTIONS.map((s) => ({ id: s, label: s })),
          field: 'maritalStatus',
        });
        break;
      case 'qualification':
        addBotMessage("Now a few lifestyle questions to help us find the best cover.\n\nWhat's your <b>highest qualification</b>? 🎓", {
          inputType: 'buttons', options: QUALIFICATION_BUTTONS, field: 'qualification',
        });
        break;
      case 'occupation':
        addBotMessage("What do you do for a living? 💼", { inputType: 'text', placeholder: 'e.g. Software Developer, Teacher, Nurse...', field: 'occupation' });
        break;
      case 'hazardous_occupation':
        addBotMessage("Is your occupation considered hazardous? (e.g. mining, construction at height, working with explosives)", {
          inputType: 'buttons',
          options: [{ id: 'no', label: 'No', icon: '✅' }, { id: 'yes', label: 'Yes', icon: '⚠️' }],
          field: 'hazardousOccupation',
        });
        break;
      case 'monthly_income':
        addBotMessage("What's your <b>monthly gross income</b>? 💰\n\nThis helps us recommend appropriate cover levels.", {
          inputType: 'text', placeholder: 'e.g. 25000', field: 'monthlyIncome',
        });
        break;
      case 'spouse_income':
        addBotMessage("Does your spouse earn an income? If so, what's their monthly gross income? If not, just type <b>0</b> or <b>skip</b>.", {
          inputType: 'text', placeholder: 'e.g. 15000 or skip', field: 'spouseIncome',
        });
        break;
      case 'smoker':
        addBotMessage("Last lifestyle question — have you smoked in the last 12 months? 🚬", {
          inputType: 'buttons',
          options: [{ id: 'no', label: "No, I haven't", icon: '✅' }, { id: 'yes', label: 'Yes, I have', icon: '🚬' }],
          field: 'isSmoker',
        });
        break;
      case 'confirm_address': {
        const addr = saleAddress;
        const addrStr = [addr.street, addr.suburb, addr.city, addr.province, addr.postalCode].filter(Boolean).join(', ');
        addBotMessage(
          addrStr
            ? `Almost done! 🏡 Let me confirm the residential address we have on file:\n\n📍 ${addrStr}\n\nIs this correct? You can edit it below if needed.`
            : "I need your residential address. Please fill it in below. 🏡",
          { inputType: 'none' },
        );
        break;
      }
      case 'review_summary': {
        const allData = { ...data, ...extraData };
        const qualLabel = QUALIFICATION_OPTIONS.find((q) => q.id === allData.qualification)?.label || allData.qualification;
        const addr = saleAddress;
        const addrStr = [addr.street, addr.suburb, addr.city, addr.province, addr.postalCode].filter(Boolean).join(', ');
        const income = allData.monthlyIncome ? `R ${Number(allData.monthlyIncome).toLocaleString()}` : 'Not provided';
        const spouseInc = allData.spouseIncome && allData.spouseIncome !== '0' && allData.spouseIncome.toLowerCase() !== 'skip'
          ? `R ${Number(allData.spouseIncome).toLocaleString()}` : 'N/A';
        addBotMessage(
          `Here's a summary of your application, ${allData.firstName || firstName}! 📋\n\n` +
          `<b>Personal Details</b>\n` +
          `  👤 ${allData.title || ''} ${allData.firstName || ''} ${allData.surname || ''}\n` +
          `  🆔 ID: ${allData.idNumber || ''}\n` +
          `  📅 DOB: ${allData.dob || 'N/A'} • Age: ${allData.age || 'N/A'}\n` +
          `  ♀♂ Gender: ${allData.gender || 'N/A'}\n` +
          `  💍 Marital Status: ${allData.maritalStatus || ''}\n\n` +
          `<b>Lifestyle & Employment</b>\n` +
          `  🎓 Qualification: ${qualLabel}\n` +
          `  💼 Occupation: ${allData.occupation || ''}\n` +
          `  ⚠️ Hazardous: ${allData.hazardousOccupation === 'yes' ? 'Yes' : 'No'}\n` +
          `  💰 Monthly Income: ${income}\n` +
          `  👫 Spouse Income: ${spouseInc}\n` +
          `  🚬 Smoker (12 mo.): ${allData.isSmoker === 'yes' ? 'Yes' : 'No'}\n\n` +
          `<b>Address</b>\n` +
          `  📍 ${addrStr}\n\n` +
          `This is a <b>free quote request</b> — no payment required. Our advisors will prepare personalised quotes based on your details.`,
          { inputType: 'none' },
        );
        break;
      }
      case 'consent_step':
        addBotMessage("Final step — please review and accept the required consents, then I'll send a verification code to your WhatsApp. 📝", { inputType: 'none' });
        break;
      case 'otp_step':
        addBotMessage("I've sent a 6-digit verification code to your WhatsApp. Please enter it below. 🔐", { inputType: 'none' });
        break;
      case 'done':
        break;
    }
  }, [data, addBotMessage, firstName, saleAddress, idVerified]);

  // ── Button clicks ───────────────────────────────────────────────────
  const handleButtonClick = useCallback((optionId: string, optionLabel: string, field?: string) => {
    addUserMessage(optionLabel);
    const update = field ? { [field]: optionId } : {};
    if (field === 'title') { progressTo('first_name', update); return; }
    if (field === 'maritalStatus') { progressTo('qualification', update); return; }
    if (field === 'qualification') { progressTo('occupation', update); return; }
    if (field === 'hazardousOccupation') { progressTo('monthly_income', update); return; }
    if (field === 'isSmoker') { progressTo('confirm_address', update); return; }
  }, [addUserMessage, progressTo]);

  // ── Text submit ─────────────────────────────────────────────────────
  const handleTextSubmit = useCallback(() => {
    const val = textInput.trim();
    if (!val) return;
    addUserMessage(val);
    setTextInput('');

    if (currentStep === 'id_number') {
      const cleaned = val.replace(/\D/g, '');
      if (!isValidSAID(cleaned)) {
        addBotMessage("That doesn't look like a valid 13-digit SA ID number. Please try again. 🆔", {
          inputType: 'text', placeholder: 'Enter your 13-digit SA ID number', field: 'idNumber',
        });
        return;
      }
      const di = extractDobFromId(cleaned);
      const g = extractGenderFromId(cleaned);
      addBotMessage(`Got it! ✅\n\n📅 Date of Birth: ${di?.dob || 'N/A'}\n🎂 Age: ${di?.age || 'N/A'}\n♀♂ Gender: ${g || 'N/A'}`, { inputType: 'none' });
      setTimeout(() => setPendingStep({ step: 'title', extra: { idNumber: cleaned, dob: di?.dob || '', age: String(di?.age || ''), gender: g || '' } }), 1200);
      return;
    }
    if (currentStep === 'first_name') { progressTo('surname', { firstName: val }); return; }
    if (currentStep === 'surname') { progressTo('marital_status', { surname: val }); return; }
    if (currentStep === 'occupation') { progressTo('hazardous_occupation', { occupation: val }); return; }
    if (currentStep === 'monthly_income') {
      const num = val.replace(/[^\d]/g, '');
      if (!num || isNaN(Number(num))) {
        addBotMessage("Please enter a valid income amount (numbers only).", { inputType: 'text', placeholder: 'e.g. 25000', field: 'monthlyIncome' });
        return;
      }
      progressTo('spouse_income', { monthlyIncome: num });
      return;
    }
    if (currentStep === 'spouse_income') {
      const lower = val.toLowerCase();
      const spouseVal = lower === 'skip' || lower === 'n/a' || lower === 'none' ? '0' : val.replace(/[^\d]/g, '');
      progressTo('smoker', { spouseIncome: spouseVal });
      return;
    }
  }, [textInput, currentStep, addUserMessage, addBotMessage, progressTo]);

  // ── Address confirm ─────────────────────────────────────────────────
  const handleAddressConfirm = useCallback(() => {
    if (!saleAddress.street || !saleAddress.city || !saleAddress.province || !saleAddress.postalCode) {
      setError('Please fill in all required address fields.'); return;
    }
    setError('');
    const addrStr = [saleAddress.street, saleAddress.suburb, saleAddress.city, saleAddress.province, saleAddress.postalCode].filter(Boolean).join(', ');
    addUserMessage(`Address confirmed: ${addrStr}`);
    progressTo('review_summary');
  }, [saleAddress, addUserMessage, progressTo]);

  // ── Review proceed ──────────────────────────────────────────────────
  const handleProceedToConsent = useCallback(() => {
    addUserMessage("Details confirmed ✅");
    progressTo('consent_step');
  }, [addUserMessage, progressTo]);

  // ── OTP & Consent ───────────────────────────────────────────────────
  const phoneForOtp = userProfile?.phoneNumber || userProfile?.whatsappNumber || '';
  const maskedPhone = phoneForOtp ? phoneForOtp.slice(0, 3) + '****' + phoneForOtp.slice(-3) : '';

  const handleSendOtp = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const normalized = normalizePhone(phoneForOtp);
      const result = await sendWhatsAppOtp(normalized, 'life_insurance_authorization' as OtpPurpose);
      if (result.otpId || result.success) {
        setOtpId(result.otpId);
        progressTo('otp_step');
      } else setError(result.message || 'Failed to send OTP');
    } catch { setError('Failed to send verification code.'); }
    finally { setLoading(false); }
  }, [phoneForOtp, progressTo]);

  const handleOtpChange = (i: number, v: string) => {
    if (!/^\d*$/.test(v)) return;
    const n = [...otpInput]; n[i] = v.slice(-1); setOtpInput(n);
    if (v && i < 5) otpRefs.current[i + 1]?.focus();
  };

  const handleVerifyOtp = useCallback(async () => {
    const code = otpInput.join('');
    if (code.length !== 6) return;
    setLoading(true); setError('');
    try {
      const result = await verifyWhatsAppOtp(otpId, code);
      if (result.verified) {
        addUserMessage("OTP verified ✅");
        await handleFinalSubmit(code);
      } else {
        const remaining = result.attemptsRemaining;
        setError(remaining !== undefined ? `${result.message} (${remaining} attempts remaining)` : result.message || 'Invalid OTP.');
      }
    } catch { setError('Verification failed.'); }
    finally { setLoading(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otpId, otpInput]);

  // ── Final submit ────────────────────────────────────────────────────
  const handleFinalSubmit = useCallback(async (enteredOtp?: string) => {
    if (!user || !userProfile) return;
    const otp = enteredOtp || otpInput.join('');
    setLoading(true); setError(''); setCurrentStep('submitting');
    addBotMessage("Submitting your life insurance application... 🚀", { inputType: 'none' });

    try {
      const uid = user.uid;
      const now = new Date().toISOString();
      const pName = data.firstName || userProfile.firstName || '';
      const pSurname = data.surname || userProfile.lastName || '';
      const fullName = `${pName} ${pSurname}`.trim();
      const phone = normalizePhone(userProfile.phoneNumber || userProfile.whatsappNumber || '');
      const idNum = data.idNumber || userProfile.idNumber || '';
      const ageNextBirthday = data.age ? parseInt(data.age) + 1 : null;
      const qualLabel = QUALIFICATION_OPTIONS.find((q) => q.id === data.qualification)?.label || data.qualification;

      const applicationData = {
        personal: {
          title: data.title || '', firstName: pName, surname: pSurname,
          idNumber: idNum, dateOfBirth: data.dob || '', ageNextBirthday,
          gender: data.gender || '', maritalStatus: data.maritalStatus || '',
        },
        lifestyle: {
          highestQualification: data.qualification || '', highestQualificationLabel: qualLabel,
          occupation: data.occupation || '', hazardousOccupation: data.hazardousOccupation === 'yes',
          monthlyIncome: data.monthlyIncome ? Number(data.monthlyIncome) : null,
          spouseMonthlyIncome: data.spouseIncome && data.spouseIncome !== '0' ? Number(data.spouseIncome) : null,
          smokerLast12Months: data.isSmoker === 'yes',
        },
        address: {
          streetAddress: saleAddress.street, suburb: saleAddress.suburb,
          townOrCity: saleAddress.city, province: saleAddress.province, postalCode: saleAddress.postalCode,
        },
        status: 'pending_authorization',
        channel: 'mobile_chat',
        assistant: selectedAvatar.id,
        createdAt: now, updatedAt: now,
      };

      // 1. Update profile
      await updateUserProfile({
        idNumber: idNum, firstName: pName, lastName: pSurname, fullName,
        title: data.title || undefined, maritalStatus: data.maritalStatus || undefined,
        occupation: data.occupation || undefined, highestQualification: data.qualification || undefined,
        applicationSubmittedAt: now, popiaConsent: true, popiaConsentTimestamp: now, updatedAt: now,
      } as Record<string, unknown>);

      // 2. Consent PDF (non-blocking)
      const clientId = generateClientId();
      let consentPdfResult: { consent_uid?: string; document_url?: string; document_hash?: string } = {};
      try {
        const pdfRes = await fetch(CONSENT_FORM_URL, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            client_id: clientId, wa_id: phone, id_number: idNum, full_name: fullName,
            cell_number: phone, otp_code: otp, otp_verified_at: now,
            message_id: `mobile-otp-${Date.now()}`,
            purpose: 'Life Insurance Authorization', form_type: 'life_insurance',
          }),
        });
        if (pdfRes.ok) consentPdfResult = await pdfRes.json();
      } catch { /* non-blocking */ }

      // 3. Save consent record
      const consentRef = doc(collection(db, 'profiles', uid, 'consents'));
      await setDoc(consentRef, {
        consentId: consentRef.id, consentType: 'life_insurance_authorization',
        fullName, surname: pSurname, idNumber: idNum, clientPhone: phone,
        popiaConsent: true, insuranceAuthorizationConsent: true,
        whatsAppContactConsent: false, otpVerified: true, otpCode: otpId,
        otpVerifiedAt: now, consentGrantedAt: now,
        purpose: 'Life Insurance Authorization',
        status: 'active', channel: 'mobile_chat', createdAt: now,
      });

      // 4. Write application
      const reference = `LI-${uid.slice(0, 6)}-${consentRef.id}`;
      const appRef = doc(collection(db, 'profiles', uid, 'applications'));
      await setDoc(appRef, {
        applicationId: appRef.id,
        productType: 'life_insurance', productName: 'Life Insurance',
        productDescription: 'Life Insurance Cover',
        status: 'applied', statusLabel: 'Application Submitted',
        applicationData,
        consent: {
          consentId: consentRef.id, consentType: 'life_insurance_authorization',
          otpVerified: true, otpCode: otpId, otpVerifiedAt: now, consentGrantedAt: now,
        },
        consentFormDocumentUrl: consentPdfResult.document_url || null,
        consentFormUid: consentPdfResult.consent_uid || null,
        consentFormDocumentHash: consentPdfResult.document_hash || null,
        reference, idNumber: idNum,
        waId: (userProfile as unknown as Record<string, unknown>).waId || null,
        uid, email: userProfile.email, clientName: fullName,
        channel: 'mobile_chat',
        referredBy: (userProfile as unknown as { referredBy?: string }).referredBy || null,
        createdAt: now, updatedAt: now,
      });

      // 5. Update activeProducts
      await updateUserProfile({
        [`activeProducts.life_insurance`]: {
          applicationId: appRef.id, productType: 'life_insurance',
          status: 'applied', statusLabel: 'Application Submitted',
          reference, createdAt: now, updatedAt: now,
        },
      } as Record<string, unknown>);

      setCurrentStep('done');
      addBotMessage(
        `🎉 Congratulations, ${pName || firstName}! Your life insurance application has been submitted!\n\n` +
        `📋 Reference: ${reference}\n\n` +
        `Our advisors will review your details and prepare personalised quotes. You'll be notified once they're ready.\n\n` +
        `Track your application in "My Products".`,
        { inputType: 'none' },
      );
    } catch (err) {
      console.error('[LifeInsuranceChat] Submit error:', err);
      setError('Failed to submit application. Please try again.');
      setCurrentStep('consent_step');
    } finally { setLoading(false); }
  }, [user, userProfile, data, saleAddress, selectedAvatar.id, otpId, otpInput, firstName, addBotMessage, updateUserProfile]);

  // ── Derived ─────────────────────────────────────────────────────────
  const lastBotMsg = [...messages].reverse().find((m) => m.from === 'bot');
  const lastInteractiveMsg = [...messages].reverse().find((m) => m.from === 'bot' && m.inputType && m.inputType !== 'none');
  const showTextBar = lastInteractiveMsg?.inputType === 'text'
    && !['done', 'submitting', 'review_summary', 'confirm_address', 'consent_step', 'otp_step'].includes(currentStep);
  const showButtons = lastInteractiveMsg?.inputType === 'buttons' && lastInteractiveMsg.options
    && !['done', 'submitting', 'review_summary', 'confirm_address', 'consent_step', 'otp_step'].includes(currentStep);

  // ══════════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════════
  return (
    <ProfileGuard>
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>

      {/* Avatar chooser */}
      {!avatarChosen && (
        <ScrollView contentContainerStyle={styles.avatarScreen}>
          <View style={styles.avatarCard}>
            <View style={styles.avatarBadge}>
              <Ionicons name="heart" size={13} color={ACCENT} />
              <Text style={styles.avatarBadgeText}>Life Insurance — Chat Mode</Text>
            </View>
            <Text style={styles.avatarTitle}>Choose Your Assistant</Text>
            <Text style={styles.avatarSubtitle}>Pick who you'd like to guide you through your life insurance application.</Text>
            <View style={styles.avatarGrid}>
              {AVATARS.map((av) => (
                <TouchableOpacity key={av.id} style={styles.avatarOption} onPress={() => handleAvatarSelect(av)} activeOpacity={0.7}>
                  <AvatarCircle avatar={av} size={52} />
                  <Text style={styles.avatarName}>{av.name}</Text>
                  <Text style={styles.avatarGender}>{av.gender} Digital Assistant</Text>
                  <Text style={styles.avatarPersonality}>{av.personality}</Text>
                  <View style={styles.avatarCta}><Text style={styles.avatarCtaText}>Chat with {av.name}</Text></View>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.feeNote}>
              <Ionicons name="information-circle" size={14} color="#d97706" />
              <Text style={styles.feeNoteText}>
                <Text style={{ fontWeight: '700' }}>Important:</Text> Tshepo and Palesa are AI digital assistants and do not provide financial advice. This is a free quote request.
              </Text>
            </View>
          </View>
        </ScrollView>
      )}

      {/* Chat container */}
      {avatarChosen && (
        <View style={styles.chatWrap}>
          <View style={styles.chatHeader}>
            <AvatarCircle avatar={selectedAvatar} size={34} />
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={styles.headerName}>{selectedAvatar.name}</Text>
                <View style={styles.aiBadge}><Text style={styles.aiBadgeText}>AI</Text></View>
                <View style={styles.onlineDot} />
              </View>
              <Text style={styles.headerSub}>Life Insurance — Application</Text>
            </View>
            <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={22} color="rgba(255,255,255,0.7)" />
            </TouchableOpacity>
          </View>

          <View style={styles.disclaimerBar}>
            <Ionicons name="information-circle" size={12} color="#d97706" />
            <Text style={styles.disclaimerText}>{selectedAvatar.name} is an AI assistant — does not provide financial advice.</Text>
          </View>

          <ScrollView ref={scrollRef} style={styles.msgScroll} contentContainerStyle={styles.msgScrollContent} showsVerticalScrollIndicator={false}>
            {messages.map((msg) => (
              <View key={msg.id} style={[styles.msgRow, msg.from === 'user' ? styles.msgRowUser : styles.msgRowBot]}>
                {msg.from === 'bot' && <AvatarCircle avatar={selectedAvatar} size={24} />}
                <View style={msg.from === 'bot' ? styles.bubbleBot : styles.bubbleUser}>
                  <BoldText text={msg.text} />
                </View>
              </View>
            ))}

            {isTyping && (
              <View style={[styles.msgRow, styles.msgRowBot]}>
                <AvatarCircle avatar={selectedAvatar} size={24} />
                <View style={styles.bubbleBot}><Text style={styles.typingDots}>• • •</Text></View>
              </View>
            )}

            {/* Button options */}
            {showButtons && (
              <View style={styles.buttonsWrap}>
                {lastInteractiveMsg!.options!.map((opt) => (
                  <TouchableOpacity key={opt.id} style={styles.optionBtn} onPress={() => handleButtonClick(opt.id, opt.label, lastInteractiveMsg!.field)} activeOpacity={0.7}>
                    {opt.icon ? <Text style={styles.optionIcon}>{opt.icon}</Text> : null}
                    <Text style={styles.optionLabel}>{opt.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Address form */}
            {currentStep === 'confirm_address' && (
              <View style={styles.inlineCard}>
                <View style={styles.inlineHeader}>
                  <Ionicons name="location" size={16} color={ACCENT} />
                  <Text style={styles.inlineTitle}>Residential Address</Text>
                </View>
                <TextInput style={styles.formInput} placeholder="Street Address *" value={saleAddress.street} onChangeText={(v) => setSaleAddress({ ...saleAddress, street: v })} />
                <View style={styles.formRow}>
                  <TextInput style={[styles.formInput, { flex: 1 }]} placeholder="Suburb" value={saleAddress.suburb} onChangeText={(v) => setSaleAddress({ ...saleAddress, suburb: v })} />
                  <TextInput style={[styles.formInput, { flex: 1 }]} placeholder="Town / City *" value={saleAddress.city} onChangeText={(v) => setSaleAddress({ ...saleAddress, city: v })} />
                </View>
                <View style={styles.formRow}>
                  <View style={[styles.formInput, { flex: 1, padding: 0 }]}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ paddingHorizontal: 12 }}>
                      {SA_PROVINCES.map((p) => (
                        <TouchableOpacity key={p} onPress={() => setSaleAddress({ ...saleAddress, province: p })}
                          style={[styles.provinceChip, saleAddress.province === p && styles.provinceChipActive]}>
                          <Text style={[styles.provinceChipText, saleAddress.province === p && styles.provinceChipTextActive]}>{p}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                </View>
                <TextInput style={styles.formInput} placeholder="Postal Code *" value={saleAddress.postalCode}
                  onChangeText={(v) => setSaleAddress({ ...saleAddress, postalCode: v.replace(/\D/g, '') })} keyboardType="number-pad" maxLength={4} />
                {error ? <Text style={styles.errorText}>{error}</Text> : null}
                <TouchableOpacity style={styles.primaryBtn} onPress={handleAddressConfirm} activeOpacity={0.8}>
                  <Text style={styles.primaryBtnText}>Confirm Address & Continue</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Review summary CTA */}
            {currentStep === 'review_summary' && (
              <View style={styles.inlineCard}>
                <TouchableOpacity style={styles.primaryBtn} onPress={handleProceedToConsent} activeOpacity={0.8}>
                  <Text style={styles.primaryBtnText}>✅ Confirm & Proceed to Consent</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.secondaryBtn} onPress={() => { setMessages([]); setData({}); setCurrentStep('choose_avatar'); setAvatarChosen(false); }}>
                  <Ionicons name="refresh" size={12} color={Colors.text.light} />
                  <Text style={styles.secondaryBtnText}>Start over</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Consent form */}
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
                <TouchableOpacity style={styles.checkRow} onPress={() => setInsuranceConsent(!insuranceConsent)} activeOpacity={0.7}>
                  <View style={[styles.checkbox, insuranceConsent && styles.checkboxOn]}>
                    {insuranceConsent && <Ionicons name="checkmark" size={14} color="#fff" />}
                  </View>
                  <Text style={styles.checkLabel}>I authorise MyBenefitz to obtain life insurance quotes on my behalf from registered providers.</Text>
                </TouchableOpacity>
                {maskedPhone ? <Text style={styles.phoneHint}>A verification code will be sent to <Text style={{ fontWeight: '600' }}>{maskedPhone}</Text></Text> : null}
                {error ? <Text style={styles.errorText}>{error}</Text> : null}
                <TouchableOpacity
                  style={[styles.primaryBtn, !(popiaConsent && insuranceConsent) && styles.primaryBtnOff]}
                  onPress={handleSendOtp}
                  disabled={!(popiaConsent && insuranceConsent) || loading}
                  activeOpacity={0.8}
                >
                  {loading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.primaryBtnText}>Send Verification Code</Text>}
                </TouchableOpacity>
              </View>
            )}

            {/* OTP form */}
            {currentStep === 'otp_step' && (
              <View style={styles.inlineCard}>
                <Text style={styles.inlineTitle}>Enter Verification Code</Text>
                <Text style={styles.otpHint}>Sent to {maskedPhone} via WhatsApp</Text>
                <View style={styles.otpRow}>
                  {otpInput.map((d, i) => (
                    <TextInput key={i} ref={(el) => { otpRefs.current[i] = el; }} style={styles.otpBox} value={d}
                      onChangeText={(v) => handleOtpChange(i, v)} keyboardType="number-pad" maxLength={1} textAlign="center"
                      onKeyPress={(e) => { if (e.nativeEvent.key === 'Backspace' && !otpInput[i] && i > 0) otpRefs.current[i - 1]?.focus(); }} />
                  ))}
                </View>
                {error ? <Text style={styles.errorText}>{error}</Text> : null}
                <TouchableOpacity
                  style={[styles.primaryBtn, otpInput.join('').length !== 6 && styles.primaryBtnOff]}
                  onPress={handleVerifyOtp}
                  disabled={otpInput.join('').length !== 6 || loading}
                  activeOpacity={0.8}
                >
                  {loading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.primaryBtnText}>Verify & Submit Application</Text>}
                </TouchableOpacity>
              </View>
            )}

            {/* Done */}
            {currentStep === 'done' && (
              <View style={styles.inlineCard}>
                <TouchableOpacity style={styles.primaryBtn} onPress={() => router.back()} activeOpacity={0.8}>
                  <Text style={styles.primaryBtnText}>Back to Insurance</Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>

          {/* Text input bar */}
          {showTextBar && (
            <View style={styles.inputBar}>
              <TextInput style={styles.textInput} value={textInput} onChangeText={setTextInput}
                placeholder={lastInteractiveMsg?.placeholder || 'Type your answer...'}
                placeholderTextColor={Colors.text.light} returnKeyType="send" onSubmitEditing={handleTextSubmit} />
              <TouchableOpacity style={[styles.sendBtn, !textInput.trim() && styles.sendBtnOff]} onPress={handleTextSubmit} disabled={!textInput.trim()}>
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
  feeNote: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, backgroundColor: '#fffbeb', borderRadius: 8, padding: 10, borderWidth: 1, borderColor: '#fde68a' },
  feeNoteText: { flex: 1, fontSize: 11, color: '#92400e', lineHeight: 16 },

  // Chat
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
  bubbleUser: { backgroundColor: '#fee2e2', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderBottomRightRadius: 2, maxWidth: '75%' },
  msgText: { fontSize: 14, color: Colors.text.primary, lineHeight: 20 },
  typingDots: { fontSize: 18, color: Colors.text.light, letterSpacing: 2 },

  // Buttons
  buttonsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginLeft: 30, marginBottom: 10 },
  optionBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8, borderWidth: 1.5, borderColor: '#bfdbfe', backgroundColor: ACCENT_BG },
  optionIcon: { fontSize: 15 },
  optionLabel: { fontSize: 13, fontWeight: '500', color: Colors.text.primary },

  // Inline cards
  inlineCard: { marginLeft: 30, backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: Colors.border, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3, elevation: 1 },
  inlineHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 14 },
  inlineTitle: { fontSize: 15, fontWeight: '700', color: Colors.text.primary },

  // Form inputs
  formInput: { backgroundColor: '#f9fafb', borderRadius: 8, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: Colors.text.primary, marginBottom: 8 },
  formRow: { flexDirection: 'row', gap: 8 },
  provinceChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, marginRight: 6, marginVertical: 8 },
  provinceChipActive: { backgroundColor: ACCENT, borderColor: ACCENT },
  provinceChipText: { fontSize: 11, color: Colors.text.secondary },
  provinceChipTextActive: { color: '#fff', fontWeight: '600' },

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
  secondaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, marginTop: 10, paddingVertical: 8 },
  secondaryBtnText: { fontSize: 12, color: Colors.text.light },

  // OTP
  otpHint: { fontSize: 12, color: Colors.text.secondary, marginBottom: 14 },
  otpRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 14 },
  otpBox: { width: 42, height: 50, backgroundColor: '#f9fafb', borderRadius: 10, borderWidth: 1.5, borderColor: Colors.border, fontSize: 22, fontWeight: '700', color: Colors.text.primary },

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
