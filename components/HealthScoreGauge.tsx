import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path, Circle, Line } from 'react-native-svg';
import { useAuth } from '../contexts/AuthContext';
import { Colors } from '../constants/Colors';

interface Milestone {
  label: string;
  points: number;
  completed: boolean;
}

function getScoreBand(score: number): { label: string; color: string } {
  if (score >= 76) return { label: 'Excellent', color: '#10b981' };
  if (score >= 51) return { label: 'Good', color: '#84cc16' };
  if (score >= 26) return { label: 'Fair', color: '#f59e0b' };
  return { label: 'Poor', color: '#ef4444' };
}

function computeScore(milestones: Milestone[]): number {
  return milestones.filter((m) => m.completed).reduce((sum, m) => sum + m.points, 0);
}

function useMilestones() {
  const { userProfile } = useAuth();

  const hasPersonal = !!(userProfile?.firstName && userProfile?.lastName && userProfile?.idNumber && userProfile?.phoneNumber);
  const hasAddress = !!(userProfile?.address?.street && userProfile?.address?.suburb && userProfile?.address?.city && userProfile?.address?.province);
  const hasIncome = !!(userProfile?.income?.employerName && userProfile?.income?.grossSalary);
  const hasFica = !!(userProfile?.fica?.idDocument && userProfile?.fica?.payslip && userProfile?.fica?.bankConfirmation);

  const milestones: Milestone[] = [
    { label: 'Personal details', points: 10, completed: hasPersonal },
    { label: 'Physical address', points: 5, completed: hasAddress },
    { label: 'Income details', points: 5, completed: hasIncome },
    { label: 'FICA documents', points: 5, completed: hasFica },
    { label: 'Start Credit Repair', points: 25, completed: false },
    { label: 'Get Insurance cover', points: 15, completed: false },
    { label: 'Open Tax Free Savings', points: 10, completed: false },
    { label: 'Retirement Annuity', points: 10, completed: false },
    { label: 'Create a Will', points: 10, completed: false },
    { label: 'Manage your Loans', points: 5, completed: false },
  ];

  return { milestones, score: computeScore(milestones) };
}

/** Compact SVG gauge for the home screen */
function GaugeArc({ score, size = 120 }: { score: number; size?: number }) {
  const stroke = 10;
  const radius = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2 + 6;
  const circumference = Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, score));
  const progress = (clamped / 100) * circumference;

  const needleAngle = 180 - (clamped / 100) * 180;
  const needleRad = (needleAngle * Math.PI) / 180;
  const needleLen = radius - 16;
  const nx = cx + needleLen * Math.cos(needleRad);
  const ny = cy - needleLen * Math.sin(needleRad);

  const band = getScoreBand(score);

  const segments = [
    { start: 0, end: 0.25, color: '#ef4444' },
    { start: 0.25, end: 0.5, color: '#f59e0b' },
    { start: 0.5, end: 0.75, color: '#84cc16' },
    { start: 0.75, end: 1, color: '#10b981' },
  ];

  return (
    <View style={gaugeStyles.container}>
      <Svg width={size} height={size / 2 + 20} viewBox={`0 0 ${size} ${size / 2 + 20}`}>
        {segments.map((seg, i) => {
          const segLen = (seg.end - seg.start) * circumference;
          const offset = circumference - seg.start * circumference;
          return (
            <Path
              key={i}
              d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
              fill="none"
              stroke={seg.color}
              strokeWidth={stroke}
              strokeDasharray={`${segLen} ${circumference}`}
              strokeDashoffset={-((circumference - offset))}
              strokeLinecap="round"
              opacity={0.2}
            />
          );
        })}
        <Path
          d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
          fill="none"
          stroke={band.color}
          strokeWidth={stroke}
          strokeDasharray={`${progress} ${circumference}`}
          strokeDashoffset={0}
          strokeLinecap="round"
        />
        <Line x1={cx} y1={cy} x2={nx} y2={ny} stroke={band.color} strokeWidth={2.5} strokeLinecap="round" />
        <Circle cx={cx} cy={cy} r={4} fill={band.color} />
      </Svg>
      <View style={gaugeStyles.labelContainer}>
        <Text style={[gaugeStyles.scoreValue, { color: band.color }]}>{score}</Text>
        <Text style={[gaugeStyles.scoreBand, { color: band.color }]}>{band.label}</Text>
      </View>
    </View>
  );
}

/** Compact card for the home screen — just the gauge + link */
export default function HealthScoreCard({ onPress }: { onPress: () => void }) {
  const { score } = useMilestones();

  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.85} onPress={onPress}>
      <View style={styles.cardContent}>
        <GaugeArc score={score} size={120} />
        <View style={styles.cardInfo}>
          <Text style={styles.cardTitle}>Financial Health</Text>
          <Text style={styles.cardDesc}>Complete milestones to improve your score</Text>
          <View style={styles.linkRow}>
            <Text style={styles.linkText}>Improve Your Score</Text>
            <Ionicons name="chevron-forward" size={16} color={Colors.primary.orange} />
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

/** Full milestones list for the dedicated screen */
export function MilestonesList({ onNavigate }: { onNavigate?: (route: string) => void }) {
  const { milestones, score } = useMilestones();

  const routes: Record<string, string> = {
    'Personal details': '/edit-profile',
    'Physical address': '/edit-profile',
    'Income details': '/edit-profile',
    'FICA documents': '/fica-upload',
    'Start Credit Repair': '/(tabs)/credit',
    'Get Insurance cover': '/(tabs)/insurance',
    'Open Tax Free Savings': '/(tabs)/profile',
    'Retirement Annuity': '/(tabs)/profile',
    'Create a Will': '/(tabs)/profile',
    'Manage your Loans': '/(tabs)/loans',
  };

  return (
    <View style={listStyles.container}>
      <View style={listStyles.gaugeSection}>
        <GaugeArc score={score} size={160} />
      </View>

      <View style={listStyles.milestonesSection}>
        <Text style={listStyles.heading}>Improve Your Score</Text>
        <Text style={listStyles.subheading}>Complete these steps to improve your financial health</Text>

        {milestones.map((m, i) => (
          <TouchableOpacity
            key={i}
            style={[listStyles.item, m.completed && listStyles.itemDone]}
            activeOpacity={0.7}
            onPress={() => onNavigate?.(routes[m.label] || '/(tabs)/profile')}
          >
            <View style={[listStyles.checkCircle, m.completed && listStyles.checkCircleDone]}>
              {m.completed ? (
                <Ionicons name="checkmark" size={14} color="#fff" />
              ) : (
                <Text style={listStyles.checkNumber}>{i + 1}</Text>
              )}
            </View>
            <View style={listStyles.itemInfo}>
              <Text style={[listStyles.itemLabel, m.completed && listStyles.itemLabelDone]}>{m.label}</Text>
            </View>
            <View style={[listStyles.pointsBadge, m.completed && listStyles.pointsBadgeDone]}>
              <Text style={[listStyles.pointsText, m.completed && listStyles.pointsTextDone]}>+{m.points} pts</Text>
            </View>
            {!m.completed && (
              <Ionicons name="chevron-forward" size={16} color={Colors.text.light} />
            )}
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

export { useMilestones, GaugeArc };

const gaugeStyles = StyleSheet.create({
  container: { alignItems: 'center' },
  labelContainer: { alignItems: 'center', marginTop: -4 },
  scoreValue: { fontSize: 22, fontWeight: '700' },
  scoreBand: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 1 },
});

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 4,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  cardInfo: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  cardDesc: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginTop: 4,
    lineHeight: 18,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    gap: 4,
  },
  linkText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.primary.orange,
  },
});

const listStyles = StyleSheet.create({
  container: { flex: 1 },
  gaugeSection: {
    alignItems: 'center',
    paddingVertical: 24,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  milestonesSection: {
    padding: 20,
  },
  heading: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  subheading: {
    fontSize: 13,
    color: Colors.text.secondary,
    marginTop: 4,
    marginBottom: 20,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 12,
  },
  itemDone: {
    opacity: 0.7,
  },
  checkCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.background.light1,
    borderWidth: 1.5,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkCircleDone: {
    backgroundColor: Colors.status.success,
    borderColor: Colors.status.success,
  },
  checkNumber: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.text.secondary,
  },
  itemInfo: {
    flex: 1,
  },
  itemLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text.primary,
  },
  itemLabelDone: {
    textDecorationLine: 'line-through',
    color: Colors.text.secondary,
  },
  pointsBadge: {
    backgroundColor: Colors.primary.blue + '10',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  pointsBadgeDone: {
    backgroundColor: Colors.status.success + '20',
  },
  pointsText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.primary.blue,
  },
  pointsTextDone: {
    color: Colors.status.success,
  },
});
