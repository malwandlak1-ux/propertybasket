import { Ionicons } from '@expo/vector-icons';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import React, { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { api, appendFile, assetUrl, errorText, LocalFile } from '../../api';
import { Chips, Field, formStyles, Label, PrimaryButton, Segmented } from '../../components/form';
import { Card, LoadState, SectionTitle } from '../../components/ui';
import { pickPhotos, takePhoto } from '../../photos';
import { colors, fonts, radius, spacing } from '../../theme';
import { usePage } from '../../usePage';
import { ListingsStackParams } from './ListingsScreen';

/* ---------- API shape (Agent/CreateListing + Agent/EditListing props) ---------- */

interface ExistingListing {
  id: number;
  title: string;
  description: string | null;
  listing_type: string;
  property_type: string;
  listing_structure: string;
  sale_price: string;
  monthly_rent: string;
  bedrooms: string;
  bathrooms: string;
  area_sqm: string;
  address: string;
  suburb: string;
  city: string;
  province: string;
  postal_code: string;
  latitude: string;
  longitude: string;
  amenities: string[];
  negotiator_protocol: boolean;
  primary_image: string | null;
  gallery_images: string[];
}

interface FormPage {
  amenities: Record<string, string[]>;
  property_types: { value: string; label: string }[];
  provinces: string[];
  listing?: ExistingListing;
}

type ListingType = 'for_sale' | 'long_term_rent';

const digits = (t: string) => t.replace(/[^\d]/g, '');
const decimal = (t: string) => t.replace(/[^\d.]/g, '');
const groupLabel = (k: string) => k.charAt(0).toUpperCase() + k.slice(1);

export default function AgentListingFormScreen() {
  const nav = useNavigation();
  const route = useRoute<RouteProp<ListingsStackParams, 'ListingForm'>>();
  const id = route.params?.id;

  const { data, error, reload } = usePage<FormPage>(id ? `/agent/listings/${id}` : '/agent/listings/form');

  const [type, setType] = useState<ListingType>('for_sale');
  const [title, setTitle] = useState('');
  const [propertyType, setPropertyType] = useState('house');
  const [price, setPrice] = useState('');
  const [bedrooms, setBedrooms] = useState('');
  const [bathrooms, setBathrooms] = useState('');
  const [area, setArea] = useState('');
  const [address, setAddress] = useState('');
  const [suburb, setSuburb] = useState('');
  const [city, setCity] = useState('');
  const [province, setProvince] = useState('');
  const [postal, setPostal] = useState('');
  const [description, setDescription] = useState('');
  const [amenities, setAmenities] = useState<string[]>([]);
  const [cover, setCover] = useState<LocalFile | null>(null);
  const [gallery, setGallery] = useState<LocalFile[]>([]);

  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useLayoutEffect(() => {
    nav.setOptions({ title: id ? 'Edit listing' : 'New listing' });
  }, [nav, id]);

  // Fill the form once when editing.
  const existing = data?.listing;
  useEffect(() => {
    if (!existing) return;
    setType(existing.listing_type === 'long_term_rent' ? 'long_term_rent' : 'for_sale');
    setTitle(existing.title);
    setPropertyType(existing.property_type);
    setPrice(existing.listing_type === 'for_sale' ? existing.sale_price : existing.monthly_rent);
    setBedrooms(existing.bedrooms);
    setBathrooms(existing.bathrooms);
    setArea(existing.area_sqm);
    setAddress(existing.address);
    setSuburb(existing.suburb);
    setCity(existing.city);
    setProvince(existing.province);
    setPostal(existing.postal_code);
    setDescription(existing.description ?? '');
    setAmenities(existing.amenities);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existing?.id]);

  // Amenities the website doesn't group (custom ones) stay selectable so they aren't lost on save.
  const customAmenities = useMemo(() => {
    if (!data || !existing) return [];
    const known = new Set(Object.values(data.amenities).flat());
    return existing.amenities.filter((a) => !known.has(a));
  }, [data, existing]);

  if (!data) return <LoadState error={error} onRetry={reload} />;

  const multiUnit = existing?.listing_structure === 'multi_unit';
  const toggleAmenity = (a: string) => setAmenities((cur) => (cur.includes(a) ? cur.filter((x) => x !== a) : [...cur, a]));

  /** Every text field the server validates, as multipart form data. */
  function fields(): FormData {
    const f = new FormData();
    const put = (k: string, v: string) => v !== '' && f.append(k, v);
    f.append('listing_type', type);
    f.append('listing_structure', multiUnit ? 'multi_unit' : 'single_unit');
    f.append('title', title.trim());
    f.append('property_type', propertyType);
    if (type === 'for_sale') put('sale_price', price);
    else if (!multiUnit) put('monthly_rent', price);
    put('bedrooms', bedrooms);
    put('bathrooms', bathrooms);
    put('area_sqm', area);
    put('address', address.trim());
    put('suburb', suburb.trim());
    put('city', city.trim());
    put('province', province);
    put('postal_code', postal.trim());
    put('description', description.trim());
    put('latitude', existing?.latitude ?? '');
    put('longitude', existing?.longitude ?? '');
    f.append('negotiator_protocol', existing?.negotiator_protocol ? '1' : '0');
    amenities.forEach((a) => f.append('amenities[]', a));
    return f;
  }

  async function save() {
    if (!title.trim()) return setErr('Give the listing a title.');
    if (type === 'for_sale' && !price) return setErr('Enter the asking price.');

    setBusy(true);
    setErr(null);
    try {
      // 1. Details + cover photo.
      setProgress(cover ? 'Saving details and cover photo…' : 'Saving details…');
      const first = fields();
      if (cover) await appendFile(first, 'primary_image', cover);
      const listingId = id ?? (await api.upload<{ id: number }>('/agent/listings', first)).id;
      if (id) await api.upload(`/agent/listings/${id}`, first);

      // 2. Gallery photos one request at a time, so a big set never hits the server's upload limit.
      for (let i = 0; i < gallery.length; i++) {
        setProgress(`Uploading photo ${i + 1} of ${gallery.length}…`);
        const f = fields();
        await appendFile(f, 'gallery_images[]', gallery[i]);
        await api.upload(`/agent/listings/${listingId}`, f);
      }

      nav.goBack();
    } catch (e) {
      setErr(errorText(e));
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  const coverUri = cover?.uri ?? assetUrl(existing?.primary_image);

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <ScrollView style={styles.page} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Card style={styles.section}>
          <Segmented
            options={[
              { value: 'for_sale', label: 'For sale' },
              { value: 'long_term_rent', label: 'To rent' },
            ]}
            value={type}
            onChange={setType}
          />
          <Field label="TITLE" value={title} onChangeText={setTitle} placeholder="e.g. 3 Bed family home in Rynfield" />
          <View style={styles.gap}>
            <Label>PROPERTY TYPE</Label>
            <Chips options={data.property_types} selected={[propertyType]} onToggle={setPropertyType} />
          </View>
          {type === 'long_term_rent' && multiUnit ? (
            <Text style={styles.note}>This is a multi-unit listing. Unit rents are edited on the website.</Text>
          ) : (
            <Field
              label={type === 'for_sale' ? 'ASKING PRICE (R)' : 'MONTHLY RENT (R)'}
              value={price}
              onChangeText={(t) => setPrice(digits(t))}
              keyboardType="number-pad"
            />
          )}
          <View style={formStyles.row}>
            <View style={{ flex: 1 }}>
              <Field label="BEDS" value={bedrooms} onChangeText={(t) => setBedrooms(digits(t))} keyboardType="number-pad" />
            </View>
            <View style={{ flex: 1 }}>
              <Field label="BATHS" value={bathrooms} onChangeText={(t) => setBathrooms(decimal(t))} keyboardType="decimal-pad" />
            </View>
            <View style={{ flex: 1 }}>
              <Field label="SIZE (M²)" value={area} onChangeText={(t) => setArea(decimal(t))} keyboardType="decimal-pad" />
            </View>
          </View>
        </Card>

        <Card style={styles.section}>
          <SectionTitle>Photos</SectionTitle>
          <View style={styles.gap}>
            <Label>COVER PHOTO</Label>
            {coverUri ? <Image source={{ uri: coverUri }} style={styles.cover} resizeMode="cover" /> : null}
            <PhotoButtons
              onCamera={async () => setCover((await takePhoto())[0] ?? cover)}
              onGallery={async () => setCover((await pickPhotos(false))[0] ?? cover)}
              labelPrefix={coverUri ? 'Replace with' : ''}
            />
          </View>
          <View style={styles.gap}>
            <Label>
              MORE PHOTOS{existing?.gallery_images.length ? ` (${existing.gallery_images.length} ALREADY ON THE LISTING)` : ''}
            </Label>
            {gallery.length ? (
              <View style={styles.thumbs}>
                {gallery.map((g, i) => (
                  <View key={g.uri}>
                    <Image source={{ uri: g.uri }} style={styles.thumb} />
                    <Pressable
                      style={styles.thumbRemove}
                      onPress={() => setGallery((cur) => cur.filter((_, j) => j !== i))}
                      accessibilityRole="button"
                      accessibilityLabel={`Remove photo ${i + 1}`}
                      hitSlop={8}
                    >
                      <Ionicons name="close" size={14} color={colors.white} />
                    </Pressable>
                  </View>
                ))}
              </View>
            ) : null}
            <PhotoButtons
              onCamera={async () => {
                const p = await takePhoto();
                setGallery((cur) => [...cur, ...p]);
              }}
              onGallery={async () => {
                const p = await pickPhotos(true);
                setGallery((cur) => [...cur, ...p]);
              }}
              labelPrefix="Add from"
            />
          </View>
        </Card>

        <Card style={styles.section}>
          <SectionTitle>Location</SectionTitle>
          <Field label="STREET ADDRESS" value={address} onChangeText={setAddress} />
          <View style={formStyles.row}>
            <View style={{ flex: 1 }}>
              <Field label="SUBURB" value={suburb} onChangeText={setSuburb} />
            </View>
            <View style={{ flex: 1 }}>
              <Field label="CITY" value={city} onChangeText={setCity} />
            </View>
          </View>
          <View style={styles.gap}>
            <Label>PROVINCE</Label>
            <Chips
              options={data.provinces.map((p) => ({ value: p, label: p }))}
              selected={[province]}
              onToggle={(p) => setProvince(p === province ? '' : p)}
            />
          </View>
          <Field label="POSTAL CODE" value={postal} onChangeText={(t) => setPostal(digits(t))} keyboardType="number-pad" />
        </Card>

        <Card style={styles.section}>
          <SectionTitle>Description and features</SectionTitle>
          <Field label="DESCRIPTION" value={description} onChangeText={setDescription} multiline />
          {Object.entries(data.amenities).map(([group, items]) => (
            <View key={group} style={styles.gap}>
              <Label>{groupLabel(group).toUpperCase()}</Label>
              <Chips options={items.map((a) => ({ value: a, label: a }))} selected={amenities} onToggle={toggleAmenity} />
            </View>
          ))}
          {customAmenities.length ? (
            <View style={styles.gap}>
              <Label>OTHER</Label>
              <Chips options={customAmenities.map((a) => ({ value: a, label: a }))} selected={amenities} onToggle={toggleAmenity} />
            </View>
          ) : null}
        </Card>

        {err ? <Text style={formStyles.error}>{err}</Text> : null}
        {progress ? <Text style={styles.note}>{progress}</Text> : null}

        <PrimaryButton title={id ? 'Save changes' : 'Publish listing'} onPress={save} busy={busy} />
        {!id ? <Text style={styles.note}>The listing goes live on the public site as soon as you publish it.</Text> : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function PhotoButtons({
  onCamera,
  onGallery,
  labelPrefix,
}: {
  onCamera: () => void;
  onGallery: () => void;
  labelPrefix: string;
}) {
  const prefix = labelPrefix ? `${labelPrefix} ` : '';
  return (
    <View style={formStyles.row}>
      {Platform.OS !== 'web' ? (
        <Pressable style={styles.photoBtn} onPress={onCamera} accessibilityRole="button">
          <Ionicons name="camera-outline" size={18} color={colors.brand600} />
          <Text style={styles.photoBtnText}>{prefix ? `${prefix}camera` : 'Camera'}</Text>
        </Pressable>
      ) : null}
      <Pressable style={styles.photoBtn} onPress={onGallery} accessibilityRole="button">
        <Ionicons name="images-outline" size={18} color={colors.brand600} />
        <Text style={styles.photoBtnText}>{prefix ? `${prefix}gallery` : 'Gallery'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.ink50 },
  content: { padding: spacing(4), paddingBottom: spacing(12), gap: spacing(4) },
  section: { gap: spacing(4) },
  gap: { gap: spacing(2) },
  note: { fontFamily: fonts.sans, fontSize: 13, color: colors.ink500, lineHeight: 19 },
  cover: { width: '100%', height: 170, borderRadius: radius.md, backgroundColor: colors.ink100 },
  thumbs: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing(2) },
  thumb: { width: 72, height: 72, borderRadius: radius.sm, backgroundColor: colors.ink100 },
  thumbRemove: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.ink800,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
