import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';

const whatItIs = [
  'Guided credit rehabilitation (education + action)',
  'Structured plan: assess, determine, implement, track',
  'Support via WhatsApp and our portal for documents and updates',
];

const whatItIsNot = [
  'Not a debt counselling company',
  'We do not place clients under debt counselling / debt review',
  'No \'credit cleansing\' promises or removal of accurate information',
];

const outcomes = [
  'Debt reduction strategy and prioritised action plan',
  'Better budgeting and spending control',
  'Fewer missed payments through healthier habits',
  'Improved credit health that supports responsible lending goals',
];

const additionalServices = [
  { icon: 'close-circle' as const, text: 'Remove and dispute reckless lending' },
  { icon: 'cash' as const, text: 'Make payment arrangements with creditors' },
  { icon: 'hand-left' as const, text: 'Resolve handed over accounts' },
  { icon: 'timer' as const, text: 'Remove prescribed accounts' },
  { icon: 'trash' as const, text: 'Remove default accounts' },
];

export default function CreditScreen() {
  const router = useRouter();

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Hero */}
      <View style={styles.hero}>
        <View style={styles.heroIcon}>
          <Ionicons name="medical" size={32} color="#fff" />
        </View>
        <Text style={styles.heroTitle}>MyCreditClinic</Text>
        <Text style={styles.heroDesc}>
          An ethical credit score improvement service delivered through the MyBenefitz integrated financial wellness platform.
        </Text>
        <Text style={styles.heroSubDesc}>
          Poor credit outcomes often block progress — including responsible lending, insurance, and savings affordability. We're here to help.
        </Text>
      </View>

      {/* 3-Step Process */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>The 3-Step Process</Text>
        <View style={styles.stepsRow}>
          <View style={styles.stepCard}>
            <View style={[styles.stepIcon, { backgroundColor: '#3b82f615' }]}>
              <Ionicons name="search" size={22} color="#3b82f6" />
            </View>
            <Text style={styles.stepNum}>1</Text>
            <Text style={styles.stepLabel}>Assess</Text>
            <Text style={styles.stepDesc}>Review your credit profile and finances</Text>
          </View>
          <View style={styles.stepCard}>
            <View style={[styles.stepIcon, { backgroundColor: '#f59e0b15' }]}>
              <Ionicons name="clipboard" size={22} color="#f59e0b" />
            </View>
            <Text style={styles.stepNum}>2</Text>
            <Text style={styles.stepLabel}>Determine</Text>
            <Text style={styles.stepDesc}>Confirm corrections, rehab steps & education</Text>
          </View>
          <View style={styles.stepCard}>
            <View style={[styles.stepIcon, { backgroundColor: '#10b98115' }]}>
              <Ionicons name="rocket" size={22} color="#10b981" />
            </View>
            <Text style={styles.stepNum}>3</Text>
            <Text style={styles.stepLabel}>Implement</Text>
            <Text style={styles.stepDesc}>Execute disputes and settlement actions</Text>
          </View>
        </View>
      </View>

      {/* Assessment CTA */}
      <View style={styles.ctaCard}>
        <View style={styles.ctaBadge}>
          <Text style={styles.ctaBadgeText}>STARTING POINT</Text>
        </View>
        <Text style={styles.ctaTitle}>Credit Report Assessment</Text>
        <Text style={styles.ctaDesc}>
          A quick, secure credit health check that helps us understand what needs attention before we recommend any next steps.
        </Text>
        <View style={styles.ctaPriceRow}>
          <Text style={styles.ctaPrice}>R99</Text>
          <Text style={styles.ctaPriceLabel}>once-off fee</Text>
        </View>
        <TouchableOpacity
          style={styles.ctaButton}
          activeOpacity={0.8}
          onPress={() => router.push('/credit-apply' as any)}
        >
          <Ionicons name="shield-checkmark" size={20} color="#fff" />
          <Text style={styles.ctaButtonText}>Apply Now</Text>
        </TouchableOpacity>
      </View>

      {/* What it is / is not */}
      <View style={styles.section}>
        <View style={styles.comparisonRow}>
          <View style={styles.comparisonCard}>
            <View style={styles.comparisonHeader}>
              <Ionicons name="checkmark-circle" size={18} color={Colors.status.success} />
              <Text style={styles.comparisonTitle}>What It Is</Text>
            </View>
            {whatItIs.map((item, i) => (
              <View key={i} style={styles.comparisonItem}>
                <Ionicons name="checkmark" size={14} color={Colors.status.success} />
                <Text style={styles.comparisonText}>{item}</Text>
              </View>
            ))}
          </View>
          <View style={styles.comparisonCard}>
            <View style={styles.comparisonHeader}>
              <Ionicons name="close-circle" size={18} color={Colors.status.error} />
              <Text style={styles.comparisonTitle}>What It Is Not</Text>
            </View>
            {whatItIsNot.map((item, i) => (
              <View key={i} style={styles.comparisonItem}>
                <Ionicons name="close" size={14} color={Colors.status.error} />
                <Text style={styles.comparisonText}>{item}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      {/* Expected Outcomes */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Expected Outcomes</Text>
        <View style={styles.card}>
          {outcomes.map((item, i) => (
            <View key={i} style={styles.outcomeItem}>
              <Ionicons name="trending-up" size={16} color={Colors.primary.orange} />
              <Text style={styles.outcomeText}>{item}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Additional Services */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Additional Services</Text>
        {additionalServices.map((svc, i) => (
          <View key={i} style={styles.serviceRow}>
            <View style={styles.serviceIconCircle}>
              <Ionicons name={svc.icon} size={18} color={Colors.primary.blue} />
            </View>
            <Text style={styles.serviceText}>{svc.text}</Text>
          </View>
        ))}
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>MyBenefitz is a registered Credit Provider</Text>
        <Text style={styles.footerReg}>NCRCP21271</Text>
        <Text style={styles.footerUrl}>www.mybenefitz.co.za</Text>
        <Text style={styles.footerCopy}>All Rights Reserved</Text>
      </View>

      <View style={styles.bottomPadding} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.light1,
  },
  hero: {
    backgroundColor: Colors.primary.blue,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 28,
    alignItems: 'center',
  },
  heroIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 10,
  },
  heroDesc: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 8,
  },
  heroSubDesc: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.65)',
    textAlign: 'center',
    lineHeight: 18,
  },
  section: {
    paddingHorizontal: 16,
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.text.primary,
    marginBottom: 14,
  },
  stepsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  stepCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  stepIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  stepNum: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.text.light,
    marginBottom: 2,
  },
  stepLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text.primary,
    marginBottom: 4,
  },
  stepDesc: {
    fontSize: 10,
    color: Colors.text.secondary,
    textAlign: 'center',
    lineHeight: 14,
  },
  comparisonRow: {
    gap: 10,
  },
  comparisonCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  comparisonHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  comparisonTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  comparisonItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 8,
  },
  comparisonText: {
    flex: 1,
    fontSize: 12,
    color: Colors.text.secondary,
    lineHeight: 17,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  outcomeItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 10,
  },
  outcomeText: {
    flex: 1,
    fontSize: 13,
    color: Colors.text.primary,
    lineHeight: 18,
  },
  serviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  serviceIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primary.blue + '10',
    justifyContent: 'center',
    alignItems: 'center',
  },
  serviceText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    color: Colors.text.primary,
  },
  ctaCard: {
    marginHorizontal: 16,
    marginTop: 28,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.primary.orange + '40',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  ctaBadge: {
    backgroundColor: Colors.primary.orange + '15',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 12,
  },
  ctaBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.primary.orange,
    letterSpacing: 1,
  },
  ctaTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.text.primary,
    marginBottom: 8,
  },
  ctaDesc: {
    fontSize: 13,
    color: Colors.text.secondary,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 16,
  },
  ctaPriceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    marginBottom: 18,
  },
  ctaPrice: {
    fontSize: 32,
    fontWeight: '800',
    color: Colors.primary.blue,
  },
  ctaPriceLabel: {
    fontSize: 13,
    color: Colors.text.secondary,
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.primary.orange,
    paddingVertical: 14,
    paddingHorizontal: 36,
    borderRadius: 12,
  },
  ctaButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  footer: {
    marginTop: 28,
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  footerText: {
    fontSize: 11,
    color: Colors.text.light,
  },
  footerReg: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.text.secondary,
    marginTop: 2,
  },
  footerUrl: {
    fontSize: 11,
    color: Colors.primary.blue,
    marginTop: 2,
  },
  footerCopy: {
    fontSize: 10,
    color: Colors.text.light,
    marginTop: 2,
  },
  bottomPadding: {
    height: 32,
  },
});
