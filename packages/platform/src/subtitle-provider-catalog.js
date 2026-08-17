const field = (key, label, type = "text", options = {}) => ({
  key,
  label,
  type,
  ...options,
});

export const subtitleProviderCatalog = [
  {
    id: "opensubtitles",
    name: "OpenSubtitles.com",
    description: "Search and download community subtitles for movies and individual television episodes.",
    endpoint: "https://api.opensubtitles.com",
    capabilities: ["search", "download", "movie", "episode"],
    fields: [
      field("apiKey", "API key", "password", { required: true, help: "Create an API consumer in your OpenSubtitles.com account." }),
      field("username", "Username", "text", { required: true }),
      field("password", "Password", "password", { required: true }),
      field("includeAiTranslated", "Include AI-translated releases", "checkbox", { defaultValue: false }),
      field("includeMachineTranslated", "Include machine-translated releases", "checkbox", { defaultValue: false }),
    ],
  },
  {
    id: "subdl",
    name: "SubDL",
    description: "Search SubDL by title, language, season, and episode using your own API key.",
    endpoint: "https://api.subdl.com",
    capabilities: ["search", "download", "movie", "episode", "season-pack"],
    fields: [
      field("apiKey", "API key", "password", { required: true, help: "Generate a key from the SubDL API page." }),
      field("includeSeasonPacks", "Include season packs", "checkbox", { defaultValue: true }),
    ],
  },
  {
    id: "whisper",
    name: "Whisper ASR",
    description: "Generate a local subtitle when an online release cannot satisfy the language profile.",
    endpoint: "http://whisper:9000",
    capabilities: ["transcribe", "movie", "episode"],
    fields: [
      field("endpoint", "Whisper service URL", "url", { required: true, placeholder: "http://whisper:9000" }),
    ],
  },
];

export function subtitleProviderDefinition(implementation) {
  return subtitleProviderCatalog.find((item) => item.id === String(implementation || "").toLowerCase()) || null;
}

export function publicSubtitleProviderCatalog() {
  return subtitleProviderCatalog.map((item) => ({ ...item, fields: item.fields.map((value) => ({ ...value })) }));
}
