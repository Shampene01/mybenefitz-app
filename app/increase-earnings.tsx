import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Share, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { Colors } from '../constants/Colors';

const tips = [
  {
    icon: 'share-social' as const,
    title: 'Share Your Referral Link',
    desc: 'Send your unique link to friends, family, and colleagues. You earn commission every time someone takes a product through your link.',
  },
  {
    icon: 'logo-whatsapp' as const,
    title: 'WhatsApp & Social Media',
    desc: 'Post your link on WhatsApp status, Facebook, Instagram, and LinkedIn. The more visibility, the more referrals.',
  },
  {
    icon: 'people' as const,
    title: 'Talk to Your Network',
    desc: 'Recommend myBenefitz to people who need credit repair, insurance, savings, or loans. Your personal recommendation carries weight.',
  },
  {
    icon: 'megaphone' as const,
    title: 'Create Content',
    desc: 'Share testimonials and success stories. Help people understand how myBenefitz can improve their financial health.',
  },
  {
    icon: 'repeat' as const,
    title: 'Follow Up',
    desc: 'Check in with people you\'ve shared with. A gentle reminder can turn interest into action.',
  },
  {
    icon: 'school' as const,
    title: 'Educate',
    desc: 'Help people understand the products — credit repair, insurance, tax-free savings. Informed clients convert faster.',
  },
];

export default function IncreaseEarningsScreen() {
  const { userProfile } = useAuth();
  const referralCode = userProfile?.affiliate?.referralCode || userProfile?.uid?.slice(0, 8) || 'MYBENEFITZ';
  const referralLink = `https://mybenefitz.co.za/r/${referralCode}`;

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Join myBenefitz and take control of your financial health! Sign up using my link: ${referralLink}`,
        title: 'myBenefitz Referral',
      });
    } catch (error) {
      Alert.alert('Error', 'Failed to share. Please try again.');
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.hero}>
        <View style={styles.heroIcon}>
          <Ionicons name="trending-up" size={32} color={Colors.primary.orange} />
        </View>
        <Text style={styles.heroTitle}>Increase Your Earnings</Text>
        <Text style={styles.heroDesc}>
          Earn commission by referring clients to myBenefitz. The more people you refer who take products, the more you earn.
        </Text>
      </View>

      <View style={styles.referralCard}>
        <Text style={styles.referralLabel}>Your Referral Link</Text>
        <View style={styles.referralLinkRow}>
          <Text style={styles.referralLink} numberOfLines={1}>{referralLink}</Text>
          <TouchableOpacity style={styles.shareButton} onPress={handleShare} activeOpacity={0.7}>
            <Ionicons name="share-outline" size={18} color="#fff" />
            <Text style={styles.shareButtonText}>Share</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.tipsSection}>
        <Text style={styles.sectionTitle}>Tips to Earn More</Text>
        {tips.map((tip, i) => (
          <View key={i} style={styles.tipCard}>
            <View style={styles.tipIconCircle}>
              <Ionicons name={tip.icon} size={20} color={Colors.primary.blue} />
            </View>
            <View style={styles.tipContent}>
              <Text style={styles.tipTitle}>{tip.title}</Text>
              <Text style={styles.tipDesc}>{tip.desc}</Text>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.ctaCard}>
        <Text style={styles.ctaTitle}>Ready to start earning?</Text>
        <Text style={styles.ctaDesc}>Share your link now and start building your commission income.</Text>
        <TouchableOpacity style={styles.ctaButton} onPress={handleShare} activeOpacity={0.7}>
          <Ionicons name="share-social" size={20} color="#fff" />
          <Text style={styles.ctaButtonText}>Share My Referral Link</Text>
        </TouchableOpacity>
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
    backgroundColor: Colors.primary.orange + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.text.primary,
    marginBottom: 8,
  },
  heroDesc: {
    fontSize: 14,
    color: Colors.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  referralCard: {
    marginHorizontal: 16,
    marginTop: 20,
    backgroundColor: Colors.primary.blue,
    borderRadius: 14,
    padding: 16,
  },
  referralLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#ffffff99',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  referralLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  referralLink: {
    flex: 1,
    fontSize: 13,
    color: '#fff',
    fontWeight: '500',
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primary.orange,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  shareButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },
  tipsSection: {
    marginTop: 24,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.text.primary,
    marginBottom: 14,
  },
  tipCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  tipIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.primary.blue + '10',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tipContent: { flex: 1 },
  tipTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 4,
  },
  tipDesc: {
    fontSize: 12,
    color: Colors.text.secondary,
    lineHeight: 18,
  },
  ctaCard: {
    marginHorizontal: 16,
    marginTop: 20,
    backgroundColor: Colors.background.light2,
    borderRadius: 14,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.primary.orange + '30',
  },
  ctaTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text.primary,
    marginBottom: 6,
  },
  ctaDesc: {
    fontSize: 13,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginBottom: 14,
    lineHeight: 19,
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.primary.orange,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  ctaButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
});
