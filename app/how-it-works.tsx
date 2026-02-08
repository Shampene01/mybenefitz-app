import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';

const steps = [
  {
    icon: 'person-add' as const,
    title: '1. Sign Up & Get Your Link',
    desc: 'Register on myBenefitz and receive your unique referral link. Share it with anyone who could benefit from our financial products.',
  },
  {
    icon: 'share-social' as const,
    title: '2. Share & Refer',
    desc: 'Share your link via WhatsApp, social media, email, or word of mouth. When someone signs up using your link, they become your referral.',
  },
  {
    icon: 'cart' as const,
    title: '3. Your Referral Takes a Product',
    desc: 'Your referral browses our products — credit repair, insurance, tax-free savings, retirement annuities, wills, or loans — and takes one or more.',
  },
  {
    icon: 'card' as const,
    title: '4. Client Pays Their Premium',
    desc: 'Once your referred client pays their premium for the product they\'ve taken, the commission process begins. We only process commissions after receipt of payment.',
  },
  {
    icon: 'cash' as const,
    title: '5. You Get Paid',
    desc: 'Your commission is calculated and paid out to you. No upfront commissions — we pay as and when premiums are received.',
  },
];

const principles = [
  {
    icon: 'checkmark-circle' as const,
    title: 'Pay As & When',
    desc: 'We pay commissions only after we receive the client\'s premium. No upfront payouts.',
  },
  {
    icon: 'shield-checkmark' as const,
    title: 'Transparent',
    desc: 'You can track your referrals, pending earnings, and paid commissions in real time.',
  },
  {
    icon: 'sync' as const,
    title: 'Recurring',
    desc: 'For products with monthly premiums, you earn commission each month the client pays.',
  },
  {
    icon: 'people' as const,
    title: 'No Limits',
    desc: 'There\'s no cap on how many people you can refer or how much you can earn.',
  },
];

const products = [
  { name: 'Credit Repair', icon: 'card' as const },
  { name: 'Insurance Cover', icon: 'shield-checkmark' as const },
  { name: 'Tax Free Savings', icon: 'leaf' as const },
  { name: 'Retirement Annuity', icon: 'umbrella' as const },
  { name: 'Wills', icon: 'document-text' as const },
  { name: 'Loans', icon: 'wallet' as const },
];

export default function HowItWorksScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {/* Hero */}
      <View style={styles.hero}>
        <View style={styles.heroIcon}>
          <Ionicons name="information-circle" size={32} color={Colors.primary.blue} />
        </View>
        <Text style={styles.heroTitle}>How the Affiliate Programme Works</Text>
        <Text style={styles.heroDesc}>
          Earn real commissions by referring people to myBenefitz financial products. Here's exactly how it works.
        </Text>
      </View>

      {/* Steps */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>The Process</Text>
        {steps.map((step, i) => (
          <View key={i} style={styles.stepCard}>
            <View style={styles.stepIconCircle}>
              <Ionicons name={step.icon} size={22} color={Colors.primary.blue} />
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>{step.title}</Text>
              <Text style={styles.stepDesc}>{step.desc}</Text>
            </View>
            {i < steps.length - 1 && <View style={styles.stepConnector} />}
          </View>
        ))}
      </View>

      {/* Key Principles */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Key Principles</Text>
        <View style={styles.principlesGrid}>
          {principles.map((p, i) => (
            <View key={i} style={styles.principleCard}>
              <Ionicons name={p.icon} size={24} color={Colors.primary.orange} />
              <Text style={styles.principleTitle}>{p.title}</Text>
              <Text style={styles.principleDesc}>{p.desc}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Products You Can Earn From */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Products You Can Earn From</Text>
        <View style={styles.productsGrid}>
          {products.map((p, i) => (
            <View key={i} style={styles.productChip}>
              <Ionicons name={p.icon} size={16} color={Colors.primary.blue} />
              <Text style={styles.productChipText}>{p.name}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Important Note */}
      <View style={styles.noteCard}>
        <Ionicons name="alert-circle" size={20} color={Colors.primary.orange} />
        <View style={styles.noteContent}>
          <Text style={styles.noteTitle}>Important</Text>
          <Text style={styles.noteDesc}>
            Commissions are paid only after receipt of your client's premium for a product they have taken. We do not pay upfront commissions. This ensures a fair and sustainable programme for everyone.
          </Text>
        </View>
      </View>

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background.light1 },
  content: { flexGrow: 1 },
  hero: {
    alignItems: 'center',
    paddingVertical: 28,
    paddingHorizontal: 24,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  heroIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.primary.blue + '10',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.text.primary,
    marginBottom: 8,
    textAlign: 'center',
  },
  heroDesc: {
    fontSize: 14,
    color: Colors.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  section: {
    marginTop: 24,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.text.primary,
    marginBottom: 14,
  },
  stepCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    gap: 12,
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  stepIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.primary.blue + '10',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepContent: { flex: 1 },
  stepTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text.primary,
    marginBottom: 4,
  },
  stepDesc: {
    fontSize: 12,
    color: Colors.text.secondary,
    lineHeight: 18,
  },
  stepConnector: {
    position: 'absolute',
    left: 35,
    bottom: -10,
    width: 2,
    height: 10,
    backgroundColor: Colors.primary.blue + '20',
  },
  principlesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  principleCard: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  principleTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text.primary,
    marginTop: 8,
    marginBottom: 4,
  },
  principleDesc: {
    fontSize: 11,
    color: Colors.text.secondary,
    lineHeight: 16,
  },
  productsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  productChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fff',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  productChipText: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.text.primary,
  },
  noteCard: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 24,
    backgroundColor: Colors.background.light2,
    borderRadius: 14,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.primary.orange + '30',
  },
  noteContent: { flex: 1 },
  noteTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.primary.orange,
    marginBottom: 4,
  },
  noteDesc: {
    fontSize: 12,
    color: Colors.text.secondary,
    lineHeight: 18,
  },
});
