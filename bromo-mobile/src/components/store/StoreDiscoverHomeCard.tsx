import React from 'react';
import { Image, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import {
    Eye,
    Heart,
    MapPin,
    Navigation,
    Phone,
    Star,
    Store,
} from 'lucide-react-native';
import type { Store as BromoStore } from '../../api/storeApi';
import type { ThemePalette } from '../../theme/tokens';

function fmtDistance(meters: number): string {
    if (meters < 1000) return `${Math.round(meters)} m`;
    return `${(meters / 1000).toFixed(1)} km`;
}

function formatCompact(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
    return String(n);
}

type Props = {
    store: BromoStore;
    palette: ThemePalette;
    liked: boolean;
    onPressCard: () => void;
    onToggleLike: () => void;
    onCall: () => void;
    onDirection: () => void;
    onViewOffers: () => void;
    style?: ViewStyle;
};

export function StoreDiscoverHomeCard({
    store,
    palette,
    liked,
    onPressCard,
    onToggleLike,
    onCall,
    onDirection,
    onViewOffers,
    style,
}: Props) {
    const offerPercent = Math.max(12, Math.min(50, Math.round((store.ratingAvg || 3.6) * 8)));
    const dailyUsers = Math.max(0, Math.round(store.totalViews * 0.62));
    const statusText = store.isActive ? 'Open' : 'Closed';
    const statusColor = store.isActive ? palette.success : palette.accent;
    const distanceText = store.distance != null ? fmtDistance(store.distance) : '—';
    const ratingText = store.ratingAvg > 0 ? store.ratingAvg.toFixed(1) : '4.0';
    const reviewsText = formatCompact(store.ratingCount || 0);
    const cardBorderColor = `${palette.primary}55`;

    return (
        <Pressable
            onPress={onPressCard}
            style={({ pressed }) => [
                s.storeCard,
                {
                    backgroundColor: palette.background,
                    borderColor: cardBorderColor,
                    shadowColor: palette.primary,
                    opacity: pressed ? 0.95 : 1,
                },
                style,
            ]}>
            <View style={[s.storeTop, { borderBottomColor: palette.border }]}>
                <View style={s.storeIdentityRow}>
                    <View style={[s.storeAvatarWrap, { borderColor: palette.warning, backgroundColor: `${palette.warning}1f` }]}>
                        {store.profilePhoto ? (
                            <Image source={{ uri: store.profilePhoto }} style={s.storeAvatar} resizeMode="cover" />
                        ) : (
                            <View style={[s.storeAvatar, { alignItems: 'center', justifyContent: 'center' }]}>
                                <Store size={22} color={palette.warning} />
                            </View>
                        )}
                    </View>
                    <View style={s.storeInfoWrap}>
                        <View style={s.nameRow}>
                            <Text style={{ fontSize: 22, fontWeight: '900', color: palette.foreground }} numberOfLines={1}>
                                {store.name}
                            </Text>


                        </View>
                        <Text style={{ fontSize: 14, color: palette.foregroundSubtle, marginTop: 2 }} numberOfLines={1}>
                            {store.category}





                        </Text>

                        <View style={s.ratingRow}>
                            <Star size={14} color={palette.warning} fill={palette.warning} />
                            <Star size={14} color={palette.warning} fill={palette.warning} />
                            <Star size={14} color={palette.warning} fill={palette.warning} />
                            <Star size={14} color={palette.warning} fill={palette.warning} />
                            <Star size={14} color={palette.warning} fill={palette.warning} />
                            <Text style={{ fontSize: 17, fontWeight: '900', color: palette.foreground, marginLeft: 4 }}>
                                {ratingText}
                            </Text>
                            <Text style={{ fontSize: 15, color: palette.foregroundSubtle }}>({reviewsText})</Text>
                        </View>
                    </View>
                    <View style={s.storeActionsTop}>
                        <View style={[s.offerTag, { backgroundColor: palette.primary }]}>
                            <Text style={{ fontSize: 12, fontWeight: '900', color: palette.primaryForeground }}>
                                {offerPercent}% OFF
                            </Text>
                        </View>
                        <Pressable onPress={onToggleLike} style={[s.likeBtn, { borderColor: palette.border, backgroundColor: palette.card }]}>
                            <Heart
                                size={18}
                                color={liked ? palette.accent : palette.foregroundSubtle}
                                fill={liked ? palette.accent : 'transparent'}
                            />
                        </Pressable>
                    </View>
                </View>

                {/* <View style={s.engageHead}>
          <Text style={{fontSize: 12, fontWeight: '800', color: palette.foregroundSubtle, letterSpacing: 0.8}}>
            ENGAGEMENT
          </Text>
          <Text style={{fontSize: 18, fontWeight: '900', color: palette.primary}}>{engagementPct}%</Text>
        </View> */}
                {/* <View style={[s.progressTrack, {backgroundColor: palette.border}]}>
          <View style={[s.progressFill, {backgroundColor: palette.primary, width: `${engagementPct}%`}]} />
        </View> */}
            </View>

            <View style={[s.metricsRow, { borderBottomColor: palette.border }]}>
                <View style={[s.metricCell, { borderRightColor: palette.border }]}>
                    <Text style={{ fontSize: 15, fontWeight: '900', color: palette.primary }}>{distanceText}</Text>
                    <Text style={{ fontSize: 10, color: palette.foregroundSubtle, marginTop: 3 }}>DISTANCE</Text>
                </View>
                <View style={[s.metricCell, { borderRightColor: palette.border }]}>
                    <Text style={{ fontSize: 15, fontWeight: '900', color: palette.foreground }}>
                        {formatCompact(dailyUsers)}
                    </Text>
                    <Text style={{ fontSize: 10, color: palette.foregroundSubtle, marginTop: 3 }}>VISITORS</Text>
                </View>
                <View style={[s.metricCell, { borderRightColor: palette.border }]}>
                    <Text style={{ fontSize: 15, fontWeight: '900', color: palette.foreground }}>
                        {store.ratingCount || 0}
                    </Text>
                    <Text style={{ fontSize: 10, color: palette.foregroundSubtle, marginTop: 3 }}>REVIEWS</Text>
                </View>
                {/* <View style={s.metricCell}>
          <Text style={{fontSize: 15, fontWeight: '900', color: badgeColor || palette.warning}}>{planText}</Text>
          <Text style={{fontSize: 10, color: palette.foregroundSubtle, marginTop: 3}}>PLAN</Text>
        </View> */}
            </View>

            <View style={[s.statusRow, { borderBottomColor: palette.border }]}>
               <View>
                    <Text style={{ fontSize: 14, paddingHorizontal: 0, fontWeight: '500'}}>    <Eye size={12} />  {dailyUsers} /Day</Text>
               </View>
                <View >
                    <Text style={{ fontSize: 14, fontWeight: '600', color: statusColor }}>{statusText}</Text>
                </View>
                  <View >
                    <Text style={{ fontSize: 14, paddingHorizontal: 0, fontWeight: '500' }}>
                        <MapPin size={12} /> {store.city}
                    </Text>
                </View>

            </View>



            <View style={s.actionRow}>
                <Pressable onPress={onCall} style={[s.actionBtn, { borderColor: palette.border, backgroundColor: palette.card }]}>
                    <Phone size={14} color={palette.foregroundSubtle} />
                    <Text style={{ fontSize: 12, fontWeight: '800', color: palette.foreground }}>Call</Text>
                </Pressable>
                <Pressable onPress={onDirection} style={[s.actionBtn, { borderColor: palette.border, backgroundColor: palette.card }]}>
                    <Navigation size={14} color={palette.foregroundSubtle} />
                    <Text style={{ fontSize: 12, fontWeight: '800', color: palette.foreground }}>Direction</Text>
                </Pressable>
                <Pressable onPress={onViewOffers} style={[s.actionBtnPrimary, { backgroundColor: palette.primary }]}>
                    <Text style={{ fontSize: 12, fontWeight: '900', color: palette.primaryForeground }}>View Offers</Text>
                </Pressable>
            </View>
        </Pressable>
    );
}

const s = StyleSheet.create({
    storeCard: {
        borderWidth: 1.5,
        borderRadius: 24,
        overflow: 'hidden',
        shadowOpacity: 0.18,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
        elevation: 4,
    },
    storeTop: {
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderBottomWidth: 1,
    },
    storeIdentityRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 10,
    },
    storeInfoWrap: {
        flex: 1,
        minWidth: 0,
    },
    nameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },

    ratingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
        marginTop: 6,
    },
    storeActionsTop: {
        alignItems: 'flex-end',
        gap: 8,
        marginLeft: 4,
    },
    offerTag: {
        borderRadius: 999,
        paddingHorizontal: 11,
        paddingVertical: 6,
    },
    likeBtn: {
        width: 42,
        height: 42,
        borderRadius: 12,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    storeAvatarWrap: {
        width: 74,
        height: 74,
        borderRadius: 20,
        borderWidth: 2,
        overflow: 'hidden',
    },
    storeAvatar: {
        width: '100%',
        height: '100%',
    },
    engageHead: {
        marginTop: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    progressTrack: {
        marginTop: 8,
        height: 10,
        borderRadius: 999,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        borderRadius: 999,
    },
    metricsRow: {
        flexDirection: 'row',
        borderBottomWidth: 1,
    },
    metricCell: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 8,
        // borderRightWidth: 1,
    },
    statusRow: {
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderBottomWidth: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-around',
        gap: 8,
    },
    statusPill: {
        borderRadius: 999,
        paddingHorizontal: 12,
        paddingVertical: 6,
    },
    storeMetaRow: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
    },
    deliveryBadgeInline: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        borderWidth: 1,
        borderRadius: 999,
        paddingHorizontal: 8,
        paddingVertical: 4,
    },
    actionRow: {
        flexDirection: 'row',
        gap: 10,
        paddingHorizontal: 14,
        paddingTop: 6,
        paddingBottom: 14,
    },
    actionBtn: {
        flex: 1,
        height: 42,
        borderRadius: 16,
        borderWidth: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 5,
    },
    actionBtnPrimary: {
        flex: 1,
        height: 42,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    metaItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
});
