import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import type { ClientProduct } from '../contexts/AuthContext';
import { Colors } from '../constants/Colors';

const PM: Record<string, { icon: string; color: string; route: string }> = {
  credit_repair: { icon: 'shield-checkmark', color: '#10b981', route: '/credit-apply' },
  life_insurance: { icon: 'heart', color: '#ef4444', route: '/life-insurance-apply' },
  funeral_cover: { icon: 'umbrella', color: '#8b5cf6', route: '/funeral-apply' },
  car_insurance: { icon: 'car', color: '#f97316', route: '/car-insurance-apply' },
  retirement_annuity: { icon: 'trending-up', color: '#3b82f6', route: '/retirement-apply' },
  tax_free_savings: { icon: 'cash', color: '#0ea5e9', route: '/tax-free-savings-apply' },
  wills_estate: { icon: 'document-text', color: '#6366f1', route: '/wills-estates-apply' },
  wills_estates: { icon: 'document-text', color: '#6366f1', route: '/wills-estates-apply' },
  loan: { icon: 'wallet', color: '#f59e0b', route: '/loan-apply' },
  personal_loan: { icon: 'wallet', color: '#f59e0b', route: '/loan-apply' },
};
const DM = { icon: 'cube', color: '#64748b', route: '/' };

function badge(status: string) {
  const s = status?.toLowerCase() || '';
  if (s.includes('approved') || s.includes('active') || s.includes('completed') || s.includes('signed'))
    return { color: '#059669', bg: '#ecfdf5', icon: 'checkmark-circle' as const };
  if (s.includes('pending') || s.includes('awaiting') || s.includes('applied') || s.includes('submitted'))
    return { color: '#d97706', bg: '#fffbeb', icon: 'time' as const };
  if (s.includes('declined') || s.includes('rejected') || s.includes('cancelled'))
    return { color: '#ef4444', bg: '#fef2f2', icon: 'close-circle' as const };
  return { color: '#6366f1', bg: '#eef2ff', icon: 'alert-circle' as const };
}

function fmtStatus(s: string) { return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()); }
function fmtDate(iso?: string) { if (!iso) return ''; try { return new Date(iso).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' }); } catch { return iso; } }
function fmtR(n?: number) { if (n == null) return ''; return `R ${n.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`; }

export default function MyProductsScreen() {
  const router = useRouter();
  const { userProfile, applications, refreshApplications } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const firstName = userProfile?.firstName || userProfile?.displayName?.split(' ')[0] || '';
  const displayName = userProfile?.displayName || `${userProfile?.firstName || ''} ${userProfile?.lastName || ''}`.trim();
  const idNumber = userProfile?.idNumber || '';
  const total = applications.length;
  const active = applications.filter(p => { const s = p.status?.toLowerCase() || ''; return s.includes('active') || s.includes('completed') || s.includes('signed'); }).length;
  const pending = applications.filter(p => { const s = p.status?.toLowerCase() || ''; return s.includes('pending') || s.includes('applied') || s.includes('submitted'); }).length;

  const onRefresh = useCallback(async () => { setRefreshing(true); await refreshApplications(); setTimeout(() => setRefreshing(false), 600); }, [refreshApplications]);

  const followUp = (p: ClientProduct) => {
    const ref = p.reference || p.id;
    const msg = `Hi, My Name is ${displayName} and I would like to follow up on my ${p.productName || 'product'} application, My Id Number is ${idNumber} and reference is ${ref}.`;
    Linking.openURL(`https://wa.me/27653404602?text=${encodeURIComponent(msg)}`);
  };

  return (
    <SafeAreaView style={st.ctr} edges={['bottom']}>
      <View style={st.hdr}>
        <TouchableOpacity onPress={() => router.back()} style={st.back}><Ionicons name="arrow-back" size={22} color="#fff" /></TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={st.eye}>My Products</Text>
          <Text style={st.hTitle}>{firstName ? `${firstName}, here's your portfolio` : 'Your product portfolio'}</Text>
        </View>
      </View>
      <View style={st.statsRow}>
        <View style={st.stat}><Text style={st.statV}>{total}</Text><Text style={st.statL}>Total</Text></View>
        <View style={st.stat}><Text style={[st.statV, { color: '#059669' }]}>{active}</Text><Text style={st.statL}>Active</Text></View>
        <View style={st.stat}><Text style={[st.statV, { color: '#d97706' }]}>{pending}</Text><Text style={st.statL}>Pending</Text></View>
        <TouchableOpacity style={st.refBtn} onPress={onRefresh}><Ionicons name="refresh" size={18} color={Colors.primary.blue} /></TouchableOpacity>
      </View>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={st.scroll} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary.blue} />}>
        {total > 0 ? applications.map(product => {
          const m = PM[product.productType] || DM;
          const b = badge(product.status);
          const isAP = product.status?.toLowerCase().includes('active') || product.status?.toLowerCase().includes('approved') || product.status?.toLowerCase().includes('pending') || product.status?.toLowerCase().includes('applied') || product.status?.toLowerCase().includes('submitted');
          return (
            <View key={product.id} style={st.card}>
              <View style={[st.cHead, { backgroundColor: m.color }]}>
                <Ionicons name={m.icon as any} size={22} color="#fff" />
                <View style={[st.bdg, { backgroundColor: b.bg }]}>
                  <Ionicons name={b.icon} size={11} color={b.color} />
                  <Text style={[st.bdgT, { color: b.color }]}>{product.statusLabel || fmtStatus(product.status)}</Text>
                </View>
              </View>
              <View style={st.cBody}>
                <Text style={st.cTitle}>{product.productName || 'Product'}</Text>
                {product.productDescription ? <Text style={st.cDesc}>{product.productDescription}</Text> : null}
                <View style={st.dGrid}>
                  {product.amount != null && <View style={st.dItem}><Text style={st.dL}>Amount</Text><Text style={st.dV}>{fmtR(product.amount)}</Text></View>}
                  {product.channel ? <View style={st.dItem}><Text style={st.dL}>Channel</Text><Text style={st.dV}>{product.channel === 'whatsapp' ? 'WhatsApp' : product.channel}</Text></View> : null}
                  {product.createdAt ? <View style={st.dItem}><Text style={st.dL}>Applied</Text><Text style={st.dV}>{fmtDate(product.createdAt)}</Text></View> : null}
                  {product.reference ? <View style={st.dItem}><Text style={st.dL}>Reference</Text><Text style={[st.dV, { fontSize: 11, fontFamily: 'monospace' }]}>{product.reference}</Text></View> : null}
                </View>
                <View style={st.acts}>
                  {isAP && <TouchableOpacity style={st.waBtn} onPress={() => followUp(product)}><Ionicons name="logo-whatsapp" size={14} color="#fff" /><Text style={st.waBtnT}>Follow Up</Text></TouchableOpacity>}
                  <TouchableOpacity style={st.viewBtn} onPress={() => router.push(m.route as any)}><Text style={st.viewBtnT}>View</Text><Ionicons name="chevron-forward" size={14} color={Colors.primary.blue} /></TouchableOpacity>
                </View>
              </View>
            </View>
          );
        }) : (
          <View style={st.empty}>
            <Ionicons name="cube-outline" size={40} color={Colors.text.light} />
            <Text style={st.emptyT}>No products yet</Text>
            <Text style={st.emptyD}>Start your financial wellness journey by exploring our products.</Text>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
              <TouchableOpacity style={[st.emBtn, { backgroundColor: '#10b981' }]} onPress={() => router.push('/(tabs)/credit' as any)}><Ionicons name="shield-checkmark" size={16} color="#fff" /><Text style={st.emBtnT}>Credit Repair</Text></TouchableOpacity>
              <TouchableOpacity style={[st.emBtn, { backgroundColor: Colors.primary.blue }]} onPress={() => router.push('/products' as any)}><Ionicons name="grid" size={16} color="#fff" /><Text style={st.emBtnT}>All Products</Text></TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  ctr: { flex: 1, backgroundColor: Colors.background.light1 },
  hdr: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#0f172a', paddingHorizontal: 16, paddingVertical: 20, paddingTop: 12 },
  back: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.12)', justifyContent: 'center', alignItems: 'center' },
  eye: { fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: 1 },
  hTitle: { fontSize: 18, fontWeight: '800', color: '#fff', marginTop: 2 },
  statsRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: Colors.border },
  stat: { flex: 1, alignItems: 'center' },
  statV: { fontSize: 20, fontWeight: '800', color: Colors.text.primary },
  statL: { fontSize: 11, color: Colors.text.light, marginTop: 2 },
  refBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.primary.blue + '10', justifyContent: 'center', alignItems: 'center' },
  scroll: { padding: 16, paddingBottom: 40 },
  card: { backgroundColor: '#fff', borderRadius: 14, marginBottom: 16, overflow: 'hidden', borderWidth: 1, borderColor: Colors.border },
  cHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12 },
  bdg: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20 },
  bdgT: { fontSize: 11, fontWeight: '600' },
  cBody: { padding: 14 },
  cTitle: { fontSize: 16, fontWeight: '700', color: Colors.text.primary },
  cDesc: { fontSize: 13, color: Colors.text.secondary, marginTop: 4 },
  dGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 12 },
  dItem: { minWidth: '45%' as any },
  dL: { fontSize: 11, color: Colors.text.light },
  dV: { fontSize: 13, fontWeight: '600', color: Colors.text.primary, marginTop: 2 },
  acts: { flexDirection: 'row', gap: 10, marginTop: 14, justifyContent: 'flex-end' },
  waBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#25d366', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8 },
  waBtnT: { fontSize: 13, fontWeight: '600', color: '#fff' },
  viewBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8, borderWidth: 1, borderColor: Colors.primary.blue },
  viewBtnT: { fontSize: 13, fontWeight: '600', color: Colors.primary.blue },
  empty: { alignItems: 'center', padding: 32 },
  emptyT: { fontSize: 16, fontWeight: '700', color: Colors.text.primary, marginTop: 12 },
  emptyD: { fontSize: 13, color: Colors.text.secondary, textAlign: 'center', marginTop: 6 },
  emBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10 },
  emBtnT: { fontSize: 13, fontWeight: '600', color: '#fff' },
});
