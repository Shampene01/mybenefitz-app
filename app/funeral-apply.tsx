import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  ActivityIndicator, KeyboardAvoidingView, Platform, Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ref, get } from 'firebase/database';
import { doc, setDoc, collection } from 'firebase/firestore';
import { db, rtdb } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Colors } from '../constants/Colors';
import ProfileGuard from '../components/ProfileGuard';
import { AvatarImage, AVATARS } from '../components/ChatAvatars';
import type { AvatarProfile } from '../components/ChatAvatars';
import {
  isValidSAID, extractDobFromId, extractGenderFromId, normalizePhone,
  sendWhatsAppOtp, verifyWhatsAppOtp, generateClientId,
  SA_PROVINCES, MARITAL_STATUS_OPTIONS, QUALIFICATION_OPTIONS,
  BANK_OPTIONS, ACCOUNT_TYPE_OPTIONS, getUniversalBranchCode,
  submitProductApplication, getReferralInfo, formatCurrency,
  CONSENT_FORM_URL,
} from '../lib/productUtils';
import type { OtpPurpose } from '../lib/productUtils';

const ACCENT = '#8b5cf6';
const ACCENT_DARK = '#6d28d9';
const ACCENT_BG = '#f5f3ff';

interface ChatMessage { id: string; from: 'bot' | 'user'; text: string; }

const PLANS = [
  { id: 'main_member_only', label: 'Main Member Only', icon: '👤' },
  { id: 'member_and_spouse', label: 'Member & Spouse', icon: '💍' },
  { id: 'member_and_up_to_6_children', label: 'Member & Children', icon: '👨‍👧‍👦' },
  { id: 'member_spouse_and_up_to_6_children', label: 'Full Family', icon: '👨‍👩‍👧‍👦' },
];
const RELS = ['Spouse','Mother','Father','Son','Daughter','Brother','Sister','Grandmother','Grandfather','Mother-in-Law','Father-in-Law','Uncle','Aunt','Nephew','Niece','Cousin'];

type StepKey =
  | 'choose_avatar' | 'greeting' | 'id_number' | 'first_name' | 'surname' | 'phone'
  | 'marital_status' | 'occupation' | 'qualification' | 'gross_salary'
  | 'confirm_address' | 'select_plan' | 'select_cover' | 'ask_deps' | 'add_dep' | 'dep_loop'
  | 'beneficiary' | 'collect_bank' | 'review_summary' | 'consent_step' | 'otp_step' | 'submitting' | 'done';

interface Dep { firstName: string; lastName: string; idNumber: string; dateOfBirth: string; gender: string; relationship: string; memberType: string; ageBand: string; coverAmount: number; premium: number; }
interface RateOpt { key: string; cover_amount: number; retail_premium: number; plan_reference: string; collection_fee: number; airtime_benefit: number; automatic_baby_cover: number; }

function ageBand(a: number) { return a <= 17 ? '0-17' : a <= 65 ? '18-65' : a <= 75 ? '66-75' : a <= 80 ? '76-80' : '81-85'; }
function ordDay(d: string) { if (d === '99') return 'Last day'; const n = parseInt(d); return `${n}${n%10===1&&n!==11?'st':n%10===2&&n!==12?'nd':n%10===3&&n!==13?'rd':'th'}`; }
function bandOpts(pr: any, ab: string): RateOpt[] {
  if (!pr?.age_bands?.[ab]) return [];
  const b = pr.age_bands[ab];
  return Object.keys(b).sort((x,y)=>parseInt(x.replace('option_',''))-parseInt(y.replace('option_',''))).map(k=>({key:k,cover_amount:b[k].cover_amount,retail_premium:b[k].retail_premium,plan_reference:b[k].plan_reference,collection_fee:b[k].collection_fee||0,airtime_benefit:b[k].airtime_benefit||0,automatic_baby_cover:b[k].automatic_baby_cover||0}));
}
const fR = (n: number) => formatCurrency(n);

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

export default function FuneralApplyScreen() {
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

  // Rates
  const [rates, setRates] = useState<any>(null);
  const [plan, setPlan] = useState('');
  const [optKey, setOptKey] = useState('');
  const [opt, setOpt] = useState<RateOpt | null>(null);

  // Dependants
  const [deps, setDeps] = useState<Dep[]>([]);
  const [dd, setDD] = useState<Partial<Dep>>({});

  // Beneficiary
  const [bFN, setBFN] = useState(''); const [bLN, setBLN] = useState('');
  const [bId, setBId] = useState(''); const [bPh, setBPh] = useState(''); const [bRl, setBRl] = useState('');
  const [bSameAddr, setBSameAddr] = useState(false);
  const [bAddr, setBAddr] = useState({ street: '', suburb: '', city: '', province: '', postalCode: '' });

  // Address
  const [addr, setAddr] = useState({ street: '', suburb: '', city: '', province: '', postalCode: '' });

  // Bank
  const [bk, setBk] = useState(''); const [aT, setAT] = useState(''); const [aN, setAN] = useState(''); const [cDay, setCDay] = useState('1');

  // Consent & OTP
  const [popiaConsent, setPopiaConsent] = useState(false);
  const [funeralConsent, setFuneralConsent] = useState(false);
  const [debicheckConsent, setDebicheckConsent] = useState(false);
  const [otpId, setOtpId] = useState('');
  const [otpMsgId, setOtpMsgId] = useState('');
  const [otpInput, setOtpInput] = useState('');

  // Pre-fill from profile
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
    if (userProfile.occupation) p.occupation = userProfile.occupation;
    if (userProfile.highestQualification) p.qualification = userProfile.highestQualification;
    if (userProfile.income?.grossSalary) p.grossSalary = String(userProfile.income.grossSalary);
    if (Object.keys(p).length) setData(x => ({ ...x, ...p }));
  }, [userProfile]);

  const mAge = useMemo(() => {
    const id = data.idNumber;
    return id && isValidSAID(id) ? extractDobFromId(id)?.age ?? null : null;
  }, [data.idNumber]);
  const mBd = mAge !== null ? ageBand(mAge) : '';
  const dTot = deps.reduce((s, x) => s + x.premium, 0);
  const mPrem = opt?.retail_premium ?? 0;
  const tPrem = mPrem + dTot;

  const scroll = useCallback(() => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 150), []);

  const addBot = useCallback((text: string) => {
    setIsTyping(true);
    setTimeout(() => {
      setIsTyping(false);
      setMessages(p => [...p, { id: `b-${Date.now()}-${Math.random()}`, from: 'bot', text }]);
      scroll();
    }, 500 + Math.random() * 300);
  }, [scroll]);

  const addUser = useCallback((text: string) => {
    setMessages(p => [...p, { id: `u-${Date.now()}`, from: 'user', text }]);
    scroll();
  }, [scroll]);

  const fetchRates = useCallback(async () => {
    if (rates) return rates;
    try {
      const s = await get(ref(rtdb, 'ubuntu_rates/rates/3_month'));
      if (s.exists()) { const r = s.val(); setRates(r); return r; }
    } catch (e) { console.error('[FC] rates fetch:', e); }
    return null;
  }, [rates]);

  const depPrem = useCallback((id: string, mt: string, r: any, o: RateOpt) => {
    const a = isValidSAID(id) ? extractDobFromId(id)?.age ?? 0 : 0, b = ageBand(a);
    if (mt === 'spouse' || mt === 'child') return { ageBand: b, coverAmount: o.cover_amount, premium: 0 };
    let rt: any = null;
    if (mt === 'parent') rt = r?.['parents_and_parents_in_law'];
    if (mt === 'extended') rt = r?.['extended_family'];
    if (!rt?.age_bands?.[b]) return { ageBand: b, coverAmount: 0, premium: 0 };
    const bo = rt.age_bands[b], ks = Object.keys(bo).sort((x, y) => parseInt(x.replace('option_', '')) - parseInt(y.replace('option_', '')));
    for (const k of ks) if (bo[k].cover_amount === o.cover_amount) return { ageBand: b, coverAmount: bo[k].cover_amount, premium: bo[k].retail_premium };
    let cl = ks[0]; for (const k of ks) if (bo[k].cover_amount <= o.cover_amount) cl = k;
    if (cl && bo[cl]) return { ageBand: b, coverAmount: bo[cl].cover_amount, premium: bo[cl].retail_premium };
    return { ageBand: b, coverAmount: 0, premium: 0 };
  }, []);

  // ── Step progression ──────────────────────────────────────────────────
  const progressTo = useCallback((step: StepKey, extra?: Record<string, string>) => {
    const m = { ...data, ...extra };
    if (extra) setData(x => ({ ...x, ...extra }));
    setCurrentStep(step);
    switch (step) {
      case 'id_number':
        if (idVerified && m.idNumber) {
          const di = extractDobFromId(m.idNumber), g = extractGenderFromId(m.idNumber);
          addBot(`Verified ✅\n🆔 ${m.idNumber}\n📅 ${di?.dob || ''} • Age: ${di?.age || ''}\n♀♂ ${g || ''}`);
          setData(x => ({ ...x, idNumber: m.idNumber, dob: di?.dob || '', age: String(di?.age || ''), gender: g || '' }));
          setTimeout(() => progressTo('first_name'), 1200);
        } else addBot("Let's start with your <b>SA ID Number</b> (18-65 years). 🆔");
        break;
      case 'first_name':
        if (idVerified && m.firstName) { addBot(`Name: <b>${m.firstName}</b> ✅`); setTimeout(() => progressTo('surname'), 800); }
        else addBot("First name?");
        break;
      case 'surname':
        if (idVerified && m.surname) { addBot(`Surname: <b>${m.surname}</b> ✅`); setTimeout(() => progressTo('phone'), 800); }
        else addBot("Surname?");
        break;
      case 'phone':
        if (m.phone) { addBot(`Phone: <b>${m.phone}</b> ✅`); setTimeout(() => progressTo('marital_status'), 800); }
        else addBot("Cell number? 📱");
        break;
      case 'marital_status': addBot("Marital status?"); break;
      case 'occupation': addBot("Occupation? 💼"); break;
      case 'qualification': addBot("Highest qualification? 🎓"); break;
      case 'gross_salary': addBot("Monthly gross salary? 💰"); break;
      case 'confirm_address': {
        const as = [addr.street, addr.suburb, addr.city, addr.province, addr.postalCode].filter(Boolean).join(', ');
        addBot(as ? `Address on file:\n📍 ${as}\n\nEdit if needed.` : 'Enter your address. 🏡');
        break;
      }
      case 'select_plan': addBot("Choose your plan! ☂️\n\n<b>Ubuntu Family Cover</b> — from R50/mo, RAF Assist + R200 airtime."); break;
      case 'select_cover':
        addBot("Fetching rates... ⏳");
        fetchRates().then(r => {
          if (!r) { addBot("Couldn't load rates."); return; }
          const pk = m.selectedPlan || plan;
          const ab = m.age ? ageBand(parseInt(m.age)) : mBd;
          const os = r[pk] && ab ? bandOpts(r[pk], ab) : [];
          if (!os.length) { addBot("No rates for your age band."); setTimeout(() => progressTo('select_plan'), 1500); return; }
          addBot(`Cover options (Band: ${ab}): 👇\n\n${os.map(o => `• R ${o.cover_amount.toLocaleString()} — ${fR(o.retail_premium)}/mo${o.airtime_benefit > 0 ? ' +R' + o.airtime_benefit + ' airtime' : ''}`).join('\n')}`);
        });
        break;
      case 'ask_deps': addBot("Add dependants (spouse, children, parents)?"); break;
      case 'add_dep': setDD({}); addBot("Fill in dependant details below. 👤"); break;
      case 'dep_loop': addBot(`<b>${deps.length}</b> dependant${deps.length !== 1 ? 's' : ''} added. Add more?`); break;
      case 'beneficiary': addBot("Who receives the payout? Fill in below. 💝"); break;
      case 'collect_bank': addBot("Banking details for DebiCheck. 🏦"); break;
      case 'review_summary': {
        const pl = PLANS.find(p => p.id === (m.selectedPlan || plan))?.label || plan;
        const as = [addr.street, addr.suburb, addr.city, addr.province, addr.postalCode].filter(Boolean).join(', ');
        const ds = deps.length ? deps.map(x => `  • ${x.firstName} ${x.lastName} (${x.relationship}) — R ${x.coverAmount.toLocaleString()} — ${x.premium === 0 ? 'Included' : fR(x.premium)}`).join('\n') : '  None';
        const ba = bSameAddr ? addr : bAddr;
        const bas = [ba.street, ba.suburb, ba.city, ba.province, ba.postalCode].filter(Boolean).join(', ');
        addBot(`📋 Summary\n\n<b>Cover</b>\n  ☂️ ${pl}\n  💰 R ${(opt?.cover_amount ?? 0).toLocaleString()}\n  ${fR(mPrem)}/mo${dTot > 0 ? ' + ' + fR(dTot) + ' deps' : ''}\n  <b>Total: ${fR(tPrem)}/mo</b>\n\n<b>Policyholder</b>\n  👤 ${m.firstName || ''} ${m.surname || ''}\n  🆔 ${m.idNumber || ''}\n  📍 ${as}\n\n<b>Dependants</b>\n${ds}\n\n<b>Beneficiary</b>\n  💝 ${bFN} ${bLN} (${bRl})\n  📍 ${bas}\n\n<b>Debit</b>\n  🏦 ${BANK_OPTIONS.find(b => b.id === bk)?.label || bk} ****${aN.slice(-4)}\n  📅 ${ordDay(cDay)} of each month`);
        break;
      }
      case 'consent_step': addBot("Accept consents and sign with OTP. 📝"); break;
      case 'otp_step': addBot("Enter 6-digit code sent to WhatsApp. 🔐"); break;
      case 'done': break;
    }
  }, [data, addBot, addr, idVerified, fetchRates, plan, mBd, deps, opt, mPrem, dTot, tPrem, bFN, bLN, bRl, bSameAddr, bAddr, bk, aN, cDay]);

  const handleAvatarSelect = useCallback((av: AvatarProfile) => {
    setSelectedAvatar(av);
    setAvatarChosen(true);
    addBot(av.id === 'tshepo' ? `Hey ${firstName}! ☂️ I'm Tshepo — let's get you and your family covered!` : `Hi ${firstName}! ☂️ I'm Palesa — I'll help you find the right funeral cover!`);
    setTimeout(() => progressTo('id_number'), 1500);
  }, [addBot, firstName, progressTo]);

  // ── Button handler ────────────────────────────────────────────────────
  const handleButtonClick = useCallback((optId: string, label: string, field?: string) => {
    addUser(label);
    if (field === 'maritalStatus') { progressTo('occupation', { maritalStatus: optId }); return; }
    if (field === 'qualification') { progressTo('gross_salary', { qualification: optId }); return; }
    if (field === 'plan') { setPlan(optId); progressTo('select_cover', { selectedPlan: optId }); return; }
    if (field === 'wantDeps' || field === 'moreDeps') { progressTo(optId === 'yes' ? 'add_dep' : 'beneficiary'); return; }
  }, [addUser, progressTo]);

  // ── Text submit handler ───────────────────────────────────────────────
  const handleTextSubmit = useCallback(() => {
    const v = inputText.trim();
    if (!v) return;
    addUser(v);
    setInputText('');
    if (currentStep === 'id_number') {
      const c = v.replace(/\D/g, '');
      if (!isValidSAID(c)) { addBot("Invalid ID."); return; }
      const di = extractDobFromId(c), g = extractGenderFromId(c), a = di?.age ?? 0;
      if (a < 18 || a > 65) { addBot(`Age ${a} — must be 18-65.`); return; }
      addBot(`✅ ${di?.dob || ''} • Age: ${a} (${ageBand(a)}) • ${g || ''}`);
      setTimeout(() => progressTo('first_name', { idNumber: c, dob: di?.dob || '', age: String(a), gender: g || '' }), 1200);
      return;
    }
    if (currentStep === 'first_name') { progressTo('surname', { firstName: v }); return; }
    if (currentStep === 'surname') { progressTo('phone', { surname: v }); return; }
    if (currentStep === 'phone') { progressTo('marital_status', { phone: v }); return; }
    if (currentStep === 'occupation') { progressTo('qualification', { occupation: v }); return; }
    if (currentStep === 'gross_salary') {
      const n = v.replace(/\D/g, '');
      if (!n) { addBot("Enter valid amount."); return; }
      progressTo('confirm_address', { grossSalary: n });
      return;
    }
    // Cover selection by number
    if (currentStep === 'select_cover') {
      const pk = data.selectedPlan || plan;
      const ab = data.age ? ageBand(parseInt(data.age)) : mBd;
      if (rates && pk && ab) {
        const os = bandOpts(rates[pk], ab);
        const idx = parseInt(v) - 1;
        if (idx >= 0 && idx < os.length) {
          const o = os[idx];
          setOptKey(o.key); setOpt(o);
          addBot(`✅ R ${o.cover_amount.toLocaleString()} — ${fR(o.retail_premium)}/mo\n📋 ${o.plan_reference}${o.airtime_benefit > 0 ? '\n📱 +R' + o.airtime_benefit + ' airtime' : ''}`);
          setTimeout(() => progressTo('ask_deps'), 1500);
        } else { addBot("Enter a valid option number."); }
      }
      return;
    }
  }, [inputText, currentStep, addUser, addBot, progressTo, data, plan, mBd, rates]);

  // ── Address confirm ───────────────────────────────────────────────────
  const handleAddressConfirm = useCallback(() => {
    if (!addr.street || !addr.city || !addr.province || !addr.postalCode) { setError('Fill required fields.'); return; }
    setError('');
    addUser(`Address: ${[addr.street, addr.suburb, addr.city, addr.province, addr.postalCode].filter(Boolean).join(', ')}`);
    progressTo('select_plan');
  }, [addr, addUser, progressTo]);

  // ── Add dependant ─────────────────────────────────────────────────────
  const handleAddDep = useCallback(() => {
    if (!dd.firstName?.trim() || !dd.lastName?.trim()) { setError('Enter name.'); return; }
    if (!dd.idNumber || !isValidSAID(dd.idNumber)) { setError('Valid SA ID needed.'); return; }
    if (dd.idNumber === data.idNumber) { setError('Cannot match main member.'); return; }
    if (!dd.relationship) { setError('Select relationship.'); return; }
    setError('');
    const mt = ['Spouse'].includes(dd.relationship) ? 'spouse' : ['Son', 'Daughter'].includes(dd.relationship) ? 'child' : ['Mother', 'Father', 'Mother-in-Law', 'Father-in-Law'].includes(dd.relationship) ? 'parent' : 'extended';
    let pr = 0, ca = opt?.cover_amount ?? 0;
    const da = extractDobFromId(dd.idNumber)?.age ?? 0, ab = ageBand(da);
    if (rates && opt && (mt === 'parent' || mt === 'extended')) {
      const p = depPrem(dd.idNumber, mt, rates, opt);
      pr = p.premium; ca = p.coverAmount;
    }
    const nd: Dep = { firstName: dd.firstName, lastName: dd.lastName, idNumber: dd.idNumber, dateOfBirth: extractDobFromId(dd.idNumber)?.dob || '', gender: extractGenderFromId(dd.idNumber) || '', relationship: dd.relationship, memberType: mt, ageBand: ab, coverAmount: ca, premium: pr };
    setDeps(p => [...p, nd]);
    addUser(`Added: ${nd.firstName} ${nd.lastName} (${nd.relationship}) — R ${ca.toLocaleString()} — ${pr === 0 ? 'Included' : fR(pr) + '/mo'}`);
    setDD({});
    setTimeout(() => progressTo('dep_loop'), 500);
  }, [dd, data.idNumber, opt, rates, depPrem, addUser, progressTo]);

  // ── Beneficiary confirm ───────────────────────────────────────────────
  const handleBenConfirm = useCallback(() => {
    if (!bFN.trim() || !bLN.trim()) { setError('Enter name.'); return; }
    if (!bRl) { setError('Select relationship.'); return; }
    const ba = bSameAddr ? addr : bAddr;
    if (!ba.street || !ba.city || !ba.province || !ba.postalCode) { setError('Fill beneficiary address.'); return; }
    setError('');
    addUser(`Beneficiary: ${bFN} ${bLN} (${bRl})`);
    progressTo('collect_bank');
  }, [bFN, bLN, bRl, bSameAddr, addr, bAddr, addUser, progressTo]);

  // ── Bank confirm ──────────────────────────────────────────────────────
  const handleBankConfirm = useCallback(() => {
    if (!bk || !aT || !aN) { setError('Fill banking fields.'); return; }
    setError('');
    addUser(`Bank: ${BANK_OPTIONS.find(b => b.id === bk)?.label || bk}, ****${aN.slice(-4)}`);
    progressTo('review_summary');
  }, [bk, aT, aN, addUser, progressTo]);

  const handleProceed = useCallback(() => { addUser("Confirmed ✅"); progressTo('consent_step'); }, [addUser, progressTo]);

  const ph = userProfile?.phoneNumber || userProfile?.whatsappNumber || data.phone || '';
  const mPh = ph ? ph.slice(0, 3) + '****' + ph.slice(-3) : '';

  // ── OTP ───────────────────────────────────────────────────────────────
  const handleSendOtp = useCallback(async () => {
    setIsLoading(true); setError('');
    try {
      const r = await sendWhatsAppOtp(normalizePhone(ph), 'funeral_cover_authorization' as OtpPurpose);
      if (r.otpId || r.success) { setOtpId(r.otpId); if (r.message) setOtpMsgId(r.message); progressTo('otp_step'); }
      else setError(r.message || 'Failed');
    } catch { setError('Failed.'); }
    finally { setIsLoading(false); }
  }, [ph, progressTo]);

  const handleVerifyOtp = useCallback(async () => {
    if (otpInput.length !== 6) return;
    setIsLoading(true); setError('');
    try {
      const r = await verifyWhatsAppOtp(otpId, otpInput);
      if (r.verified) { addUser("OTP verified ✅"); await handleSubmit(otpInput); }
      else setError(r.message || 'Invalid.');
    } catch { setError('Failed.'); }
    finally { setIsLoading(false); }
  }, [otpId, otpInput]);

  // ── Final Submit ──────────────────────────────────────────────────────
  const handleSubmit = useCallback(async (otp?: string) => {
    if (!user || !userProfile || !opt) return;
    setIsLoading(true); setError(''); setCurrentStep('submitting');
    addBot("Submitting... 🚀");
    try {
      const uid = user.uid, now = new Date().toISOString();
      const pN = data.firstName || '', pS = data.surname || '', full = `${pN} ${pS}`.trim();
      const phone = normalizePhone(data.phone || userProfile.phoneNumber || '');
      const idN = data.idNumber || '', di = extractDobFromId(idN), g = extractGenderFromId(idN);
      const pL = PLANS.find(p => p.id === plan)?.label || plan;
      const bL = BANK_OPTIONS.find(b => b.id === bk)?.label || bk, bc = getUniversalBranchCode(bL);
      const { registrationType, referrerCode, referredBy } = getReferralInfo(userProfile as unknown as Record<string, unknown>);

      const appData = {
        plan, planLabel: pL, coverOption: optKey, coverAmount: opt.cover_amount,
        mainMemberPremium: mPrem, dependantsTotalPremium: dTot, totalMonthlyPremium: tPrem,
        planReference: opt.plan_reference, collectionFee: opt.collection_fee,
        airtimeBenefit: opt.airtime_benefit, automaticBabyCover: opt.automatic_baby_cover,
        waitingPeriod: '3_month', insurer: 'RMA Life Assurance Company Ltd', product: 'Ubuntu Family Cover',
        policyholderName: pN, policyholderSurname: pS, policyholderIdNumber: idN,
        policyholderDob: di?.dob || null, policyholderGender: g || null,
        policyholderAge: di?.age ?? null, policyholderAgeBand: mBd || null,
        policyholderCellphone: phone, policyholderMaritalStatus: data.maritalStatus || '',
        address: { streetAddress: addr.street, suburb: addr.suburb, townOrCity: addr.city, province: addr.province, postalCode: addr.postalCode },
        preferredCommsMethod: 'whatsapp', occupation: data.occupation || '',
        highestQualification: data.qualification || '', grossSalary: data.grossSalary || '',
        livesInsured: [
          { firstName: pN, lastName: pS, idNumber: idN, dateOfBirth: di?.dob || null, gender: g || null, age: di?.age ?? null, ageBand: mBd || null, memberType: 'main_member', coverAmount: opt.cover_amount, premium: mPrem },
          ...deps.map(x => ({ firstName: x.firstName, lastName: x.lastName, idNumber: x.idNumber, dateOfBirth: x.dateOfBirth, gender: x.gender, relationship: x.relationship, memberType: x.memberType, ageBand: x.ageBand, coverAmount: x.coverAmount, premium: x.premium })),
        ],
        beneficiary: { firstName: bFN, lastName: bLN, idNumber: bId, phone: bPh, relationship: bRl,
          address: { streetAddress: (bSameAddr ? addr.street : bAddr.street), suburb: (bSameAddr ? addr.suburb : bAddr.suburb), townOrCity: (bSameAddr ? addr.city : bAddr.city), province: (bSameAddr ? addr.province : bAddr.province), postalCode: (bSameAddr ? addr.postalCode : bAddr.postalCode) }
        },
        bankName: bk, accountType: aT, accountNumber: aN, branchCode: bc || '',
        premiumCollectionDay: cDay,
        broker: '539e44b8-2290-481c-82c7-8d9c936e73bf', brokerName: 'Lebon Consulting',
        brokerageName: 'Lebon Consulting',
        status: 'application_submitted', applicationSubmittedAt: now, createdAt: now, updatedAt: now,
      };

      await updateUserProfile({ idNumber: idN, firstName: pN, lastName: pS, fullName: full, maritalStatus: data.maritalStatus, occupation: data.occupation, highestQualification: data.qualification, applicationSubmittedAt: now, updatedAt: now } as any);

      const cR = doc(collection(db, 'profiles', uid, 'consents'));
      await setDoc(cR, { consentId: cR.id, consentType: 'funeral_cover_authorization', fullName: full, surname: pS, idNumber: idN, clientPhone: phone, popiaConsent: true, debicheckConsent: true, whatsAppContactConsent: true, otpVerified: true, otpCode: otpId, otpVerifiedAt: now, consentGrantedAt: now, messageId: otpMsgId || null, purpose: 'Funeral Cover Authorization', status: 'active', channel: 'chat_mode', createdAt: now });

      await submitProductApplication({ uid, productType: 'funeral_cover', productName: 'Funeral Cover', productDescription: `Ubuntu Family Cover — ${pL}`, status: 'applied', statusLabel: 'Application Submitted', applicationData: appData as unknown as Record<string, unknown>, consent: { consentId: cR.id, consentType: 'funeral_cover_authorization', otpVerified: true, otpCode: otpId, otpMessageId: otpMsgId || null, otpVerifiedAt: now, consentGrantedAt: now, messageId: otpMsgId || null }, reference: `FC-${uid.slice(0, 6)}-${cR.id}`, idNumber: idN, waId: userProfile.waId || null, email: userProfile.email, clientName: full, amount: tPrem, registrationType, referrerCode, referredBy });

      setCurrentStep('done');
      addBot(`🎉 Submitted! Ref: FC-${uid.slice(0, 6)}-${cR.id}\n☂️ R ${opt.cover_amount.toLocaleString()} cover\n💰 ${fR(tPrem)}/mo\n\nTrack in "My Products".`);
    } catch (e) { console.error('[FC]', e); setError('Failed.'); setCurrentStep('consent_step'); }
    finally { setIsLoading(false); }
  }, [user, userProfile, opt, plan, optKey, data, addr, deps, bFN, bLN, bId, bPh, bRl, bSameAddr, bAddr, bk, aT, aN, cDay, otpId, otpMsgId, mPrem, dTot, tPrem, mBd, addBot, updateUserProfile]);

  // ── Should show text input? ───────────────────────────────────────────
  const textSteps: StepKey[] = ['id_number', 'first_name', 'surname', 'phone', 'occupation', 'gross_salary', 'select_cover'];
  const showTextInput = textSteps.includes(currentStep);

  // ── Should show buttons? ──────────────────────────────────────────────
  const buttonConfigs: Partial<Record<StepKey, { options: { id: string; label: string; icon?: string }[]; field: string }>> = {
    marital_status: { options: MARITAL_STATUS_OPTIONS.map(x => ({ id: x, label: x })), field: 'maritalStatus' },
    qualification: { options: QUALIFICATION_OPTIONS.map(q => ({ id: q.id, label: q.label })), field: 'qualification' },
    select_plan: { options: PLANS.map(p => ({ id: p.id, label: p.label, icon: p.icon })), field: 'plan' },
    ask_deps: { options: [{ id: 'yes', label: 'Yes, add dependants', icon: '👨‍👩‍👧‍👦' }, { id: 'no', label: 'Skip to beneficiary', icon: '⏭️' }], field: 'wantDeps' },
    dep_loop: { options: [{ id: 'yes', label: 'Add another', icon: '➕' }, { id: 'no', label: 'Continue', icon: '✅' }], field: 'moreDeps' },
  };
  const currentButtons = buttonConfigs[currentStep];

  return (
    <ProfileGuard>
      <SafeAreaView style={styles.container} edges={['top']}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          {/* Avatar selection */}
          {!avatarChosen && (
            <ScrollView contentContainerStyle={styles.avatarScroll}>
              <View style={styles.avatarCard}>
                <View style={styles.avatarBadge}>
                  <Ionicons name="umbrella" size={13} color={ACCENT} />
                  <Text style={styles.avatarBadgeText}>Funeral Cover — Chat Mode</Text>
                </View>
                <Text style={styles.avatarTitle}>Choose Your Assistant</Text>
                <Text style={styles.avatarSubtitle}>Pick who you'd like to guide you through your funeral cover application.</Text>
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

          {/* Chat container */}
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
                  <Text style={styles.headerSub}>Funeral Cover — Application</Text>
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
                    {msg.from === 'bot' && <AvatarImage avatar={selectedAvatar} size={24} />}
                    <View style={msg.from === 'bot' ? styles.bubbleBot : styles.bubbleUser}>
                      <BoldText text={msg.text} />
                    </View>
                  </View>
                ))}

                {isTyping && (
                  <View style={[styles.msgRow, styles.msgRowBot]}>
                    <AvatarImage avatar={selectedAvatar} size={24} />
                    <View style={styles.bubbleBot}><Text style={styles.typingDots}>• • •</Text></View>
                  </View>
                )}

                {/* Buttons */}
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

                {/* Add dependant form */}
                {currentStep === 'add_dep' && (
                  <View style={styles.inlineCard}>
                    <Text style={styles.inlineTitle}>👤 Add Dependant</Text>
                    <TextInput style={styles.inlineInput} placeholder="First Name *" value={dd.firstName || ''} onChangeText={v => setDD({ ...dd, firstName: v })} />
                    <TextInput style={styles.inlineInput} placeholder="Surname *" value={dd.lastName || ''} onChangeText={v => setDD({ ...dd, lastName: v })} />
                    <TextInput style={styles.inlineInput} placeholder="SA ID (13 digits) *" value={dd.idNumber || ''} onChangeText={v => setDD({ ...dd, idNumber: v.replace(/\D/g, '') })} maxLength={13} keyboardType="number-pad" />
                    {dd.idNumber && isValidSAID(dd.idNumber) && (
                      <Text style={{ color: '#15803d', fontSize: 12, marginBottom: 6 }}>✓ Age: {extractDobFromId(dd.idNumber)?.age} • {extractGenderFromId(dd.idNumber)}</Text>
                    )}
                    <View style={styles.pickerWrap}>
                      {RELS.map(r => (
                        <TouchableOpacity key={r} style={[styles.relBtn, dd.relationship === r && styles.relBtnActive]} onPress={() => setDD({ ...dd, relationship: r })}>
                          <Text style={[styles.relBtnText, dd.relationship === r && styles.relBtnTextActive]}>{r}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    {error ? <Text style={styles.errorText}>{error}</Text> : null}
                    <TouchableOpacity style={styles.confirmBtn} onPress={handleAddDep}><Text style={styles.confirmBtnText}>Add Dependant</Text></TouchableOpacity>
                  </View>
                )}

                {/* Beneficiary form */}
                {currentStep === 'beneficiary' && (
                  <View style={styles.inlineCard}>
                    <Text style={styles.inlineTitle}>💝 Beneficiary</Text>
                    <TextInput style={styles.inlineInput} placeholder="First Name *" value={bFN} onChangeText={setBFN} />
                    <TextInput style={styles.inlineInput} placeholder="Last Name *" value={bLN} onChangeText={setBLN} />
                    <TextInput style={styles.inlineInput} placeholder="SA ID (optional)" value={bId} onChangeText={v => setBId(v.replace(/\D/g, ''))} maxLength={13} keyboardType="number-pad" />
                    <TextInput style={styles.inlineInput} placeholder="Phone" value={bPh} onChangeText={setBPh} keyboardType="phone-pad" />
                    <View style={styles.pickerWrap}>
                      {RELS.map(r => (
                        <TouchableOpacity key={r} style={[styles.relBtn, bRl === r && styles.relBtnActive]} onPress={() => setBRl(r)}>
                          <Text style={[styles.relBtnText, bRl === r && styles.relBtnTextActive]}>{r}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 8, gap: 8 }}>
                      <Switch value={bSameAddr} onValueChange={v => { setBSameAddr(v); if (v) setBAddr({ street: '', suburb: '', city: '', province: '', postalCode: '' }); }} trackColor={{ true: ACCENT }} />
                      <Text style={{ fontSize: 13, color: '#374151' }}>Same as my address</Text>
                    </View>
                    {!bSameAddr && (
                      <>
                        <TextInput style={styles.inlineInput} placeholder="Street *" value={bAddr.street} onChangeText={v => setBAddr({ ...bAddr, street: v })} />
                        <TextInput style={styles.inlineInput} placeholder="City *" value={bAddr.city} onChangeText={v => setBAddr({ ...bAddr, city: v })} />
                        <TextInput style={styles.inlineInput} placeholder="Province *" value={bAddr.province} onChangeText={v => setBAddr({ ...bAddr, province: v })} />
                        <TextInput style={styles.inlineInput} placeholder="Postal Code *" value={bAddr.postalCode} onChangeText={v => setBAddr({ ...bAddr, postalCode: v.replace(/\D/g, '') })} maxLength={4} keyboardType="number-pad" />
                      </>
                    )}
                    {error ? <Text style={styles.errorText}>{error}</Text> : null}
                    <TouchableOpacity style={styles.confirmBtn} onPress={handleBenConfirm}><Text style={styles.confirmBtnText}>Confirm Beneficiary</Text></TouchableOpacity>
                  </View>
                )}

                {/* Bank form */}
                {currentStep === 'collect_bank' && (
                  <View style={styles.inlineCard}>
                    <Text style={styles.inlineTitle}>🏦 Debit Order</Text>
                    <View style={styles.pickerWrap}>
                      {BANK_OPTIONS.map(b => (
                        <TouchableOpacity key={b.id} style={[styles.relBtn, bk === b.id && styles.relBtnActive]} onPress={() => setBk(b.id)}>
                          <Text style={[styles.relBtnText, bk === b.id && styles.relBtnTextActive]}>{b.label}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    <View style={styles.pickerWrap}>
                      {ACCOUNT_TYPE_OPTIONS.map(a => (
                        <TouchableOpacity key={a.id} style={[styles.relBtn, aT === a.id && styles.relBtnActive]} onPress={() => setAT(a.id)}>
                          <Text style={[styles.relBtnText, aT === a.id && styles.relBtnTextActive]}>{a.label}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    <TextInput style={styles.inlineInput} placeholder="Account Number *" value={aN} onChangeText={v => setAN(v.replace(/\D/g, ''))} keyboardType="number-pad" />
                    {tPrem > 0 && (
                      <View style={{ backgroundColor: ACCENT_BG, borderRadius: 8, padding: 12, marginBottom: 8 }}>
                        <Text style={{ fontSize: 12, color: '#6b7280' }}>Monthly Debit</Text>
                        <Text style={{ fontSize: 18, fontWeight: '800', color: ACCENT_DARK }}>{fR(tPrem)}</Text>
                      </View>
                    )}
                    {error ? <Text style={styles.errorText}>{error}</Text> : null}
                    <TouchableOpacity style={styles.confirmBtn} onPress={handleBankConfirm}><Text style={styles.confirmBtnText}>Continue</Text></TouchableOpacity>
                  </View>
                )}

                {/* Review summary */}
                {currentStep === 'review_summary' && (
                  <View style={{ paddingHorizontal: 8, marginTop: 8, gap: 8 }}>
                    <TouchableOpacity style={styles.confirmBtn} onPress={handleProceed}><Text style={styles.confirmBtnText}>✅ Confirm & Proceed</Text></TouchableOpacity>
                  </View>
                )}

                {/* Consent form */}
                {currentStep === 'consent_step' && (
                  <View style={styles.inlineCard}>
                    <Text style={styles.inlineTitle}>📝 Consent</Text>
                    <TouchableOpacity style={styles.checkRow} onPress={() => setPopiaConsent(!popiaConsent)}>
                      <Ionicons name={popiaConsent ? 'checkbox' : 'square-outline'} size={20} color={ACCENT} />
                      <Text style={styles.checkText}>I consent to POPIA processing.</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.checkRow} onPress={() => setFuneralConsent(!funeralConsent)}>
                      <Ionicons name={funeralConsent ? 'checkbox' : 'square-outline'} size={20} color={ACCENT} />
                      <Text style={styles.checkText}>I authorise funeral cover processing.</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.checkRow} onPress={() => setDebicheckConsent(!debicheckConsent)}>
                      <Ionicons name={debicheckConsent ? 'checkbox' : 'square-outline'} size={20} color={ACCENT} />
                      <Text style={styles.checkText}>I accept the DebiCheck mandate ({ordDay(cDay)} of each month).</Text>
                    </TouchableOpacity>
                    {mPh ? <Text style={{ fontSize: 12, color: '#6b7280', marginTop: 8 }}>Code will be sent to {mPh}</Text> : null}
                    {error ? <Text style={styles.errorText}>{error}</Text> : null}
                    <TouchableOpacity
                      style={[styles.confirmBtn, !(popiaConsent && funeralConsent && debicheckConsent) && { opacity: 0.5 }]}
                      onPress={handleSendOtp}
                      disabled={!(popiaConsent && funeralConsent && debicheckConsent) || isLoading}
                    >
                      {isLoading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.confirmBtnText}>Send OTP</Text>}
                    </TouchableOpacity>
                  </View>
                )}

                {/* OTP form */}
                {currentStep === 'otp_step' && (
                  <View style={styles.inlineCard}>
                    <Text style={styles.inlineTitle}>🔐 Enter Code</Text>
                    <Text style={{ fontSize: 12, color: '#6b7280', marginBottom: 12 }}>Sent to {mPh}</Text>
                    <TextInput style={[styles.inlineInput, { textAlign: 'center', letterSpacing: 8, fontSize: 20, fontWeight: '700' }]} value={otpInput} onChangeText={v => setOtpInput(v.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" maxLength={6} placeholder="000000" />
                    {error ? <Text style={styles.errorText}>{error}</Text> : null}
                    <TouchableOpacity
                      style={[styles.confirmBtn, otpInput.length !== 6 && { opacity: 0.5 }]}
                      onPress={handleVerifyOtp}
                      disabled={otpInput.length !== 6 || isLoading}
                    >
                      {isLoading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.confirmBtnText}>Verify & Submit</Text>}
                    </TouchableOpacity>
                  </View>
                )}

                {/* Done */}
                {currentStep === 'done' && (
                  <View style={{ paddingHorizontal: 8, marginTop: 12, gap: 8 }}>
                    <TouchableOpacity style={styles.confirmBtn} onPress={() => router.replace('/(tabs)')}>
                      <Text style={styles.confirmBtnText}>📋 View My Products</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.confirmBtn, { backgroundColor: '#fff', borderWidth: 1.5, borderColor: ACCENT }]} onPress={() => router.replace('/(tabs)')}>
                      <Text style={[styles.confirmBtnText, { color: ACCENT }]}>Dashboard</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {currentStep === 'submitting' && (
                  <View style={{ alignItems: 'center', padding: 20 }}>
                    <ActivityIndicator size="large" color={ACCENT} />
                    <Text style={{ marginTop: 12, color: '#6b7280' }}>Processing your application...</Text>
                  </View>
                )}
              </ScrollView>

              {/* Text input bar */}
              {showTextInput && (
                <View style={styles.inputBar}>
                  <TextInput
                    style={styles.textInput}
                    value={inputText}
                    onChangeText={setInputText}
                    placeholder={currentStep === 'select_cover' ? 'Enter option number...' : 'Type your answer...'}
                    onSubmitEditing={handleTextSubmit}
                    returnKeyType="send"
                    keyboardType={['id_number', 'phone', 'gross_salary', 'select_cover'].includes(currentStep) ? 'number-pad' : 'default'}
                  />
                  <TouchableOpacity style={[styles.sendBtn, !inputText.trim() && { opacity: 0.4 }]} onPress={handleTextSubmit} disabled={!inputText.trim()}>
                    <Ionicons name="send" size={18} color="#fff" />
                  </TouchableOpacity>
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
  bubbleUser: { backgroundColor: '#ede9fe', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderBottomRightRadius: 2, maxWidth: '75%' },
  msgText: { fontSize: 14, lineHeight: 20, color: '#111827' },
  typingDots: { fontSize: 16, color: '#9ca3af', letterSpacing: 2 },
  buttonsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 4, marginTop: 6 },
  optionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, borderWidth: 1.5, borderColor: '#ddd6fe', backgroundColor: ACCENT_BG },
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
  feeNote: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#fffbeb', borderRadius: 8, padding: 10, borderWidth: 1, borderColor: '#fde68a', marginTop: 16 },
  feeNoteText: { flex: 1, fontSize: 11, color: '#92400e', lineHeight: 16 },
});
