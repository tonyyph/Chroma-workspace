import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import type { usePhotoOutput } from 'react-native-vision-camera';
import { usePhotoRead } from '@/hooks';
import { hapticsService, soundService } from '@/infrastructure/dependencies';
import { useCaptureStore } from '@/store';
import { useCaptureSequence } from '@/ui';

type PhotoOutput = ReturnType<typeof usePhotoOutput>;

/**
 * One press of the shutter, from the sound to the result screen.
 *
 * **Why two clocks.** A capture finishes when two independent things have both
 * finished: the shutter storyboard, which runs on a fixed clock, and the
 * decode-and-extract, which takes as long as the photo takes.
 *
 * They used to be treated as one. The animation's completion handler fired and
 * gave up silently if the colours were not ready yet — which, for a
 * full-resolution frame, was most of the time, so the shutter appeared to do
 * nothing at all. Tracking them separately and committing when the second one
 * lands is the whole fix, and it is the reason this is a hook rather than a
 * handler in the screen: three pieces of state exist only to express it.
 */
export function useCaptureSession({
  photoOutput,
  flash,
  setId,
}: {
  photoOutput: PhotoOutput;
  flash: 'off' | 'on' | 'auto';
  setId: string | null;
}) {
  const router = useRouter();
  const begin = useCaptureStore((state) => state.begin);
  const { read, colors, deltaE, confidence, reading, latest } = usePhotoRead();

  const [capturing, setCapturing] = useState(false);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [sequenceDone, setSequenceDone] = useState(false);
  const [readDone, setReadDone] = useState(false);
  const [captureError, setCaptureError] = useState(false);

  const onSettled = useCallback(() => {
    void hapticsService.fire('extractionComplete');
    void soundService.play('extractDone');
    setSequenceDone(true);
  }, []);

  const sequence = useCaptureSequence(capturing, onSettled);

  useEffect(() => {
    if (!capturing || !sequenceDone || !readDone) return;

    setCapturing(false);
    setSequenceDone(false);
    setReadDone(false);

    const outcome = latest.current;
    if (!outcome?.ok || outcome.result.colors.length === 0) {
      // Say so rather than stranding the user on a viewfinder that appears to
      // have ignored them.
      setCaptureError(true);
      return;
    }

    begin({
      colors: outcome.result.colors,
      // Read straight from state, not through a ref written during render. The
      // shot is stored before the read is awaited, so by the time `readDone` is
      // true this state has committed.
      photoUri,
      deltaE: outcome.result.deltaE,
      confidence: outcome.result.confidence,
      source: 'photo',
      setId,
    });
    router.push('/capture/result');
  }, [begin, capturing, latest, photoUri, readDone, router, sequenceDone, setId]);

  const shoot = useCallback(async () => {
    void hapticsService.fire('shutterPress');
    void soundService.play('shutter');
    setCaptureError(false);
    setSequenceDone(false);
    setReadDone(false);
    setCapturing(true);
    try {
      // The torch covers the LIVE reading; the flash fires for the frame the
      // extractor actually reads, which is the one that has to be lit.
      const file = await photoOutput.capturePhotoToFile({ flashMode: flash }, {});
      // `filePath` is a filesystem path, not a file:// URL — Image needs the scheme.
      const uri = `file://${file.filePath}`;
      setPhotoUri(uri);
      await read(uri);
    } catch {
      latest.current = { ok: false, reason: 'decode' };
    } finally {
      // Marked done on every path, or a failed shot would leave the capture
      // waiting forever with the shutter disabled.
      setReadDone(true);
    }
  }, [flash, latest, photoOutput, read]);

  return { sequence, shoot, capturing, captureError, colors, deltaE, confidence, reading };
}
