import { httpsCallable } from 'firebase/functions';
import { doc, setDoc, collection } from 'firebase/firestore';
import { functions, db } from './firebase';

// ── SA ID Number Validation (Luhn algorithm for 13-digit SA IDs) ───────

export function isValidSAID(id: string): boolean {
  if (!/^\d{13}$/.test(id)) return false;
  let sum = 0;
  for (let i = 0; i < 13; i++) {
    let digit = parseInt(id[i]);
    if (i % 2 !== 0) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  return sum % 10 === 0;
}

export function extractDobFromId(id: string): { dob: string; age: number } | null {
  if (id.length < 6) return null;
  const yy = parseInt(id.substring(0, 2));
  const mm = parseInt(id.substring(2, 4));
  const dd = parseInt(id.substring(4, 6));
  const year = yy >= 0 && yy <= 30 ? 2000 + yy : 1900 + yy;
  const dob = `${year}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
  const today = new Date();
  let age = today.getFullYear() - year;
  const monthDiff = today.getMonth() + 1 - mm;
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dd)) age--;
  return { dob, age };
}

export function extractGenderFromId(id: string): string | null {
  if (id.length < 10) return null;
  const genderDigits = parseInt(id.substring(6, 10));
  return genderDigits >= 5000 ? 'Male' : 'Female';
}

export function generateClientId(): string {
  return `CL-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
}

// ── Phone Number Validation & Normalization ───────────────────────────

export function isValidPhone(phone: string): boolean {
  const cleaned = phone.replace(/[\s\-\(\)]/g, '');
  if (/^0\d{9}$/.test(cleaned)) return true;
  if (/^\+27\d{9}$/.test(cleaned)) return true;
  if (/^27\d{9}$/.test(cleaned)) return true;
  return false;
}

export function normalizePhone(phone: string): string {
  let cleaned = phone.replace(/[\s\-\(\)]/g, '');
  if (cleaned.startsWith('+')) return cleaned;
  if (cleaned.startsWith('0') && cleaned.length === 10) return '+27' + cleaned.slice(1);
  if (cleaned.startsWith('27') && cleaned.length === 11) return '+' + cleaned;
  return '+' + cleaned;
}

// ── WhatsApp OTP (Firebase Callable Cloud Functions) ──────────────────

export type OtpPurpose =
  | 'credit_report'
  | 'life_insurance_authorization'
  | 'loan_application_authorization'
  | 'retirement_annuity_authorization'
  | 'tax_free_savings_authorization'
  | 'wills_estates_authorization'
  | 'funeral_cover_authorization'
  | 'car_insurance_authorization'
  | 'home_insurance_authorization'
  | 'general_consent';

export interface SendOtpResult {
  success: boolean;
  otpId: string;
  expiresAt: string;
  message: string;
}

export interface VerifyOtpResult {
  success: boolean;
  verified: boolean;
  verifiedAt?: string;
  waId?: string;
  purpose?: string;
  attemptsRemaining?: number;
  message: string;
}

export async function sendWhatsAppOtp(
  phoneNumber: string,
  purpose: OtpPurpose,
): Promise<SendOtpResult> {
  const fn = httpsCallable<{ phoneNumber: string; purpose: string }, SendOtpResult>(
    functions, 'sendWhatsAppOtp',
  );
  const result = await fn({ phoneNumber, purpose });
  return result.data;
}

export async function verifyWhatsAppOtp(
  otpId: string,
  otpCode: string,
): Promise<VerifyOtpResult> {
  const fn = httpsCallable<{ otpId: string; otpCode: string }, VerifyOtpResult>(
    functions, 'verifyWhatsAppOtp',
  );
  const result = await fn({ otpId, otpCode });
  return result.data;
}

// ── Payment Gateway (Firebase Callable → PayFast) ─────────────────────

export interface GeneratePaymentResult {
  success: boolean;
  paymentId: string;
  paymentUrl: string;
  amount: string;
  itemName: string;
}

export async function generatePaymentLink(params: {
  amount: number;
  itemName: string;
  itemDescription?: string;
  reference?: string;
  productType?: string;
}): Promise<GeneratePaymentResult> {
  const fn = httpsCallable<typeof params, GeneratePaymentResult>(
    functions, 'generatePaymentLink',
  );
  const result = await fn(params);
  return result.data;
}

const PAYMENT_STATUS_BASE_URL =
  'https://mybenefitz-payment-service-867203198671.africa-south1.run.app/api/payments/link-status';

export async function pollPaymentStatus(
  paymentId: string,
  maxAttempts = 60,
  intervalMs = 5000,
): Promise<{ complete: boolean; status: string }> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await fetch(`${PAYMENT_STATUS_BASE_URL}/${paymentId}`);
      const data = await res.json();
      if (data.isComplete) return { complete: true, status: 'COMPLETE' };
      if (data.status === 'CANCELLED') return { complete: false, status: 'CANCELLED' };
    } catch { /* network glitch — retry */ }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return { complete: false, status: 'TIMEOUT' };
}

// ── Constants ──────────────────────────────────────────────────────────

export const CONSENT_FORM_URL =
  'https://africa-south1-my-benefits-portal-463t8v.cloudfunctions.net/generate-consent-form';

export const SA_PROVINCES = [
  'Eastern Cape', 'Free State', 'Gauteng', 'KwaZulu-Natal',
  'Limpopo', 'Mpumalanga', 'North West', 'Northern Cape', 'Western Cape',
];

export const TITLE_OPTIONS = ['Mr', 'Mrs', 'Ms', 'Dr', 'Prof'];

export const MARITAL_STATUS_OPTIONS = ['Single', 'Married', 'Divorced', 'Widowed', 'Separated'];

export const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

export const BANK_OPTIONS = [
  { id: 'absa', label: 'ABSA' },
  { id: 'capitec', label: 'Capitec' },
  { id: 'fnb', label: 'FNB' },
  { id: 'nedbank', label: 'Nedbank' },
  { id: 'standard_bank', label: 'Standard Bank' },
  { id: 'african_bank', label: 'African Bank' },
  { id: 'investec', label: 'Investec' },
  { id: 'discovery_bank', label: 'Discovery Bank' },
  { id: 'tymebank', label: 'TymeBank' },
  { id: 'other', label: 'Other' },
];

export const ACCOUNT_TYPE_OPTIONS = [
  { id: 'cheque', label: 'Cheque / Current' },
  { id: 'savings', label: 'Savings' },
  { id: 'transmission', label: 'Transmission' },
];

export const QUALIFICATION_OPTIONS = [
  { id: 'below_matric', label: 'Below Matric' },
  { id: 'matric', label: 'Matric / Grade 12' },
  { id: 'certificate', label: 'Certificate' },
  { id: 'diploma', label: 'Diploma' },
  { id: 'degree', label: "Bachelor's Degree" },
  { id: 'honours', label: 'Honours Degree' },
  { id: 'masters', label: "Master's Degree" },
  { id: 'doctorate', label: 'Doctorate' },
];

export const COVER_TYPE_OPTIONS = [
  { id: 'main_member_only', label: 'Main Member Only' },
  { id: 'member_and_spouse', label: 'Member & Spouse' },
  { id: 'member_and_up_to_6_children', label: 'Member & Up to 6 Children' },
  { id: 'member_spouse_and_up_to_6_children', label: 'Member, Spouse & Up to 6 Children' },
  { id: 'member_spouse_6_children_4_parents_and_4_other_members', label: 'Family Plan (Full)' },
  { id: 'parents_and_parents_in_law', label: 'Parents & Parents-in-Law' },
  { id: 'extended_family', label: 'Extended Family' },
];

export const EMPLOYMENT_TYPE_OPTIONS = [
  { id: 'permanent', label: 'Permanent' },
  { id: 'contract', label: 'Contract' },
  { id: 'self_employed', label: 'Self-Employed' },
  { id: 'part_time', label: 'Part Time' },
  { id: 'unemployed', label: 'Unemployed' },
];

export const LOAN_QUALIFICATION_OPTIONS = [
  { id: 'less_than_matric', label: 'Less than Matric' },
  { id: 'matric', label: 'Matric' },
  { id: 'higher_certificate', label: 'Higher Certificate' },
  { id: 'diploma', label: 'Diploma' },
  { id: 'degree', label: 'Degree' },
  { id: 'honours', label: 'Honours' },
  { id: 'masters', label: 'Masters' },
  { id: 'doctorate', label: 'Doctorate' },
];

export const PREFERRED_CONTACT_OPTIONS = [
  { id: 'whatsapp', label: 'WhatsApp' },
  { id: 'email', label: 'Email' },
];

export const CONTRIBUTION_FREQUENCY_OPTIONS = [
  { id: 'monthly', label: 'Monthly' },
  { id: 'quarterly', label: 'Quarterly' },
  { id: 'half_yearly', label: 'Half-Yearly' },
  { id: 'yearly', label: 'Yearly' },
];

export const ESCALATION_TYPE_OPTIONS = [
  { id: 'none', label: 'No Escalation' },
  { id: 'fixed_percentage', label: 'Fixed Percentage' },
  { id: 'cpi', label: 'CPI (Consumer Price Index)' },
];

export const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

export function getTfsMaxContribution(frequency: string): number {
  switch (frequency) {
    case 'monthly': return 3000;
    case 'quarterly': return 9000;
    case 'half_yearly': return 18000;
    case 'yearly': return 36000;
    default: return 3000;
  }
}

export function formatCurrency(amount: number): string {
  return `R ${amount.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`;
}

export const getUniversalBranchCode = (bankName?: string | null): string | null => {
  switch (bankName?.toLowerCase()) {
    case 'absa': case 'absa bank': return '632005';
    case 'capitec': case 'capitec bank': return '470010';
    case 'fnb': case 'first national bank': return '250655';
    case 'nedbank': return '198765';
    case 'standard bank': return '051001';
    case 'african bank': return '430000';
    case 'investec': return '580105';
    case 'discovery bank': return '679000';
    case 'tymebank': case 'tyme bank': return '678910';
    default: return null;
  }
};

export function getReferralInfo(userProfile: Record<string, unknown>): {
  registrationType: string;
  referrerCode: string;
  referredBy: string;
} {
  const registrationType = (userProfile?.registrationType as string) ||
    (userProfile?.referrerCode || userProfile?.referredBy ? 'referred' : 'direct');
  const code = (userProfile?.referrerCode || userProfile?.referredBy) as string | undefined;
  return {
    registrationType,
    referrerCode: code || 'direct',
    referredBy: code || 'direct',
  };
}

// ── Dual-Write Product Application Helper ─────────────────────────────
export interface SubmitProductApplicationParams {
  uid: string;
  productType: string;
  productName: string;
  productDescription: string;
  status: string;
  statusLabel: string;
  applicationData: Record<string, unknown>;
  consent: {
    consentId: string;
    consentType: string;
    otpVerified: boolean;
    otpCode: string;
    otpMessageId: string | null;
    otpVerifiedAt: string;
    consentGrantedAt: string;
    messageId: string | null;
  };
  consentFormDocumentUrl?: string | null;
  consentFormUid?: string | null;
  consentFormDocumentHash?: string | null;
  reference: string;
  idNumber: string;
  waId: string | null;
  email: string | null;
  clientName: string;
  paymentId?: string | null;
  amount?: number | null;
  registrationType: string;
  referrerCode: string;
  referredBy: string;
}

export interface SubmitProductApplicationResult {
  applicationId: string;
}

export async function submitProductApplication(
  params: SubmitProductApplicationParams,
): Promise<SubmitProductApplicationResult> {
  const now = new Date().toISOString();

  // 1. Write to applications subcollection
  const appRef = doc(collection(db, 'profiles', params.uid, 'applications'));
  await setDoc(appRef, {
    productType: params.productType,
    status: params.status,
    statusLabel: params.statusLabel,
    applicationData: params.applicationData,
    consent: params.consent,
    consentFormDocumentUrl: params.consentFormDocumentUrl || null,
    consentFormUid: params.consentFormUid || null,
    consentFormDocumentHash: params.consentFormDocumentHash || null,
    reference: params.reference,
    channel: 'mobile_app',
    source: 'mobile_app',
    referrerCode: params.referrerCode || null,
    registrationType: params.registrationType,
    paymentId: params.paymentId || null,
    amount: params.amount ?? null,
    paidAt: null,
    createdAt: now,
    updatedAt: now,
    completedAt: null,
  });

  // 2. Update activeProducts summary on profile
  const profileRef = doc(db, 'profiles', params.uid);
  await setDoc(profileRef, {
    [`activeProducts.${params.productType}`]: {
      latestApplicationId: appRef.id,
      status: params.status,
      appliedAt: now,
    },
    activeProduct: params.productType,
    updatedAt: now,
  }, { merge: true });

  return { applicationId: appRef.id };
}
