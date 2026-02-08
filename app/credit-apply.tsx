import { useState } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { Colors } from '../constants/Colors';

const TOTAL_STEPS = 5;

const stepLabels = [
  'ID Number',
  'POPIA Consent',
  'Terms & Conditions',
  'Payment',
  'Complete',
];

export default function CreditApplyScreen() {
  const router = useRouter();
  const { userProfile, updateUserProfile } = useAuth();

  const [step, setStep] = useState(1);
  const [idNumber, setIdNumber] = useState(userProfile?.idNumber || '');
  const [popiaAccepted, setPopiaAccepted] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [processing, setProcessing] = useState(false);

  const canProceed = () => {
    switch (step) {
      case 1: return idNumber.length === 13;
      case 2: return popiaAccepted;
      case 3: return termsAccepted;
      case 4: return true;
      default: return false;
    }
  };

  const handleNext = async () => {
    if (step === 1 && idNumber.length !== 13) {
      Alert.alert('Invalid ID', 'Please enter a valid 13-digit South African ID number.');
      return;
    }
    if (step === 4) {
      setProcessing(true);
      try {
        await updateUserProfile({
          idNumber,
          updatedAt: new Date().toISOString(),
        });
        // Simulate payment processing
        await new Promise((resolve) => setTimeout(resolve, 2000));
        setStep(5);
      } catch {
        Alert.alert('Error', 'Something went wrong. Please try again.');
      } finally {
        setProcessing(false);
      }
      return;
    }
    setStep((s) => s + 1);
  };

  const handleBack = () => {
    if (step === 1) {
      router.back();
    } else {
      setStep((s) => s - 1);
    }
  };

  return (
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
          </View>
        )}

        {/* ── Step 2: POPIA Consent ── */}
        {step === 2 && (
          <View style={styles.stepContainer}>
            <View style={styles.stepIconCircle}>
              <Ionicons name="lock-closed" size={28} color={Colors.primary.blue} />
            </View>
            <Text style={styles.stepTitle}>POPIA Consent</Text>
            <Text style={styles.stepDesc}>Permission for us to process your information for this service.</Text>

            <View style={styles.consentCard}>
              <Text style={styles.consentText}>
                I hereby consent to MyBenefitz (Pty) Ltd processing my personal information, including my identity number and credit information, for the purposes of providing the MyCreditClinic Credit Report Assessment service.
              </Text>
              <Text style={styles.consentText}>
                This consent is given in accordance with the Protection of Personal Information Act (POPIA). I understand that my information will be processed securely and only for the stated purpose.
              </Text>
              <Text style={styles.consentText}>
                I may withdraw my consent at any time by contacting support@mybenefitz.co.za, subject to legal and contractual obligations.
              </Text>
            </View>

            <TouchableOpacity style={styles.checkboxRow} onPress={() => setPopiaAccepted(!popiaAccepted)} activeOpacity={0.7}>
              <View style={[styles.checkbox, popiaAccepted && styles.checkboxChecked]}>
                {popiaAccepted && <Ionicons name="checkmark" size={16} color="#fff" />}
              </View>
              <Text style={styles.checkboxLabel}>I provide my POPIA consent</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Step 3: Terms & Conditions ── */}
        {step === 3 && (
          <View style={styles.stepContainer}>
            <View style={styles.stepIconCircle}>
              <Ionicons name="document-text" size={28} color={Colors.primary.blue} />
            </View>
            <Text style={styles.stepTitle}>Terms & Conditions</Text>
            <Text style={styles.stepDesc}>Please read and accept the service terms.</Text>

            <View style={styles.termsCard}>
              <TermItem num="1" text="No guaranteed removals: We cannot remove valid/accurate listings or guarantee any score outcome." />
              <TermItem num="2" text="Truthful information: You confirm that all information you provide is true, accurate, and yours to share." />
              <TermItem num="3" text="ID verification: You consent to us verifying your identity and information. If the ID does not belong to you or fraud is suspected, your access may be blocked." />
              <TermItem num="4" text="Fraud/impersonation: If you provide false details, impersonate someone, or submit fraudulent documents, you may forfeit your payment, be blocked, and the matter may be escalated where appropriate." />
              <TermItem num="5" text="Assessment fee is payable: The R99 Credit Report Assessment is a once-off fee for the assessment service and remains payable even if you decline further services afterward." />
              <TermItem num="6" text="Your responsibility: You are responsible for providing required documents and responding to requests; delays in response may delay outcomes." />
              <TermItem num="7" text="Evidence-based disputes only: Where disputes are submitted, they will be done only where evidence supports the correction of inaccurate information." />
              <TermItem num="8" text="Not debt counselling: We are not a debt counselling company and we do not place clients under debt counselling / debt review." />
              <TermItem num="9" text="Third-party timelines: Where third parties are involved (credit bureaus, creditors, attorneys), outcomes and timelines are influenced by their processes. We can track and follow up, but we can't control their turnaround time." />
              <TermItem num="10" text="Consent & privacy: You consent to processing your data for this service in line with POPIA, and you understand we use secure channels to the extent possible; you should protect your WhatsApp device and messages." />
            </View>

            <TouchableOpacity style={styles.checkboxRow} onPress={() => setTermsAccepted(!termsAccepted)} activeOpacity={0.7}>
              <View style={[styles.checkbox, termsAccepted && styles.checkboxChecked]}>
                {termsAccepted && <Ionicons name="checkmark" size={16} color="#fff" />}
              </View>
              <Text style={styles.checkboxLabel}>I accept the Terms & Conditions</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Step 4: Payment ── */}
        {step === 4 && (
          <View style={styles.stepContainer}>
            <View style={styles.stepIconCircle}>
              <Ionicons name="card" size={28} color={Colors.primary.blue} />
            </View>
            <Text style={styles.stepTitle}>Payment</Text>
            <Text style={styles.stepDesc}>Credit Report Assessment — once-off fee</Text>

            <View style={styles.paymentSummary}>
              <View style={styles.paymentRow}>
                <Text style={styles.paymentLabel}>Credit Report Assessment</Text>
                <Text style={styles.paymentAmount}>R99.00</Text>
              </View>
              <View style={styles.paymentDivider} />
              <View style={styles.paymentRow}>
                <Text style={styles.paymentTotalLabel}>Total</Text>
                <Text style={styles.paymentTotalAmount}>R99.00</Text>
              </View>
            </View>

            <View style={styles.paymentNote}>
              <Ionicons name="shield-checkmark" size={16} color={Colors.status.success} />
              <Text style={styles.paymentNoteText}>Secure payment processing. Your card details are never stored.</Text>
            </View>
          </View>
        )}

        {/* ── Step 5: Complete ── */}
        {step === 5 && (
          <View style={styles.stepContainer}>
            <View style={[styles.stepIconCircle, { backgroundColor: Colors.status.success + '15' }]}>
              <Ionicons name="checkmark-circle" size={36} color={Colors.status.success} />
            </View>
            <Text style={styles.stepTitle}>Application Submitted!</Text>
            <Text style={styles.stepDesc}>
              Your Credit Report Assessment has been initiated. We'll process your assessment and share it with you via WhatsApp, along with your recommended next steps.
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
                <Text style={styles.nextBtnText}>{step === 4 ? 'Pay R99' : 'Continue'}</Text>
                <Ionicons name="arrow-forward" size={18} color="#fff" />
              </>
            )}
          </TouchableOpacity>
        </View>
      )}
    </KeyboardAvoidingView>
    </SafeAreaView>
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
  paymentNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    backgroundColor: Colors.status.success + '10',
    padding: 12,
    borderRadius: 10,
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
