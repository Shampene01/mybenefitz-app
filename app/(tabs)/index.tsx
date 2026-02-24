import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import { Colors } from '../../constants/Colors';
import { STAT_ICONS, ACTION_ICONS, CustomIcon } from '../../constants/CustomIcons';
import DrawerMenu from '../../components/DrawerMenu';
import CampaignCarousel from '../../components/CampaignCarousel';
import HealthScoreCard from '../../components/HealthScoreGauge';
import MonthlyEarningsCard from '../../components/MonthlyEarningsCard';

function IconRenderer({ icon, size }: { icon: CustomIcon; size: number }) {
  if (icon.image) {
    return <Image source={icon.image} style={{ width: size, height: size }} resizeMode="contain" />;
  }
  return <Ionicons name={icon.fallbackIonicon as any} size={size} color={icon.color} />;
}

const quickActions = [
  { title: 'Credit Repair', iconKey: 'creditRepair', route: '/(tabs)/credit' },
  { title: 'Get Insurance', iconKey: 'getInsurance', route: '/(tabs)/insurance' },
  { title: 'Apply for Loan', iconKey: 'applyForLoan', route: '/(tabs)/loans' },
  { title: 'My Profile', iconKey: 'myProfile', route: '/(tabs)/profile' },
];

const stats = [
  { title: 'Active Products', value: '0', iconKey: 'activeProducts' },
  { title: 'Credit Score', value: '---', iconKey: 'creditScore' },
  { title: 'Policies', value: '0', iconKey: 'policies' },
];

export default function HomeScreen() {
  const { userProfile, updateUserProfile, isProfileComplete, isAccountFlagged } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [nudgeDismissed, setNudgeDismissed] = useState(false);

  // Earnings card visibility: hidden only if user explicitly set showEarnings to false
  const showEarnings = userProfile?.preferences?.showEarnings !== false;

  const handleHideEarnings = async () => {
    await updateUserProfile({ preferences: { ...userProfile?.preferences, showEarnings: false } });
  };

  return (
    <View style={styles.container}>
      <View style={[styles.headerSection, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => setDrawerVisible(true)} style={styles.menuButton}>
          <Ionicons name="menu" size={26} color="#fff" />
        </TouchableOpacity>
        <Image
          source={require('../../assets/logo-inline.png')}
          style={styles.headerLogo}
          resizeMode="contain"
        />
        <View style={styles.menuButton} />
      </View>
      <DrawerMenu visible={drawerVisible} onClose={() => setDrawerVisible(false)} />
      <ScrollView 
        style={styles.scrollContainer} 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        bounces={false}
      >
        <TouchableOpacity
          style={styles.welcomeCardWrapper}
          activeOpacity={0.85}
          onPress={() => router.push('/edit-profile')}
        >
          <View style={styles.welcomeCard}>
            <View style={styles.welcomeHeader}>
              <View style={styles.profilePicContainer}>
                {userProfile?.photoURL ? (
                  <Image source={{ uri: userProfile.photoURL }} style={styles.profilePic} />
                ) : (
                  <View style={styles.profilePicPlaceholder}>
                    <Ionicons name="person" size={28} color={Colors.primary.blue} />
                  </View>
                )}
              </View>
              <View style={styles.welcomeTextContainer}>
                <Text style={styles.welcomeText}>Welcome back,</Text>
                <Text style={styles.userName}>{userProfile?.displayName?.split(' ')[0] || 'User'}!</Text>
                <Text style={styles.subtitle}>Here's your financial overview</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={Colors.text.light} />
            </View>
          </View>
        </TouchableOpacity>

        {!isProfileComplete && !isAccountFlagged && !nudgeDismissed && (
          <View style={styles.nudgeBanner}>
            <View style={styles.nudgeContent}>
              <Ionicons name="alert-circle" size={22} color="#92400e" />
              <View style={{ flex: 1 }}>
                <Text style={styles.nudgeTitle}>Complete your profile</Text>
                <Text style={styles.nudgeDesc}>Fill in your details to unlock all product applications and improve your Financial Health Score.</Text>
              </View>
              <TouchableOpacity onPress={() => setNudgeDismissed(true)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close" size={20} color="#92400e" />
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={styles.nudgeButton}
              onPress={() => router.push('/edit-profile')}
              activeOpacity={0.8}
            >
              <Text style={styles.nudgeButtonText}>Complete now</Text>
              <Ionicons name="chevron-forward" size={16} color="#fff" />
            </TouchableOpacity>
          </View>
        )}

        <HealthScoreCard onPress={() => router.push('/improve-score')} />

        <CampaignCarousel onCampaignPress={(campaign) => {
          if (campaign.ctaRoute) {
            router.push(campaign.ctaRoute as any);
          }
        }} />

      <View style={styles.contentSection}>
        <View style={styles.statsContainer}>
        {stats.map((stat, index) => {
          const icon = STAT_ICONS[stat.iconKey];
          return (
            <View key={index} style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: icon.color + '20' }]}>
                <IconRenderer icon={icon} size={24} />
              </View>
              <Text style={styles.statValue}>{stat.value}</Text>
              <Text style={styles.statTitle}>{stat.title}</Text>
            </View>
          );
        })}
      </View>

      {showEarnings && (
        <MonthlyEarningsCard
          onIncreaseEarnings={() => router.push('/increase-earnings')}
          onHowItWorks={() => router.push('/how-it-works')}
          onApply={() => router.push('/affiliate-apply' as any)}
          onHide={handleHideEarnings}
        />
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.actionsGrid}>
          {quickActions.map((action, index) => {
            const icon = ACTION_ICONS[action.iconKey];
            return (
              <TouchableOpacity
                key={index}
                style={styles.actionCard}
                onPress={() => router.push(action.route as any)}
              >
                <View style={[styles.actionIcon, { backgroundColor: icon.color + '10' }]}>
                  <IconRenderer icon={icon} size={28} />
                </View>
                <Text style={styles.actionTitle}>{action.title}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Need Help?</Text>
        <TouchableOpacity style={styles.helpCard}>
          <View style={styles.helpContent}>
            <Text style={styles.helpTitle}>Contact Support</Text>
            <Text style={styles.helpText}>Our team is ready to assist you with any questions</Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color={Colors.primary.orange} />
        </TouchableOpacity>
      </View>

        <View style={styles.bottomPadding} />
      </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.light1,
  },
  headerSection: {
    backgroundColor: Colors.primary.blue,
    paddingHorizontal: 16,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  menuButton: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerLogo: {
    width: 120,
    height: 40,
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    backgroundColor: Colors.background.light1,
  },
  welcomeCardWrapper: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  welcomeCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  contentSection: {
    flex: 1,
    backgroundColor: Colors.background.light1,
  },
  welcomeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  welcomeTextContainer: {
    flex: 1,
  },
  welcomeText: {
    color: Colors.text.secondary,
    fontSize: 14,
  },
  userName: {
    color: Colors.primary.blue,
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 2,
  },
  subtitle: {
    color: Colors.text.light,
    fontSize: 13,
    marginTop: 6,
  },
  profilePicContainer: {
    marginRight: 16,
  },
  profilePic: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 3,
    borderColor: '#fff',
  },
  profilePicPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.background.light1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statsContainer: {
    flexDirection: 'row',
    marginTop: 8,
    marginHorizontal: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  statIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text.primary,
  },
  statTitle: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginTop: 4,
  },
  section: {
    marginTop: 24,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 16,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  actionCard: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  actionIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  actionTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text.primary,
    textAlign: 'center',
  },
  helpCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  helpContent: {
    flex: 1,
  },
  helpTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  helpText: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginTop: 4,
  },
  bottomPadding: {
    height: 24,
  },
  nudgeBanner: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 4,
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
    borderRadius: 16,
    padding: 16,
  },
  nudgeContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  nudgeTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#92400e',
  },
  nudgeDesc: {
    fontSize: 12,
    color: '#78350f',
    marginTop: 3,
    lineHeight: 18,
  },
  nudgeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: '#f59e0b',
    borderRadius: 10,
    paddingVertical: 10,
    marginTop: 12,
  },
  nudgeButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
});
