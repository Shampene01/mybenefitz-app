import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { Colors } from '../constants/Colors';

interface MonthlyEarningsCardProps {
  onIncreaseEarnings: () => void;
  onHowItWorks: () => void;
  onApply: () => void;
  onHide: () => void;
}

export default function MonthlyEarningsCard({ onIncreaseEarnings, onHowItWorks, onApply, onHide }: MonthlyEarningsCardProps) {
  const { userProfile } = useAuth();

  const monthly = userProfile?.affiliate?.monthlyEarnings ?? 0;
  const pending = userProfile?.affiliate?.pendingEarnings ?? 0;
  const referrals = userProfile?.affiliate?.referralCount ?? 0;

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <View style={styles.iconCircle}>
            <Ionicons name="cash-outline" size={20} color={Colors.primary.orange} />
          </View>
          <Text style={styles.title}>Monthly Earnings</Text>
        </View>
        <TouchableOpacity onPress={onHide} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="eye-off-outline" size={18} color={Colors.text.light} />
        </TouchableOpacity>
      </View>

      <View style={styles.earningsRow}>
        <View style={styles.earningsMain}>
          <Text style={styles.currency}>R</Text>
          <Text style={styles.amount}>{monthly.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</Text>
        </View>
        <View style={styles.earningsMeta}>
          <View style={styles.metaItem}>
            <Text style={styles.metaValue}>R {pending.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</Text>
            <Text style={styles.metaLabel}>Pending</Text>
          </View>
          <View style={styles.metaDivider} />
          <View style={styles.metaItem}>
            <Text style={styles.metaValue}>{referrals}</Text>
            <Text style={styles.metaLabel}>Referrals</Text>
          </View>
        </View>
      </View>

      <View style={styles.linksRow}>
        <TouchableOpacity style={styles.linkButton} onPress={onApply} activeOpacity={0.7}>
          <Ionicons name="document-text" size={16} color="#fff" />
          <Text style={styles.linkButtonText}>Apply Now</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.linkButtonOutline} onPress={onIncreaseEarnings} activeOpacity={0.7}>
          <Ionicons name="trending-up" size={16} color={Colors.primary.blue} />
          <Text style={styles.linkButtonOutlineText}>Increase Earnings</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primary.orange + '15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  earningsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  earningsMain: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  currency: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.secondary,
    marginRight: 2,
  },
  amount: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.primary.blue,
  },
  earningsMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  metaItem: {
    alignItems: 'center',
  },
  metaValue: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  metaLabel: {
    fontSize: 10,
    color: Colors.text.light,
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  metaDivider: {
    width: 1,
    height: 24,
    backgroundColor: Colors.border,
  },
  linksRow: {
    flexDirection: 'row',
    gap: 10,
  },
  linkButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.primary.orange,
    paddingVertical: 10,
    borderRadius: 10,
  },
  linkButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },
  linkButtonOutline: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.primary.blue + '08',
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.primary.blue + '20',
  },
  linkButtonOutlineText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.primary.blue,
  },
});
