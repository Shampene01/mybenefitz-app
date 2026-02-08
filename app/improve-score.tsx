import { ScrollView, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { MilestonesList } from '../components/HealthScoreGauge';
import { Colors } from '../constants/Colors';

export default function ImproveScoreScreen() {
  const router = useRouter();

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <MilestonesList onNavigate={(route) => router.push(route as any)} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.light1,
  },
  content: {
    flexGrow: 1,
  },
});
