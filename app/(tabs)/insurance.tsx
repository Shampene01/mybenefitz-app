import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';

const insuranceTypes = [
  { name: 'Life Insurance', description: 'Protect your loved ones', icon: 'heart', color: '#ef4444', route: '/life-insurance-apply' },
  { name: 'Funeral Cover', description: 'Dignified funeral plans', icon: 'umbrella', color: '#8b5cf6', route: '/funeral-cover-apply' },
  { name: 'Retirement Annuity', description: 'Tax-efficient retirement savings', icon: 'trending-up', color: '#3b82f6', route: '/retirement-apply' },
  { name: 'Tax Free Savings', description: 'Grow your savings tax-free', icon: 'cash', color: '#10b981', route: '/tax-free-savings-apply' },
  { name: 'Wills & Estates', description: 'Free consultation', icon: 'document-text', color: '#f59e0b', route: '/wills-estates-apply' },
];

export default function InsuranceScreen() {
  const router = useRouter();

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.heroCard}>
        <Ionicons name="shield-checkmark" size={48} color="rgba(255,255,255,0.3)" style={styles.heroIcon} />
        <Text style={styles.heroTitle}>Get Covered Today</Text>
        <Text style={styles.heroText}>Insurance, savings & estate planning products</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Our Products</Text>
        <View style={styles.productsGrid}>
          {insuranceTypes.map((insurance, index) => (
            <TouchableOpacity key={index} style={styles.productCard} onPress={() => router.push(insurance.route as any)}>
              <View style={[styles.productIcon, { backgroundColor: insurance.color + '20' }]}>
                <Ionicons name={insurance.icon as any} size={28} color={insurance.color} />
              </View>
              <Text style={styles.productName}>{insurance.name}</Text>
              <Text style={styles.productDescription}>{insurance.description}</Text>
              <TouchableOpacity style={styles.quoteButton} onPress={() => router.push(insurance.route as any)}>
                <Text style={styles.quoteButtonText}>Apply Now</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Your Policies</Text>
        <View style={styles.emptyState}>
          <Ionicons name="shield-outline" size={40} color={Colors.text.light} />
          <Text style={styles.emptyText}>No active policies yet</Text>
          <Text style={styles.emptySubtext}>Get a quote to start protecting what matters</Text>
        </View>
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
  heroCard: {
    backgroundColor: '#8b5cf6',
    margin: 16,
    borderRadius: 20,
    padding: 24,
    overflow: 'hidden',
  },
  heroIcon: {
    position: 'absolute',
    right: 16,
    top: 16,
  },
  heroTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  heroText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    maxWidth: '80%',
  },
  section: {
    paddingHorizontal: 16,
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 16,
  },
  productsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  productCard: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  productIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  productName: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  productDescription: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginTop: 4,
    marginBottom: 12,
  },
  quoteButton: {
    borderWidth: 1.5,
    borderColor: Colors.primary.blue,
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  quoteButtonText: {
    color: Colors.primary.blue,
    fontSize: 13,
    fontWeight: '600',
  },
  emptyState: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.text.primary,
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 13,
    color: Colors.text.secondary,
    marginTop: 4,
    textAlign: 'center',
  },
  bottomPadding: {
    height: 24,
  },
});
