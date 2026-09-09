// Navigation lands after the key action, in the chapter's resting interval.
export const stops = [0, 1.55, 2.55, 3.58, 4.22];
export function sceneState(p) {
  return {
    city: p < 1.16,
    room: p > .65 && p < 2.10,
    transaction: p > 1.7 && p < 3.09,
    tenant: p > 2.90 && p < 3.48,
    care: p > 3.02 && p < 3.98,
    end: p > 3.90,
  };
}
