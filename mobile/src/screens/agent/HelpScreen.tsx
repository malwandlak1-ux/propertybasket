import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { API_HOST } from '../../api';
import { Card, LoadState, SectionTitle, useTopPadding } from '../../components/ui';
import { colors, fonts, radius, spacing } from '../../theme';
import { usePage } from '../../usePage';

interface HelpPage {
  agency_name: string | null;
  support_email: string | null;
}

/** How-to answers for the app itself. The full dashboard guides live on the website. */
const GUIDES: { q: string; a: string }[] = [
  {
    q: 'How do I add a lead?',
    a: 'Open More → Leads and tap the + button. Choose the listing the person is interested in, add their name and email, and save. The lead lands in New on your pipeline.',
  },
  {
    q: 'How do I book a viewing?',
    a: 'From a lead: open it, tap Schedule under Viewing and pick the date and time. From the Calendar tab: tap +, choose Viewing, pick the listing and add the client. Either way it shows on your calendar and moves the lead to Viewing.',
  },
  {
    q: 'How do reminders work?',
    a: 'In the Calendar tab tap + and choose Reminder. When it is due you get a notification on your phone and in the website bell. Tick the circle to mark it done.',
  },
  {
    q: 'How do I list a property from my phone?',
    a: 'Open the Listings tab and tap +. Fill in the details, take the cover photo and more photos with your camera, and tap Publish. The listing goes live on the public site straight away.',
  },
  {
    q: 'How do I mark a property sold or rented?',
    a: 'Tap the listing in the Listings tab. Mark as sold records the sale and queues your commission. Mark as rented takes a rental off the public site. Put back on the market reverses a rented listing.',
  },
  {
    q: 'How do I work my farming area?',
    a: 'Open CRM → Property farming and drill down to a scheme. Tap an owner to call or WhatsApp them, then Log a contact with what happened and your next action. Warm owners can be sent to your pipeline as seller leads.',
  },
  {
    q: 'Why can’t I reply to a WhatsApp chat?',
    a: 'WhatsApp only allows free replies within 24 hours of the owner’s last message. After that, send an approved template from the website to reopen the chat.',
  },
  {
    q: 'Why does the app say I can’t make changes?',
    a: 'Your Fidelity Fund Certificate (FFC) is missing or expired. Check More → FFC & Compliance and upload a current certificate on the website. Creating listings also needs your agency’s FFC to be valid.',
  },
];

export default function AgentHelpScreen() {
  const topPadding = useTopPadding();
  const { data, error, reload } = usePage<HelpPage>('/agent/help');
  const [open, setOpen] = useState<number | null>(0);

  if (!data) return <LoadState error={error} onRetry={reload} />;

  return (
    <ScrollView style={styles.page} contentContainerStyle={[styles.content, { paddingTop: topPadding }]}>
      <Card style={{ padding: 0 }}>
        {GUIDES.map((g, i) => {
          const isOpen = open === i;
          return (
            <View key={g.q} style={i > 0 && styles.border}>
              <Pressable
                style={styles.question}
                onPress={() => setOpen(isOpen ? null : i)}
                accessibilityRole="button"
                accessibilityState={{ expanded: isOpen }}
              >
                <Text style={styles.q}>{g.q}</Text>
                <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={18} color={colors.ink400} />
              </Pressable>
              {isOpen ? <Text style={styles.a}>{g.a}</Text> : null}
            </View>
          );
        })}
      </Card>

      <Card style={{ gap: spacing(3) }}>
        <SectionTitle>Still stuck?</SectionTitle>
        {data.support_email ? (
          <>
            <Text style={styles.body}>Email us and we'll get back to you within one working day.</Text>
            <Action
              icon="mail-outline"
              label={`Email ${data.support_email}`}
              onPress={() => Linking.openURL(`mailto:${data.support_email}?subject=${encodeURIComponent('Help with the Property Basket app')}`)}
            />
          </>
        ) : (
          <Text style={styles.body}>
            Contact {data.agency_name ? `${data.agency_name}'s administrator` : 'your agency administrator'} for help with anything not
            covered here.
          </Text>
        )}
        <Action icon="book-outline" label="Open the full guides on the website" onPress={() => Linking.openURL(`${API_HOST}/agent/help`)} />
      </Card>
    </ScrollView>
  );
}

function Action({ icon, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  return (
    <Pressable style={styles.action} onPress={onPress} accessibilityRole="link">
      <Ionicons name={icon} size={18} color={colors.brand600} />
      <Text style={styles.actionText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.ink50 },
  content: { padding: spacing(4), paddingBottom: spacing(10), gap: spacing(4) },
  border: { borderTopWidth: 1, borderTopColor: colors.ink100 },
  question: { flexDirection: 'row', alignItems: 'center', gap: spacing(3), padding: spacing(4), minHeight: 52 },
  q: { flex: 1, fontFamily: fonts.sansSemiBold, fontSize: 15, color: colors.ink900 },
  a: { fontFamily: fonts.sans, fontSize: 14, color: colors.ink700, lineHeight: 21, paddingHorizontal: spacing(4), paddingBottom: spacing(4) },
  body: { fontFamily: fonts.sans, fontSize: 14, color: colors.ink700, lineHeight: 20 },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(2),
    borderRadius: radius.md,
    backgroundColor: colors.brand50,
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(3),
  },
  actionText: { flex: 1, fontFamily: fonts.sansSemiBold, fontSize: 14, color: colors.brand700 },
});
