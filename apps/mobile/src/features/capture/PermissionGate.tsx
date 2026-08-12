import { space, type Skin } from '@cw/tokens';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BrandMark } from '@/components';
import { usePreferences } from '@/providers';
import { Button, Card, Text, useStyles } from '@/ui';

/** A4's copy, reused when the permission was never granted or was revoked. */
export function PermissionGate({
  canRequest,
  onRequest,
  onCancel,
}: {
  canRequest: boolean;
  onRequest: () => void;
  onCancel: () => void;
}) {
  const styles = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const { t } = usePreferences();

  return (
    <View style={[styles.root, styles.gate, { paddingTop: insets.top + space.xl }]}>
      <BrandMark size={76} />
      <Text style={styles.gateTitle} variant="headline">
        {t('onboarding.permission.title')}
      </Text>
      <Text style={styles.gateBody} tone="secondary" variant="body">
        {t('onboarding.permission.body')}
      </Text>
      <Card style={styles.gateCard}>
        <Text tone="secondary" variant="body">
          {t(canRequest ? 'capture.permission.allowBody' : 'capture.permission.deniedBody')}
        </Text>
      </Card>
      {/* Nothing to press when the system will not ask again — Settings is the
          only way back, and the copy above says so. */}
      {canRequest ? (
        <Button label={t('onboarding.allowCamera')} onPress={onRequest} size="lg" />
      ) : null}
      <Button label={t('capture.notNow')} onPress={onCancel} variant="ghost" />
    </View>
  );
}

const makeStyles = (skin: Skin) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: skin.ui.bg.media },
    gate: { alignItems: 'center', gap: space.md, paddingHorizontal: space.sectionGap },
    gateTitle: { textAlign: 'center' },
    gateBody: { textAlign: 'center' },
    gateCard: { alignSelf: 'stretch' },
  });
