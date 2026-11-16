import { Ionicons } from '@expo/vector-icons';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import React, { useEffect, useLayoutEffect, useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { api, appendFile, errorText, LocalFile } from '../../api';
import { Chips, Field, formStyles, Label, PrimaryButton, SecondaryButton } from '../../components/form';
import { Card, LoadState, SectionTitle } from '../../components/ui';
import { pickPhotos, takePhoto } from '../../photos';
import { colors, fonts, radius, spacing } from '../../theme';
import { usePage } from '../../usePage';
import { InspectionStackParams } from './InspectionsScreen';

interface FormPage {
  type: string;
  leases: { id: number; label: string; tenant_name: string | null; listing_title: string | null }[];
}

interface RoomPhoto extends LocalFile {
  uploaded: boolean;
}

interface Room {
  name: string;
  condition: string;
  notes: string;
  photos: RoomPhoto[];
}

const CONDITIONS = [
  { value: 'excellent', label: 'Excellent' },
  { value: 'good', label: 'Good' },
  { value: 'fair', label: 'Fair' },
  { value: 'poor', label: 'Poor' },
];

const MAX_PHOTOS = 10;

/** Same starting rooms as the website's inspection form. */
const defaultRooms = (): Room[] =>
  ['Entrance', 'Living Room', 'Kitchen', 'Master Bedroom', 'Bathroom'].map((name) => ({ name, condition: 'good', notes: '', photos: [] }));

export default function AgentInspectionFormScreen() {
  const nav = useNavigation();
  const route = useRoute<RouteProp<InspectionStackParams, 'InspectionForm'>>();
  const { type, leaseId: presetLease } = route.params;
  const label = type === 'move_out' ? 'Move-out' : 'Move-in';

  const { data, error, reload } = usePage<FormPage>(`/agent/inspections/form?type=${type}`);

  const [leaseId, setLeaseId] = useState<number | null>(presetLease ?? null);
  const [rooms, setRooms] = useState<Room[]>(defaultRooms);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  // Set once the inspection itself is saved; after that only photo uploads remain.
  const [savedId, setSavedId] = useState<number | null>(null);

  useLayoutEffect(() => {
    nav.setOptions({ title: `${label} inspection` });
  }, [nav, label]);

  // If there is exactly one lease to inspect, choose it for the agent.
  useEffect(() => {
    if (data && leaseId === null && data.leases.length === 1) setLeaseId(data.leases[0].id);
  }, [data, leaseId]);

  if (!data) return <LoadState error={error} onRetry={reload} />;

  const patch = (i: number, change: Partial<Room>) => setRooms((cur) => cur.map((r, j) => (j === i ? { ...r, ...change } : r)));

  async function addPhotos(i: number, from: 'camera' | 'gallery') {
    const picked = from === 'camera' ? await takePhoto() : await pickPhotos(true);
    if (!picked.length) return;
    setRooms((cur) =>
      cur.map((r, j) => (j === i ? { ...r, photos: [...r.photos, ...picked.map((p) => ({ ...p, uploaded: false }))].slice(0, MAX_PHOTOS) } : r)),
    );
  }

  /** Sends every photo not yet uploaded, one request each. Throws on the first failure so it can be retried. */
  async function uploadPhotos(id: number) {
    const pending = rooms.flatMap((r, ri) => r.photos.map((p, pi) => ({ ri, pi, p }))).filter((x) => !x.p.uploaded);
    for (let n = 0; n < pending.length; n++) {
      const { ri, pi, p } = pending[n];
      setProgress(`Uploading photo ${n + 1} of ${pending.length}…`);
      const form = new FormData();
      await appendFile(form, 'photo', p);
      await api.upload(`/agent/inspections/${id}/rooms/${ri}/photos`, form);
      setRooms((cur) => cur.map((r, j) => (j === ri ? { ...r, photos: r.photos.map((x, k) => (k === pi ? { ...x, uploaded: true } : x)) } : r)));
    }
  }

  async function complete() {
    if (!leaseId) return setErr('Choose the lease you are inspecting.');
    if (rooms.some((r) => !r.name.trim())) return setErr('Every room needs a name.');

    setBusy(true);
    setErr(null);
    let id = savedId;
    try {
      if (!id) {
        setProgress('Saving the inspection…');
        const res = await api.post<{ id: number }>('/agent/inspections', {
          lease_id: leaseId,
          type,
          rooms: rooms.map((r) => ({ name: r.name.trim(), condition: r.condition, notes: r.notes.trim() || null })),
        });
        id = res.id;
        setSavedId(id);
      }
      await uploadPhotos(id);
      nav.goBack();
    } catch (e) {
      // `id` is set as soon as the inspection itself is saved, so a failure after that is a photo upload.
      setErr(id ? `${errorText(e)} The inspection itself is saved. Tap the button to retry the remaining photos.` : errorText(e));
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  const locked = savedId !== null; // details are final once saved; only photos can still go up
  const photosLeft = rooms.reduce((n, r) => n + r.photos.filter((p) => !p.uploaded).length, 0);

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <ScrollView style={styles.page} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Card style={{ gap: spacing(3) }}>
          <SectionTitle>Which lease?</SectionTitle>
          {data.leases.length === 0 ? (
            <Text style={styles.body}>
              Every lease you manage already has a {label.toLowerCase()} inspection, so there is nothing to inspect right now.
            </Text>
          ) : (
            data.leases.map((l) => {
              const on = l.id === leaseId;
              return (
                <Pressable
                  key={l.id}
                  style={[styles.lease, on && styles.leaseOn]}
                  onPress={() => !locked && setLeaseId(l.id)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                >
                  <Ionicons name={on ? 'radio-button-on' : 'radio-button-off'} size={20} color={on ? colors.brand : colors.ink300} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.leaseTitle} numberOfLines={1}>
                      {l.listing_title ?? 'Property'}
                    </Text>
                    <Text style={styles.hint}>{l.tenant_name ?? 'Tenant'}</Text>
                  </View>
                </Pressable>
              );
            })
          )}
        </Card>

        {data.leases.length > 0 ? (
          <>
            {rooms.map((room, i) => (
              <Card key={i} style={{ gap: spacing(3) }}>
                <View style={styles.roomHead}>
                  <View style={{ flex: 1 }}>
                    <Field label="ROOM" value={room.name} onChangeText={(t) => patch(i, { name: t })} editable={!locked} placeholder="e.g. Kitchen" />
                  </View>
                  {!locked && rooms.length > 1 ? (
                    <Pressable
                      style={styles.remove}
                      onPress={() => setRooms((cur) => cur.filter((_, j) => j !== i))}
                      accessibilityRole="button"
                      accessibilityLabel={`Remove ${room.name || 'room'}`}
                      hitSlop={6}
                    >
                      <Ionicons name="trash-outline" size={18} color={colors.ink400} />
                    </Pressable>
                  ) : null}
                </View>

                <View style={styles.gap}>
                  <Label>CONDITION</Label>
                  <Chips options={CONDITIONS} selected={[room.condition]} onToggle={(c) => !locked && patch(i, { condition: c })} />
                </View>

                <Field
                  label="NOTES (OPTIONAL)"
                  value={room.notes}
                  onChangeText={(t) => patch(i, { notes: t })}
                  editable={!locked}
                  multiline
                  placeholder="Marks, damage, meter readings…"
                />

                <View style={styles.gap}>
                  <Label>
                    PHOTOS ({room.photos.length}/{MAX_PHOTOS})
                  </Label>
                  {room.photos.length ? (
                    <View style={styles.thumbs}>
                      {room.photos.map((p, k) => (
                        <View key={p.uri}>
                          <Image source={{ uri: p.uri }} style={styles.thumb} />
                          {p.uploaded ? (
                            <View style={[styles.corner, { backgroundColor: colors.success }]}>
                              <Ionicons name="checkmark" size={14} color={colors.white} />
                            </View>
                          ) : (
                            <Pressable
                              style={[styles.corner, { backgroundColor: colors.ink800 }]}
                              onPress={() => patch(i, { photos: room.photos.filter((_, j) => j !== k) })}
                              accessibilityRole="button"
                              accessibilityLabel={`Remove ${room.name} photo ${k + 1}`}
                              hitSlop={8}
                            >
                              <Ionicons name="close" size={14} color={colors.white} />
                            </Pressable>
                          )}
                        </View>
                      ))}
                    </View>
                  ) : null}
                  {room.photos.length < MAX_PHOTOS ? (
                    <View style={formStyles.row}>
                      {Platform.OS !== 'web' ? (
                        <Pressable style={styles.photoBtn} onPress={() => addPhotos(i, 'camera')} accessibilityRole="button">
                          <Ionicons name="camera-outline" size={18} color={colors.brand600} />
                          <Text style={styles.photoBtnText}>Take photo</Text>
                        </Pressable>
                      ) : null}
                      <Pressable style={styles.photoBtn} onPress={() => addPhotos(i, 'gallery')} accessibilityRole="button">
                        <Ionicons name="images-outline" size={18} color={colors.brand600} />
                        <Text style={styles.photoBtnText}>From gallery</Text>
                      </Pressable>
                    </View>
                  ) : null}
                </View>
              </Card>
            ))}

            {!locked ? (
              <SecondaryButton title="+ Add another room" onPress={() => setRooms((cur) => [...cur, { name: '', condition: 'good', notes: '', photos: [] }])} />
            ) : null}

            {err ? <Text style={formStyles.error}>{err}</Text> : null}
            {progress ? <Text style={styles.note}>{progress}</Text> : null}

            <PrimaryButton
              title={locked ? `Upload ${photosLeft} remaining photo${photosLeft === 1 ? '' : 's'}` : `Complete ${label.toLowerCase()} inspection`}
              onPress={complete}
              busy={busy}
            />
            {!locked ? (
              <Text style={styles.note}>
                Completing signs the inspection as you and it can't be edited afterwards.
                {type === 'move_in' ? ' A move-in inspection also releases your commission for this rental.' : ''}
              </Text>
            ) : null}
          </>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.ink50 },
  content: { padding: spacing(4), paddingBottom: spacing(12), gap: spacing(4) },
  gap: { gap: spacing(2) },
  body: { fontFamily: fonts.sans, fontSize: 14, color: colors.ink700, lineHeight: 20 },
  hint: { fontFamily: fonts.sans, fontSize: 12, color: colors.ink500 },
  note: { fontFamily: fonts.sans, fontSize: 13, color: colors.ink500, lineHeight: 19 },
  lease: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(3),
    borderWidth: 1,
    borderColor: colors.ink200,
    borderRadius: radius.md,
    padding: spacing(3),
  },
  leaseOn: { borderColor: colors.brand, backgroundColor: colors.brand50 },
  leaseTitle: { fontFamily: fonts.sansSemiBold, fontSize: 14, color: colors.ink900 },
  roomHead: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing(2) },
  remove: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  thumbs: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing(2.5) },
  thumb: { width: 72, height: 72, borderRadius: radius.sm, backgroundColor: colors.ink100 },
  corner: { position: 'absolute', top: -6, right: -6, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  photoBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing(2),
    borderWidth: 1,
    borderColor: colors.brand100,
    backgroundColor: colors.brand50,
    borderRadius: radius.md,
    paddingVertical: spacing(3),
  },
  photoBtnText: { fontFamily: fonts.sansSemiBold, fontSize: 13, color: colors.brand700 },
});
