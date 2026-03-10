import { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  ActivityIndicator, KeyboardAvoidingView, Platform, Switch,
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
  SA_PROVINCES, MARITAL_STATUS_OPTIONS, BANK_OPTIONS, ACCOUNT_TYPE_OPTIONS,
  getUniversalBranchCode, submitProductApplication, getReferralInfo, CONSENT_FORM_URL,
} from '../lib/productUtils';
import type { OtpPurpose } from '../lib/productUtils';

const ACCENT = '#3b82f6';
const ACCENT_DARK = '#2563eb';
const ACCENT_BG = '#eff6ff';

interface ChatMessage { id: string; from: 'bot' | 'user'; text: string; }

const COVER_TYPES = [
  { id: 'comprehensive', label: 'Comprehensive', desc: 'Full cover: theft, accident, fire & third-party.' },
  { id: 'third_party_fire_theft', label: '3rd Party Fire & Theft', desc: 'Third-party + fire + theft.' },
  { id: 'third_party_only', label: 'Third Party Only', desc: 'Covers damage to others.' },
];
const VEHICLE_USAGE = ['Private Use', 'Business Use', 'Private & Business Use', 'Uber / e-Hailing', 'Commercial / Fleet'];
const PARKING_OPTS = ['Locked Garage', 'Carport', 'Secure Parking (Guarded)', 'Street Parking', 'Open Yard'];
const SEC_DEVICES = ['Factory Immobiliser', 'Aftermarket Immobiliser', 'Tracking Device', 'Gear Lock / Steering Lock', 'Dashcam', 'None'];
const LICENSE_CODES = ['A', 'A1', 'B', 'C', 'C1', 'EB', 'EC', 'EC1'];
const CLAIMS_OPTS = [{ id: 'none', label: 'No claims (5+ years)' }, { id: '1_claim', label: '1 claim in last 3 years' }, { id: '2_plus', label: '2+ claims in last 3 years' }];

function ordDay(d: string) { if (d === '99') return 'Last day'; const n = parseInt(d); return `${n}${n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th'}`; }

type StepKey =
  | 'choose_avatar' | 'id_number' | 'first_name' | 'surname' | 'phone' | 'marital_status'
  | 'license_code' | 'license_date'
  | 'vehicle_make' | 'vehicle_model' | 'vehicle_year' | 'vehicle_color' | 'vehicle_reg' | 'vehicle_vin'
  | 'vehicle_usage' | 'vehicle_financed' | 'finance_provider'
  | 'cover_type' | 'existing_cover' | 'existing_insurer' | 'claims_history'
  | 'confirm_address' | 'risk_same' | 'risk_address' | 'overnight_parking' | 'security_devices'
  | 'collect_bank' | 'review_summary' | 'consent_step' | 'otp_step' | 'submitting' | 'done';

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

export default function CarInsuranceApplyScreen() {
  const router = useRouter();
  const { user, userProfile, updateUserProfile, isHomeAffairsVerified } = useAuth();
  const idVerified = isHomeAffairsVerified;
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

  // Vehicle
  const [vMake, setVMake] = useState(''); const [vModel, setVModel] = useState(''); const [vYear, setVYear] = useState('');
  const [vColor, setVColor] = useState(''); const [vReg, setVReg] = useState(''); const [vVin, setVVin] = useState('');
  const [vUsage, setVUsage] = useState(''); const [vFinanced, setVFinanced] = useState(false); const [vFinProv, setVFinProv] = useState('');
  const [coverType, setCoverType] = useState('comprehensive');
  const [hasExisting, setHasExisting] = useState(false); const [existInsurer, setExistInsurer] = useState('');
  const [claimsHist, setClaimsHist] = useState('none');

  // Address
  const [addr, setAddr] = useState({ street: '', suburb: '', city: '', province: '', postalCode: '' });
  const [riskSame, setRiskSame] = useState(true);
  const [rAddr, setRAddr] = useState({ street: '', suburb: '', city: '', province: '', postalCode: '' });

  // Security
  const [parking, setParking] = useState(''); const [secDevs, setSecDevs] = useState<string[]>([]);
  const [secEstate, setSecEstate] = useState(false); const [secGate, setSecGate] = useState(false); const [secCctv, setSecCctv] = useState(false);

  // Bank
  const [bk, setBk] = useState(''); const [aT, setAT] = useState(''); const [aN, setAN] = useState(''); const [cDay, setCDay] = useState('1');

  // Consent & OTP
  const [popiaConsent, setPopiaConsent] = useState(false);
  const [carConsent, setCarConsent] = useState(false);
  const [debicheckConsent, setDebicheckConsent] = useState(false);
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
    if (userProfile.email) p.email = userProfile.email;
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
      case 'id_number': addBot("Let's get you covered! 🚗\n\nFirst, your <b>13-digit SA ID</b>."); break;
      case 'first_name':
        if (idVerified && m.firstName) { addBot(`Name: <b>${m.firstName}</b> ✅`); setTimeout(() => progressTo('surname'), 800); }
        else addBot("First name?"); break;
      case 'surname':
        if (idVerified && m.surname) { addBot(`Surname: <b>${m.surname}</b> ✅`); setTimeout(() => progressTo('phone'), 800); }
        else addBot("Surname?"); break;
      case 'phone': addBot("Cell phone number? 📱"); break;
      case 'marital_status': addBot("Marital status?"); break;
      case 'license_code': addBot("Driver's license code? 🪪"); break;
      case 'license_date': addBot("When did you get your license? (YYYY-MM-DD)"); break;
      case 'vehicle_make': addBot("Now let's talk about your ride! 🚘\n\nVehicle <b>make</b>?"); break;
      case 'vehicle_model': addBot("And the <b>model</b>?"); break;
      case 'vehicle_year': addBot("Year of manufacture?"); break;
      case 'vehicle_color': addBot("Colour?"); break;
      case 'vehicle_reg': addBot("Registration number?"); break;
      case 'vehicle_vin': addBot("VIN / Chassis number? (optional — type 'skip' to skip)"); break;
      case 'vehicle_usage': addBot("How is the vehicle used?"); break;
      case 'vehicle_financed': addBot("Is the vehicle financed? 🏦"); break;
      case 'finance_provider': addBot("Who is the finance provider?"); break;
      case 'cover_type': addBot("What type of cover? ☂️"); break;
      case 'existing_cover': addBot("Do you have existing car insurance?"); break;
      case 'existing_insurer': addBot("Who is your current insurer?"); break;
      case 'claims_history': addBot("Claims history?"); break;
      case 'confirm_address': {
        const as = [addr.street, addr.suburb, addr.city, addr.province, addr.postalCode].filter(Boolean).join(', ');
        addBot(as ? `Address on file:\n📍 ${as}\n\nEdit if needed.` : 'Enter your address. 🏡');
        break;
      }
      case 'risk_same': addBot("Is the vehicle parked overnight at this address?"); break;
      case 'risk_address': addBot("Enter the overnight parking address."); break;
      case 'overnight_parking': addBot("Where is the vehicle parked overnight? 🅿️"); break;
      case 'security_devices': addBot("Select security devices on the vehicle:"); break;
      case 'collect_bank': addBot("Banking details for DebiCheck. 🏦"); break;
      case 'review_summary': {
        const cl = COVER_TYPES.find(c => c.id === coverType)?.label || coverType;
        const as = [addr.street, addr.suburb, addr.city, addr.province, addr.postalCode].filter(Boolean).join(', ');
        const ra = riskSame ? as : [rAddr.street, rAddr.suburb, rAddr.city, rAddr.province, rAddr.postalCode].filter(Boolean).join(', ');
        addBot(`📋 Summary\n\n<b>Policyholder</b>\n  👤 ${m.firstName || ''} ${m.surname || ''}\n  🆔 ${m.idNumber || ''}\n  📱 ${m.phone || ''}\n\n<b>Vehicle</b>\n  🚘 ${vMake} ${vModel} (${vYear})\n  🎨 ${vColor} • ${vReg}\n  📋 ${cl} • ${vUsage}${vFinanced ? ' • Financed: ' + vFinProv : ''}\n\n<b>Address</b>\n  📍 ${as}\n  🅿️ Overnight: ${ra} — ${parking}\n\n<b>Security</b>\n  ${secDevs.join(', ') || 'None'}\n\n<b>Debit</b>\n  🏦 ${BANK_OPTIONS.find(b => b.id === bk)?.label || bk} ****${aN.slice(-4)}\n  📅 ${ordDay(cDay)} of each month`);
        break;
      }
      case 'consent_step': addBot("Accept consents and sign with OTP. 📝"); break;
      case 'otp_step': addBot("Enter 6-digit code sent to WhatsApp. 🔐"); break;
      case 'done': break;
    }
  }, [data, addBot, addr, rAddr, idVerified, vMake, vModel, vYear, vColor, vReg, vUsage, vFinanced, vFinProv, coverType, parking, secDevs, riskSame, bk, aN, cDay]);

  const handleAvatarSelect = useCallback((av: AvatarProfile) => {
    setSelectedAvatar(av); setAvatarChosen(true);
    addBot(`Hey ${firstName}! I'm <b>${av.name}</b> 🚗 I'll help you get a car insurance quote in minutes!`);
    setTimeout(() => progressTo('id_number'), 1500);
  }, [addBot, firstName, progressTo]);

  const handleButtonClick = useCallback((optId: string, label: string, field?: string) => {
    addUser(label);
    if (field === 'maritalStatus') { progressTo('license_code', { maritalStatus: optId }); return; }
    if (field === 'licenseCode') { progressTo('license_date', { licenseCode: optId }); return; }
    if (field === 'vehicleUsage') { setVUsage(optId); progressTo('vehicle_financed'); return; }
    if (field === 'vehicleFinanced') { const fin = optId === 'yes'; setVFinanced(fin); progressTo(fin ? 'finance_provider' : 'cover_type'); return; }
    if (field === 'coverType') { setCoverType(optId); progressTo('existing_cover'); return; }
    if (field === 'existingCover') { setHasExisting(optId === 'yes'); progressTo(optId === 'yes' ? 'existing_insurer' : 'claims_history'); return; }
    if (field === 'claimsHistory') { setClaimsHist(optId); progressTo('confirm_address'); return; }
    if (field === 'riskSame') { setRiskSame(optId === 'yes'); progressTo(optId === 'yes' ? 'overnight_parking' : 'risk_address'); return; }
    if (field === 'overnightParking') { setParking(optId); progressTo('security_devices'); return; }
  }, [addUser, progressTo]);

  const handleTextSubmit = useCallback(() => {
    const v = inputText.trim(); if (!v) return; addUser(v); setInputText('');
    if (currentStep === 'id_number') {
      const c = v.replace(/\D/g, '');
      if (!isValidSAID(c)) { addBot("Invalid ID."); return; }
      const di = extractDobFromId(c), g = extractGenderFromId(c), a = di?.age ?? 0;
      if (a < 18) { addBot(`Age ${a} — must be 18+.`); return; }
      addBot(`✅ ${di?.dob || ''} • Age: ${a} • ${g || ''}`);
      setTimeout(() => progressTo('first_name', { idNumber: c, dob: di?.dob || '', age: String(a), gender: g || '' }), 1200);
      return;
    }
    if (currentStep === 'first_name') { progressTo('surname', { firstName: v }); return; }
    if (currentStep === 'surname') { progressTo('phone', { surname: v }); return; }
    if (currentStep === 'phone') { progressTo('marital_status', { phone: v }); return; }
    if (currentStep === 'license_date') { progressTo('vehicle_make', { licenseDate: v }); return; }
    if (currentStep === 'vehicle_make') { setVMake(v); progressTo('vehicle_model'); return; }
    if (currentStep === 'vehicle_model') { setVModel(v); progressTo('vehicle_year'); return; }
    if (currentStep === 'vehicle_year') { const yr = parseInt(v); if (isNaN(yr) || yr < 1990 || yr > new Date().getFullYear() + 1) { addBot("Enter valid year (1990+)."); return; } setVYear(v); progressTo('vehicle_color'); return; }
    if (currentStep === 'vehicle_color') { setVColor(v); progressTo('vehicle_reg'); return; }
    if (currentStep === 'vehicle_reg') { setVReg(v); progressTo('vehicle_vin'); return; }
    if (currentStep === 'vehicle_vin') { setVVin(v.toLowerCase() === 'skip' ? '' : v); progressTo('vehicle_usage'); return; }
    if (currentStep === 'finance_provider') { setVFinProv(v); progressTo('cover_type'); return; }
    if (currentStep === 'existing_insurer') { setExistInsurer(v); progressTo('claims_history'); return; }
  }, [inputText, currentStep, addUser, addBot, progressTo]);

  const handleAddressConfirm = useCallback(() => {
    if (!addr.street || !addr.city || !addr.province || !addr.postalCode) { setError('Fill required fields.'); return; }
    setError(''); addUser(`Address: ${[addr.street, addr.suburb, addr.city, addr.province, addr.postalCode].filter(Boolean).join(', ')}`);
    progressTo('risk_same');
  }, [addr, addUser, progressTo]);

  const handleRiskAddrConfirm = useCallback(() => {
    if (!rAddr.street || !rAddr.city || !rAddr.province || !rAddr.postalCode) { setError('Fill required fields.'); return; }
    setError(''); addUser(`Risk Address: ${[rAddr.street, rAddr.suburb, rAddr.city, rAddr.province, rAddr.postalCode].filter(Boolean).join(', ')}`);
    progressTo('overnight_parking');
  }, [rAddr, addUser, progressTo]);

  const handleSecurityConfirm = useCallback(() => {
    if (secDevs.length === 0) { setError('Select at least one.'); return; }
    setError(''); addUser(`Security: ${secDevs.join(', ')}${secEstate ? ' • Estate' : ''}${secGate ? ' • Gate' : ''}${secCctv ? ' • CCTV' : ''}`);
    progressTo('collect_bank');
  }, [secDevs, secEstate, secGate, secCctv, addUser, progressTo]);

  const handleBankConfirm = useCallback(() => {
    if (!bk || !aT || !aN) { setError('Fill banking fields.'); return; }
    setError(''); addUser(`Bank: ${BANK_OPTIONS.find(b => b.id === bk)?.label || bk}, ****${aN.slice(-4)}`);
    progressTo('review_summary');
  }, [bk, aT, aN, addUser, progressTo]);

  const handleProceed = useCallback(() => { addUser("Confirmed ✅"); progressTo('consent_step'); }, [addUser, progressTo]);

  const ph = userProfile?.phoneNumber || userProfile?.whatsappNumber || data.phone || '';
  const mPh = ph ? ph.slice(0, 3) + '****' + ph.slice(-3) : '';

  const handleSendOtp = useCallback(async () => {
    setIsLoading(true); setError('');
    try {
      const r = await sendWhatsAppOtp(normalizePhone(ph), 'car_insurance_authorization' as OtpPurpose);
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
      const bL = BANK_OPTIONS.find(b => b.id === bk)?.label || bk, bc = getUniversalBranchCode(bL);
      const { registrationType, referrerCode, referredBy } = getReferralInfo(userProfile as unknown as Record<string, unknown>);
      const cl = COVER_TYPES.find(c => c.id === coverType)?.label || coverType;
      const riskAddress = riskSame ? { streetAddress: addr.street, suburb: addr.suburb, townOrCity: addr.city, province: addr.province, postalCode: addr.postalCode } : { streetAddress: rAddr.street, suburb: rAddr.suburb, townOrCity: rAddr.city, province: rAddr.province, postalCode: rAddr.postalCode };
      const appData = {
        policyholderName: pN, policyholderSurname: pS, policyholderIdNumber: idN,
        policyholderDob: di?.dob || null, policyholderGender: g || null, policyholderAge: di?.age ?? null,
        policyholderCellphone: phone, policyholderEmail: data.email || userProfile.email || '',
        policyholderMaritalStatus: data.maritalStatus || '', licenseDate: data.licenseDate || '', licenseCode: data.licenseCode || '',
        preferredCommsMethod: 'whatsapp',
        vehicleMake: vMake, vehicleModel: vModel, vehicleYear: vYear, vehicleColor: vColor,
        vehicleRegNumber: vReg, vehicleVin: vVin || null, vehicleUsage: vUsage,
        vehicleFinanced: vFinanced, vehicleFinanceProvider: vFinanced ? vFinProv : null,
        coverType, coverTypeLabel: cl, hasExistingCover: hasExisting,
        existingInsurer: hasExisting ? existInsurer : null, claimsHistory: claimsHist,
        residentialAddress: { streetAddress: addr.street, suburb: addr.suburb, townOrCity: addr.city, province: addr.province, postalCode: addr.postalCode },
        riskAddress, riskSameAsResidential: riskSame,
        overnightParking: parking, securityDevices: secDevs, securityEstate: secEstate, securityGateMotor: secGate, securityCctv: secCctv,
        bankName: bk, bankLabel: bL, accountType: aT, accountNumber: aN, branchCode: bc, premiumCollectionDay: cDay,
        quoteSources: ['Santam', 'Hollard', 'Old Mutual', 'King Price'],
        status: 'application_submitted', applicationSubmittedAt: now, createdAt: now, updatedAt: now,
      };
      await updateUserProfile({ idNumber: idN, firstName: pN, lastName: pS, fullName: full, applicationSubmittedAt: now, updatedAt: now } as any);
      const cR = doc(collection(db, 'profiles', uid, 'consents'));
      await setDoc(cR, { consentId: cR.id, consentType: 'car_insurance_authorization', fullName: full, surname: pS, idNumber: idN, clientPhone: phone, popiaConsent: true, debicheckConsent: true, whatsAppContactConsent: true, otpVerified: true, otpCode: otpId, otpVerifiedAt: now, consentGrantedAt: now, messageId: otpMsgId || null, purpose: 'Car Insurance Authorization', status: 'active', channel: 'chat_mode', createdAt: now });
      await submitProductApplication({ uid, productType: 'car_insurance', productName: 'Car Insurance', productDescription: `${vMake} ${vModel} (${vYear}) — ${cl}`, status: 'applied', statusLabel: 'Quote Requested', applicationData: appData as unknown as Record<string, unknown>, consent: { consentId: cR.id, consentType: 'car_insurance_authorization', otpVerified: true, otpCode: otpId, otpMessageId: otpMsgId || null, otpVerifiedAt: now, consentGrantedAt: now, messageId: otpMsgId || null }, reference: `CI-${uid.slice(0, 6)}-${cR.id}`, idNumber: idN, waId: userProfile.waId || null, email: userProfile.email, clientName: full, amount: 0, registrationType, referrerCode, referredBy });
      setCurrentStep('done');
      addBot(`🎉 Quote requested!\n\nRef: CI-${uid.slice(0, 6)}-${cR.id}\n🚘 ${vMake} ${vModel} (${vYear})\n☂️ ${cl}\n\nWe'll get quotes from top insurers and contact you on WhatsApp.`);
    } catch (e) { console.error('[CI]', e); setError('Failed.'); setCurrentStep('consent_step'); }
    finally { setIsLoading(false); }
  }, [user, userProfile, data, addr, rAddr, riskSame, vMake, vModel, vYear, vColor, vReg, vVin, vUsage, vFinanced, vFinProv, coverType, hasExisting, existInsurer, claimsHist, parking, secDevs, secEstate, secGate, secCctv, bk, aT, aN, cDay, otpId, otpMsgId, addBot, updateUserProfile]);

  const textSteps: StepKey[] = ['id_number', 'first_name', 'surname', 'phone', 'license_date', 'vehicle_make', 'vehicle_model', 'vehicle_year', 'vehicle_color', 'vehicle_reg', 'vehicle_vin', 'finance_provider', 'existing_insurer'];
  const showTextInput = textSteps.includes(currentStep);

  const buttonConfigs: Partial<Record<StepKey, { options: { id: string; label: string; icon?: string; desc?: string }[]; field: string }>> = {
    marital_status: { options: MARITAL_STATUS_OPTIONS.map(x => ({ id: x, label: x })), field: 'maritalStatus' },
    license_code: { options: LICENSE_CODES.map(c => ({ id: c, label: `Code ${c}` })), field: 'licenseCode' },
    vehicle_usage: { options: VEHICLE_USAGE.map(u => ({ id: u, label: u })), field: 'vehicleUsage' },
    vehicle_financed: { options: [{ id: 'yes', label: 'Yes', icon: '✅' }, { id: 'no', label: 'No', icon: '❌' }], field: 'vehicleFinanced' },
    cover_type: { options: COVER_TYPES.map(c => ({ id: c.id, label: c.label, desc: c.desc })), field: 'coverType' },
    existing_cover: { options: [{ id: 'yes', label: 'Yes' }, { id: 'no', label: 'No' }], field: 'existingCover' },
    claims_history: { options: CLAIMS_OPTS.map(c => ({ id: c.id, label: c.label })), field: 'claimsHistory' },
    risk_same: { options: [{ id: 'yes', label: 'Yes, same address', icon: '✅' }, { id: 'no', label: 'No, different', icon: '📍' }], field: 'riskSame' },
    overnight_parking: { options: PARKING_OPTS.map(p => ({ id: p, label: p })), field: 'overnightParking' },
  };
  const currentButtons = buttonConfigs[currentStep];

  return (
    <ProfileGuard>
      <SafeAreaView style={styles.container} edges={['top']}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          {!avatarChosen && (
            <ScrollView contentContainerStyle={styles.avatarScroll}>
              <View style={styles.avatarCard}>
                <View style={styles.avatarBadge}><Ionicons name="car" size={13} color={ACCENT} /><Text style={styles.avatarBadgeText}>Car Insurance — Chat Mode</Text></View>
                <Text style={styles.avatarTitle}>Choose Your Assistant</Text>
                <Text style={styles.avatarSubtitle}>Pick who you'd like to guide you through your car insurance quote.</Text>
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
                  <Text style={styles.headerSub}>Car Insurance — Quote</Text>
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
                        <View>
                          <Text style={styles.optionLabel}>{o.label}</Text>
                          {o.desc ? <Text style={{ fontSize: 10, color: '#9ca3af' }}>{o.desc}</Text> : null}
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                {/* Address form */}
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

                {/* Risk address */}
                {currentStep === 'risk_address' && (
                  <View style={styles.inlineCard}>
                    <Text style={styles.inlineTitle}>🅿️ Overnight Parking Address</Text>
                    <TextInput style={styles.inlineInput} placeholder="Street *" value={rAddr.street} onChangeText={v => setRAddr({ ...rAddr, street: v })} />
                    <TextInput style={styles.inlineInput} placeholder="Suburb" value={rAddr.suburb} onChangeText={v => setRAddr({ ...rAddr, suburb: v })} />
                    <TextInput style={styles.inlineInput} placeholder="City *" value={rAddr.city} onChangeText={v => setRAddr({ ...rAddr, city: v })} />
                    <TextInput style={styles.inlineInput} placeholder="Province *" value={rAddr.province} onChangeText={v => setRAddr({ ...rAddr, province: v })} />
                    <TextInput style={styles.inlineInput} placeholder="Postal Code *" value={rAddr.postalCode} onChangeText={v => setRAddr({ ...rAddr, postalCode: v.replace(/\D/g, '') })} maxLength={4} keyboardType="number-pad" />
                    {error ? <Text style={styles.errorText}>{error}</Text> : null}
                    <TouchableOpacity style={styles.confirmBtn} onPress={handleRiskAddrConfirm}><Text style={styles.confirmBtnText}>Confirm</Text></TouchableOpacity>
                  </View>
                )}

                {/* Security devices */}
                {currentStep === 'security_devices' && (
                  <View style={styles.inlineCard}>
                    <Text style={styles.inlineTitle}>🔒 Security</Text>
                    {SEC_DEVICES.map(sd => (
                      <TouchableOpacity key={sd} style={styles.checkRow} onPress={() => { if (secDevs.includes(sd)) setSecDevs(p => p.filter(x => x !== sd)); else setSecDevs(p => [...p, sd]); }}>
                        <Ionicons name={secDevs.includes(sd) ? 'checkbox' : 'square-outline'} size={20} color={ACCENT} />
                        <Text style={styles.checkText}>{sd}</Text>
                      </TouchableOpacity>
                    ))}
                    <View style={{ borderTopWidth: 1, borderTopColor: '#f3f4f6', paddingTop: 8, marginTop: 4 }}>
                      <TouchableOpacity style={styles.checkRow} onPress={() => setSecEstate(!secEstate)}>
                        <Ionicons name={secEstate ? 'checkbox' : 'square-outline'} size={20} color={ACCENT} /><Text style={styles.checkText}>Security estate</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.checkRow} onPress={() => setSecGate(!secGate)}>
                        <Ionicons name={secGate ? 'checkbox' : 'square-outline'} size={20} color={ACCENT} /><Text style={styles.checkText}>Gate motor / remote</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.checkRow} onPress={() => setSecCctv(!secCctv)}>
                        <Ionicons name={secCctv ? 'checkbox' : 'square-outline'} size={20} color={ACCENT} /><Text style={styles.checkText}>CCTV cameras</Text>
                      </TouchableOpacity>
                    </View>
                    {error ? <Text style={styles.errorText}>{error}</Text> : null}
                    <TouchableOpacity style={styles.confirmBtn} onPress={handleSecurityConfirm}><Text style={styles.confirmBtnText}>Continue</Text></TouchableOpacity>
                  </View>
                )}

                {/* Bank form */}
                {currentStep === 'collect_bank' && (
                  <View style={styles.inlineCard}>
                    <Text style={styles.inlineTitle}>🏦 Debit Order</Text>
                    <View style={styles.pickerWrap}>{BANK_OPTIONS.map(b => (<TouchableOpacity key={b.id} style={[styles.relBtn, bk === b.id && styles.relBtnActive]} onPress={() => setBk(b.id)}><Text style={[styles.relBtnText, bk === b.id && styles.relBtnTextActive]}>{b.label}</Text></TouchableOpacity>))}</View>
                    <View style={styles.pickerWrap}>{ACCOUNT_TYPE_OPTIONS.map(a => (<TouchableOpacity key={a.id} style={[styles.relBtn, aT === a.id && styles.relBtnActive]} onPress={() => setAT(a.id)}><Text style={[styles.relBtnText, aT === a.id && styles.relBtnTextActive]}>{a.label}</Text></TouchableOpacity>))}</View>
                    <TextInput style={styles.inlineInput} placeholder="Account Number *" value={aN} onChangeText={v => setAN(v.replace(/\D/g, ''))} keyboardType="number-pad" />
                    {error ? <Text style={styles.errorText}>{error}</Text> : null}
                    <TouchableOpacity style={styles.confirmBtn} onPress={handleBankConfirm}><Text style={styles.confirmBtnText}>Continue</Text></TouchableOpacity>
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
                    <TouchableOpacity style={styles.checkRow} onPress={() => setPopiaConsent(!popiaConsent)}><Ionicons name={popiaConsent ? 'checkbox' : 'square-outline'} size={20} color={ACCENT} /><Text style={styles.checkText}>I consent to POPIA processing.</Text></TouchableOpacity>
                    <TouchableOpacity style={styles.checkRow} onPress={() => setCarConsent(!carConsent)}><Ionicons name={carConsent ? 'checkbox' : 'square-outline'} size={20} color={ACCENT} /><Text style={styles.checkText}>I authorise car insurance quote processing.</Text></TouchableOpacity>
                    <TouchableOpacity style={styles.checkRow} onPress={() => setDebicheckConsent(!debicheckConsent)}><Ionicons name={debicheckConsent ? 'checkbox' : 'square-outline'} size={20} color={ACCENT} /><Text style={styles.checkText}>I accept the DebiCheck mandate ({ordDay(cDay)} of each month).</Text></TouchableOpacity>
                    {mPh ? <Text style={{ fontSize: 12, color: '#6b7280', marginTop: 8 }}>Code sent to {mPh}</Text> : null}
                    {error ? <Text style={styles.errorText}>{error}</Text> : null}
                    <TouchableOpacity style={[styles.confirmBtn, !(popiaConsent && carConsent && debicheckConsent) && { opacity: 0.5 }]} onPress={handleSendOtp} disabled={!(popiaConsent && carConsent && debicheckConsent) || isLoading}>
                      {isLoading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.confirmBtnText}>Send OTP</Text>}
                    </TouchableOpacity>
                  </View>
                )}

                {currentStep === 'otp_step' && (
                  <View style={styles.inlineCard}>
                    <Text style={styles.inlineTitle}>🔐 Enter Code</Text>
                    <Text style={{ fontSize: 12, color: '#6b7280', marginBottom: 12 }}>Sent to {mPh}</Text>
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
                    <TouchableOpacity style={[styles.confirmBtn, { backgroundColor: '#fff', borderWidth: 1.5, borderColor: ACCENT }]} onPress={() => router.replace('/(tabs)')}><Text style={[styles.confirmBtnText, { color: ACCENT }]}>Dashboard</Text></TouchableOpacity>
                  </View>
                )}

                {currentStep === 'submitting' && (<View style={{ alignItems: 'center', padding: 20 }}><ActivityIndicator size="large" color={ACCENT} /><Text style={{ marginTop: 12, color: '#6b7280' }}>Processing...</Text></View>)}
              </ScrollView>

              {showTextInput && (
                <View style={styles.inputBar}>
                  <TextInput style={styles.textInput} value={inputText} onChangeText={setInputText} placeholder="Type your answer..." onSubmitEditing={handleTextSubmit} returnKeyType="send" />
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
  avatarBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'center', backgroundColor: ACCENT_BG, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12, marginBottom: 12 },
  avatarBadgeText: { fontSize: 11, fontWeight: '600', color: ACCENT_DARK },
  avatarTitle: { fontSize: 20, fontWeight: '800', color: '#111827', textAlign: 'center', marginBottom: 4 },
  avatarSubtitle: { fontSize: 13, color: '#6b7280', textAlign: 'center', marginBottom: 20 },
  avatarGrid: { flexDirection: 'row', gap: 12 },
  avatarOption: { flex: 1, alignItems: 'center', padding: 16, borderRadius: 14, borderWidth: 2, borderColor: '#e5e7eb', backgroundColor: '#fff', gap: 6 },
  avatarName: { fontSize: 15, fontWeight: '700', color: '#111827' },
  avatarGender: { fontSize: 10, color: '#9ca3af' },
  avatarPersonality: { fontSize: 11, color: '#6b7280', textAlign: 'center' },
  avatarCta: { paddingHorizontal: 14, paddingVertical: 5, borderRadius: 8, backgroundColor: ACCENT },
  avatarCtaText: { color: '#fff', fontWeight: '600', fontSize: 11 },
  chatWrap: { flex: 1, backgroundColor: '#fff', borderRadius: 12, margin: 4, borderWidth: 1, borderColor: '#d1d5db', overflow: 'hidden' },
  chatHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: ACCENT_DARK },
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
  bubbleUser: { backgroundColor: '#dbeafe', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderBottomRightRadius: 2, maxWidth: '75%' },
  msgText: { fontSize: 14, lineHeight: 20, color: '#111827' },
  typingDots: { fontSize: 16, color: '#9ca3af', letterSpacing: 2 },
  buttonsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 4, marginTop: 6 },
  optionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, borderWidth: 1.5, borderColor: '#bfdbfe', backgroundColor: ACCENT_BG },
  optionIcon: { fontSize: 14 },
  optionLabel: { fontSize: 13, fontWeight: '500', color: '#111827' },
  inlineCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#e5e7eb', marginTop: 8, marginHorizontal: 4 },
  inlineTitle: { fontSize: 14, fontWeight: '700', color: '#111827', marginBottom: 12 },
  inlineInput: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, marginBottom: 8, backgroundColor: '#fafbfc' },
  confirmBtn: { backgroundColor: ACCENT_DARK, paddingVertical: 12, paddingHorizontal: 20, borderRadius: 10, alignItems: 'center', marginTop: 4 },
  confirmBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  errorText: { color: '#ef4444', fontSize: 12, marginTop: 4, marginBottom: 4 },
  checkRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 10 },
  checkText: { flex: 1, fontSize: 13, color: '#374151', lineHeight: 18 },
  pickerWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  relBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#fff' },
  relBtnActive: { borderColor: ACCENT, backgroundColor: ACCENT_BG },
  relBtnText: { fontSize: 12, color: '#374151' },
  relBtnTextActive: { color: ACCENT_DARK, fontWeight: '600' },
  inputBar: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#f3f4f6', backgroundColor: '#fff' },
  textInput: { flex: 1, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, fontSize: 14, backgroundColor: '#fafbfc' },
  sendBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: ACCENT_DARK, justifyContent: 'center', alignItems: 'center' },
});
