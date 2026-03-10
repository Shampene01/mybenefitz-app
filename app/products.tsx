import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';

const PRODUCTS = [
  { name: 'Credit Clinic', desc: 'Repair & improve your credit score', icon: 'shield-checkmark', color: '#10b981', route: '/credit-apply' },
  { name: 'Life Insurance', desc: 'Protect your loved ones financially', icon: 'heart', color: '#ef4444', route: '/life-insurance-apply' },
  { name: 'Funeral Cover', desc: 'Dignified funeral plans for your family', icon: 'umbrella', color: '#8b5cf6', route: '/funeral-apply' },
  { name: 'Car Insurance', desc: 'Comprehensive vehicle protection', icon: 'car', color: '#f97316', route: '/car-insurance-apply' },
  { name: 'Retirement Annuity', desc: 'Tax-efficient retirement savings', icon: 'trending-up', color: '#3b82f6', route: '/retirement-apply' },
  { name: 'Tax Free Savings', desc: 'Grow your savings tax-free', icon: 'cash', color: '#0ea5e9', route: '/tax-free-savings-apply' },
  { name: 'Wills & Estates', desc: 'Free estate planning consultation', icon: 'document-text', color: '#f59e0b', route: '/wills-estates-apply' },
];

export default function ProductsCatalogScreen() {
  const router = useRouter();
  return (
    <SafeAreaView style={s.ctr} edges={['bottom']}>
      <View style={s.hdr}>
        <TouchableOpacity onPress={() => router.back()} style={s.back}><Ionicons name="arrow-back" size={22} color="#fff" /></TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.eye}>Products</Text>
          <Text style={s.hTitle}>Explore Our Products</Text>
          <Text style={s.hSub}>Choose a product to start your application</Text>
        </View>
      </View>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={s.scroll}>
        {PRODUCTS.map((p) => (
          <TouchableOpacity key={p.name} style={s.card} activeOpacity={0.7} onPress={() => router.push(p.route as any)}>
            <View style={[s.iconWrap, { backgroundColor: p.color + '15' }]}>
              <Ionicons name={p.icon as any} size={26} color={p.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.cardTitle}>{p.name}</Text>
              <Text style={s.cardDesc}>{p.desc}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={Colors.text.light} />
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  ctr: { flex: 1, backgroundColor: Colors.background.light1 },
  hdr: { backgroundColor: '#0f172a', paddingHorizontal: 16, paddingVertical: 20, paddingTop: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  back: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.12)', justifyContent: 'center', alignItems: 'center' },
  eye: { fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: 1 },
  hTitle: { fontSize: 18, fontWeight: '800', color: '#fff', marginTop: 2 },
  hSub: { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 4 },
  scroll: { padding: 16, paddingBottom: 40 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: Colors.border },
  iconWrap: { width: 50, height: 50, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  cardTitle: { fontSize: 15, fontWeight: '700', color: Colors.text.primary },
  cardDesc: { fontSize: 12, color: Colors.text.secondary, marginTop: 3 },
});
