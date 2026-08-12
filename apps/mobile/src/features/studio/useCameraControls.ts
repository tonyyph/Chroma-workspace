import { useCallback, useEffect, useState } from 'react';
import type { CameraRef } from 'react-native-vision-camera';

/**
 * The parts of the camera that really do respond in real time.
 *
 * **What this is not.** It is not a live filter. There is no way to reach the
 * preview's pixels on iOS in this build: frame processors need
 * `react-native-vision-camera-worklets`, which does not compile against React
 * Native 0.83, and `takeSnapshot()` is explicitly unimplemented — its iOS
 * counterpart throws `"takeSnapshot() is not available on iOS!"`. Colour is
 * therefore applied to the frame the shutter captures, exactly, rather than
 * approximated over the preview and then contradicted by the photograph.
 *
 * What *is* real time is everything the capture device itself does: exposure,
 * zoom, focus and light. Those are native, they cost nothing, and they are the
 * controls that actually change what the sensor records.
 */

export type CameraControls = {
  /** Undefined until the session has started; every setter no-ops before then. */
  ready: boolean;
  zoom: number;
  minZoom: number;
  maxZoom: number;
  setZoom: (zoom: number) => void;
  exposure: number;
  minExposure: number;
  maxExposure: number;
  setExposure: (bias: number) => void;
  torch: boolean;
  setTorch: (on: boolean) => void;
  /** Focus and meter on a point of the preview, in view coordinates. */
  focusAt: (x: number, y: number) => void;
};

export function useCameraControls(camera: React.RefObject<CameraRef | null>): CameraControls {
  const [ready, setReady] = useState(false);
  const [zoom, setZoomState] = useState(1);
  const [exposure, setExposureState] = useState(0);
  const [torch, setTorchState] = useState(false);
  const [range, setRange] = useState({
    minZoom: 1,
    maxZoom: 1,
    minExposure: 0,
    maxExposure: 0,
  });

  // The controller appears after the session starts, so its ranges cannot be
  // read on mount. Polling briefly beats an `onStarted` prop the screen would
  // otherwise have to thread through only for this.
  useEffect(() => {
    let active = true;
    const timer = setInterval(() => {
      const controller = camera.current?.controller;
      if (!controller || !active) return;
      clearInterval(timer);
      setRange({
        minZoom: controller.minZoom,
        maxZoom: controller.maxZoom,
        minExposure: controller.device.minExposureBias,
        maxExposure: controller.device.maxExposureBias,
      });
      setZoomState(controller.zoom);
      setExposureState(controller.exposureBias);
      setReady(true);
    }, 120);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [camera]);

  const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));

  const setZoom = useCallback(
    (next: number) => {
      const controller = camera.current?.controller;
      if (!controller) return;
      const clamped = clamp(next, controller.minZoom, controller.maxZoom);
      // Optimistic: the slider must not wait for a native round trip to move,
      // and a rejected set leaves the camera where it was, not the UI.
      setZoomState(clamped);
      void controller.setZoom(clamped).catch(() => setZoomState(controller.zoom));
    },
    [camera],
  );

  const setExposure = useCallback(
    (next: number) => {
      const controller = camera.current?.controller;
      if (!controller) return;
      const clamped = clamp(
        next,
        controller.device.minExposureBias,
        controller.device.maxExposureBias,
      );
      setExposureState(clamped);
      void controller
        .setExposureBias(clamped)
        .catch(() => setExposureState(controller.exposureBias));
    },
    [camera],
  );

  const setTorch = useCallback(
    (on: boolean) => {
      const controller = camera.current?.controller;
      if (!controller) return;
      setTorchState(on);
      void controller.setTorchMode(on ? 'on' : 'off').catch(() => setTorchState(!on));
    },
    [camera],
  );

  const focusAt = useCallback(
    (x: number, y: number) => {
      // Focusing rejects on a device that cannot meter, which is a fact about
      // the hardware rather than a failure worth interrupting a shot for.
      void camera.current?.focusTo({ x, y }).catch(() => undefined);
    },
    [camera],
  );

  return {
    ready,
    zoom,
    minZoom: range.minZoom,
    maxZoom: range.maxZoom,
    setZoom,
    exposure,
    minExposure: range.minExposure,
    maxExposure: range.maxExposure,
    setExposure,
    torch,
    setTorch,
    focusAt,
  };
}
