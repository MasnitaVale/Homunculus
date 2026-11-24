// All text shown in the app. Edit the strings; keep the quotes and commas.

export type PartId = "hands" | "lips" | "mouth" | "face" | "feet" | "torso" | "contact";

export const content = {
  title: "Homunculus Mirror",

  // Start screen, laid out in scattered fragments.
  // The "map" words are sized by how much of the brain's touch map they take up.
  map: [
    { word: "hands", size: 6 },
    { word: "torso", size: 0.8 },
    { word: "lips", size: 4.4 },
    { word: "back", size: 0.7 },
    { word: "face", size: 3.4 },
    { word: "legs", size: 0.8 },
    { word: "tongue", size: 2.6 },
    { word: "feet", size: 1.8 },
    { word: "arms", size: 1 },
  ],
  fragments: [
    { text: "The sensory homunculus", at: "left", size: "lg" },
    { text: "is the body as the brain feels it:", at: "right", size: "md" },
    { text: "enormous hands, lips and face, a body shrunk to almost nothing.", at: "indent", size: "sm" },
    { text: "This mirror draws that map onto you.", at: "center", size: "lg" },
  ] as { text: string; at: "left" | "right" | "center" | "indent"; size: "sm" | "md" | "lg" }[],
  privacy:
    "Runs entirely on your device. Nothing is recorded, uploaded or saved unless you tap Photo or Record.",
  start: "Start camera",
  loading: "Waking up the mirror…",
  hint: "Show your hands. Touch your face.",

  labels: "Diagram",
  trails: "Trails",
  strength: "Strength",
  photo: "Photo",
  record: "Record",
  stopRecording: "Stop",
  stop: "Exit",

  cameraError:
    "The camera couldn't start. Allow camera access for this page in your browser settings, then try again.",
  loadError: "The mirror couldn't load on this device or browser. Try an up-to-date Chrome or Safari.",
  credit: { label: "Valentina Mașniță", url: "https://valemasnita.com" },

  // Body-part labels and their rough share of the brain's touch map.
  // These are approximate, illustrative values read from Penfield's homunculus,
  // not measurements. Change them here if you find better sources.
  sharesNote: "Shares ≈ rough estimates after Penfield's homunculus (1950), not measurements.",
  parts: {
    hands: { label: "Hands", touch: 24 },
    lips: { label: "Lips", touch: 11 },
    mouth: { label: "Mouth & tongue", touch: 7 },
    face: { label: "Face", touch: 9 },
    feet: { label: "Feet", touch: 6 },
    torso: { label: "Torso", touch: 3 },
    contact: { label: "Contact", touch: 0 },
  } as Record<PartId, { label: string; touch: number }>,
};
