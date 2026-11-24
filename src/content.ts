// All text shown in the app. Edit the strings; keep the quotes and commas.

export type PartId = "hands" | "lips" | "mouth" | "face" | "feet" | "torso" | "contact";

export const content = {
  title: "Homunculus Mirror",

  // Start screen, laid out in scattered fragments.
  // The "map" words are sized roughly by their share of the primary touch area
  // (see `parts` below); face and tongue follow Penfield's drawing.
  map: [
    { word: "hands", size: 6 },
    { word: "trunk", size: 2.1 },
    { word: "lips", size: 3.8 },
    { word: "back", size: 1 },
    { word: "face", size: 3 },
    { word: "legs", size: 1.2 },
    { word: "tongue", size: 2.4 },
    { word: "feet", size: 1.2 },
    { word: "arms", size: 1.6 },
  ],
  fragments: [
    { text: "The sensory homunculus", at: "left", size: "lg" },
    { text: "is the body as the brain feels it:", at: "right", size: "md" },
    { text: "enormous hands and lips, a small trunk and legs.", at: "indent", size: "sm" },
    { text: "This mirror draws that map onto you.", at: "center", size: "lg" },
  ] as { text: string; at: "left" | "right" | "center" | "indent"; size: "sm" | "md" | "lg" }[],
  privacy:
    "Runs entirely on your device. Nothing is recorded, uploaded or saved unless you tap Photo or Record.",
  start: "Start camera",
  loading: "Waking up the mirror…",
  hint: "Show your hands. Touch your face.",

  labels: "Diagram",
  strength: "Strength",
  photo: "Photo",
  record: "Record",
  stopRecording: "Stop",
  stop: "Exit",

  cameraError:
    "The camera couldn't start. Allow camera access for this page in your browser settings, then try again.",
  loadError: "The mirror couldn't load on this device or browser. Try an up-to-date Chrome or Safari.",
  credit: { label: "Valentina Mașniță", url: "https://valemasnita.com" },

  // Body-part labels and their share of the primary touch area of the brain (S1),
  // measured with fMRI in 20 people: Saadon-Grosman, Loewenstein & Arzy (2020),
  // "The 'creatures' of the human cortical somatosensory system", Brain Communications
  // 2(1): fcaa003, doi:10.1093/braincomms/fcaa003. The study grouped the body into
  // upper limb 46.3%, lips 28.9%, trunk 15.8% and lower limb 9.1%. Face and tongue
  // were not measured, so they have no number (null).
  sharesNote:
    "Shares of the brain's primary touch area (S1), measured with fMRI in 20 people: Saadon-Grosman, Loewenstein & Arzy, Brain Communications (2020). Face not measured.",
  parts: {
    hands: { label: "Arm & hand", touch: 46 },
    lips: { label: "Lips", touch: 29 },
    mouth: { label: "Lips", touch: 29 },
    face: { label: "Face", touch: null },
    feet: { label: "Leg & foot", touch: 9 },
    torso: { label: "Trunk", touch: 16 },
    contact: { label: "Contact", touch: null },
  } as Record<PartId, { label: string; touch: number | null }>,
};
