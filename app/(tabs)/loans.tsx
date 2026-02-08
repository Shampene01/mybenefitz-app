import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';

const loanTypes = [
  { name: 'Personal Loan', description: 'Quick cash for personal needs', icon: '💰' },
  { name: 'Short-term Loan', description: 'Emergency funding up to 6 months', icon: '⚡' },
  { name: 'Consolidation Loan', description: 'Combine debts into one payment', icon: '🔗' },
  { name: 'Blacklisted Loan', description: 'Options for debt review', icon: '📋' },
];

export default function LoansScreen() {
  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={styles.title}>My Loans</Text>
        <Text style={styles.subtitle}>Manage your loan applications</Text>
      </View>

      <View style={styles.emptyState}>
        <View style={styles.emptyIcon}>
          <Ionicons name="wallet-outline" size={48} color={Colors.text.light} />
        </View>
        <Text style={styles.emptyTitle}>No Active Loans</Text>
        <Text style={styles.emptyText}>Apply for a loan and track your application here</Text>
        <TouchableOpacity style={styles.applyButton}>
          <Ionicons name="add" size={20} color="#fff" />
          <Text style={styles.applyButtonText}>Apply for Loan</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Available Loan Types</Text>
        {loanTypes.map((loan, index) => (
          <TouchableOpacity key={index} style={styles.loanCard}>
            <Text style={styles.loanIcon}>{loan.icon}</Text>
            <View style={styles.loanInfo}>
              <Text style={styles.loanName}>{loan.name}</Text>
              <Text style={styles.loanDescription}>{loan.description}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={Colors.text.light} />
          </TouchableOpacity>
        ))}
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
  header: {
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.text.primary,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginTop: 4,
  },
  emptyState: {
    backgroundColor: '#fff',
    margin: 16,
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    backgroundColor: Colors.background.light1,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginBottom: 20,
  },
  applyButton: {
    backgroundColor: Colors.primary.orange,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,
  },
  applyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
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
  loanCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  loanIcon: {
    fontSize: 32,
    marginRight: 16,
  },
  loanInfo: {
    flex: 1,
  },
  loanName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  loanDescription: {
    fontSize: 13,
    color: Colors.text.secondary,
    marginTop: 2,
  },
  bottomPadding: {
    height: 24,
  },
});
