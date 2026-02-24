import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Dimensions,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';

import { Colors } from '../constants/Colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_MARGIN = 8;
const CARD_WIDTH = SCREEN_WIDTH - 32;

interface MediaCampaign {
  id: string;
  accentColor: string;
  ctaLabel: string;
  ctaLink: string;
  ctaRoute: string;
  imageUrl: string;
  isActive: boolean;
  priority: number;
  subtitle: string;
  title: string;
}

interface CampaignCarouselProps {
  onCampaignPress?: (campaign: MediaCampaign) => void;
}

export default function CampaignCarousel({ onCampaignPress }: CampaignCarouselProps) {
  const [campaigns, setCampaigns] = useState<MediaCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const autoScrollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetchCampaigns();
    return () => {
      if (autoScrollRef.current) clearInterval(autoScrollRef.current);
    };
  }, []);

  useEffect(() => {
    if (campaigns.length > 1) {
      autoScrollRef.current = setInterval(() => {
        setActiveIndex((prev) => {
          const next = (prev + 1) % campaigns.length;
          flatListRef.current?.scrollToIndex({ index: next, animated: true });
          return next;
        });
      }, 60000);
      return () => {
        if (autoScrollRef.current) clearInterval(autoScrollRef.current);
      };
    }
  }, [campaigns]);

  const fetchCampaigns = async () => {
    try {
      const q = query(
        collection(db, 'mediaCampaigns'),
        where('isActive', '==', true),
        orderBy('priority', 'asc')
      );
      const snapshot = await getDocs(q);
      let items: MediaCampaign[] = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as MediaCampaign[];

      // Seeding is now admin-only via Firestore rules.
      // If no campaigns exist, the carousel simply won't render.
      setCampaigns(items);
    } catch (error) {
      console.log('Error fetching campaigns:', error);
    } finally {
      setLoading(false);
    }
  };

  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      setActiveIndex(viewableItems[0].index ?? 0);
    }
  }).current;

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  if (loading) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="small" color={Colors.primary.orange} />
      </View>
    );
  }

  if (campaigns.length === 0) return null;

  const renderItem = ({ item }: { item: MediaCampaign }) => (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={() => onCampaignPress?.(item)}
      style={styles.cardContainer}
    >
      <View style={styles.card}>
        {item.imageUrl ? (
          <Image source={{ uri: item.imageUrl }} style={styles.cardImage} resizeMode="cover" />
        ) : (
          <View style={[styles.cardImagePlaceholder, { backgroundColor: item.accentColor || Colors.primary.blue }]} />
        )}
        <View style={styles.overlay} />
        <View style={[styles.accentBar, { backgroundColor: item.accentColor || Colors.primary.orange }]} />
        <View style={styles.cardContent}>
          <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
          <Text style={styles.cardSubtitle} numberOfLines={2}>{item.subtitle}</Text>
          {item.ctaLabel ? (
            <View style={[styles.ctaButton, { backgroundColor: item.accentColor || Colors.primary.orange }]}>
              <Text style={styles.ctaText}>{item.ctaLabel}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <FlatList
        ref={flatListRef}
        data={campaigns}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        snapToInterval={CARD_WIDTH + CARD_MARGIN * 2}
        decelerationRate="fast"
        contentContainerStyle={styles.listContent}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        onScrollBeginDrag={() => {
          if (autoScrollRef.current) clearInterval(autoScrollRef.current);
        }}
        onScrollEndDrag={() => {
          if (campaigns.length > 1) {
            autoScrollRef.current = setInterval(() => {
              setActiveIndex((prev) => {
                const next = (prev + 1) % campaigns.length;
                flatListRef.current?.scrollToIndex({ index: next, animated: true });
                return next;
              });
            }, 60000);
          }
        }}
      />
      {campaigns.length > 1 && (
        <View style={styles.pagination}>
          {campaigns.map((_, index) => (
            <View
              key={index}
              style={[
                styles.dot,
                index === activeIndex ? styles.dotActive : styles.dotInactive,
              ]}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 8,
    paddingBottom: 4,
  },
  loaderContainer: {
    height: 140,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingHorizontal: 16,
  },
  cardContainer: {
    width: CARD_WIDTH,
    marginHorizontal: CARD_MARGIN,
  },
  card: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
    height: 180,
  },
  cardImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  cardImagePlaceholder: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  accentBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },
  cardContent: {
    ...StyleSheet.absoluteFillObject,
    padding: 18,
    justifyContent: 'flex-end',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  cardSubtitle: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.85)',
    marginTop: 4,
    lineHeight: 18,
  },
  ctaButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginTop: 10,
  },
  ctaText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    marginHorizontal: 3,
  },
  dotActive: {
    backgroundColor: Colors.primary.orange,
    width: 20,
    borderRadius: 4,
  },
  dotInactive: {
    backgroundColor: '#d1d5db',
  },
});
