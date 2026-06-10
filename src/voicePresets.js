const VOICE_PRESETS = [
  {
    id: 'dark-documentary',
    label: 'Dark Documentary',
    description: 'Deep, serious, slow narration for mystery and dark history.',
    language: 'en',
    voice: 'en-US-GuyNeural',
    rate: '-12%',
    pitch: '-8Hz',
    volume: '+0%',
    previewText: 'Beneath the silence of history, an empire waits to reveal its final secret.'
  },
  {
    id: 'epic-trailer',
    label: 'Epic Trailer',
    description: 'Dramatic and firm narration for war, collapse, and disaster scenes.',
    language: 'en',
    voice: 'en-US-GuyNeural',
    rate: '-4%',
    pitch: '-4Hz',
    volume: '+8%',
    previewText: 'When the sky turned black, the greatest civilization on Earth faced its final hour.'
  },
  {
    id: 'mystery-storyteller',
    label: 'Mystery Storyteller',
    description: 'Suspenseful, intimate narration for myths and unsolved history.',
    language: 'en',
    voice: 'en-US-DavisNeural',
    rate: '-10%',
    pitch: '-3Hz',
    volume: '+0%',
    previewText: 'Somewhere beyond the maps, a forgotten city slipped beneath the waves.'
  },
  {
    id: 'calm-historian',
    label: 'Calm Historian',
    description: 'Neutral, clear, slower educational narration.',
    language: 'en',
    voice: 'en-US-AriaNeural',
    rate: '-8%',
    pitch: '-2Hz',
    volume: '+0%',
    previewText: 'To understand this mystery, we must return to the earliest written account.'
  },
  {
    id: 'news-documentary',
    label: 'News Documentary',
    description: 'Crisp, confident narration for factual documentary pacing.',
    language: 'en',
    voice: 'en-US-JennyNeural',
    rate: '+0%',
    pitch: '+0Hz',
    volume: '+0%',
    previewText: 'New evidence has reopened one of history’s most debated questions.'
  },
  {
    id: 'ancient-storyteller',
    label: 'Ancient Storyteller',
    description: 'Warm narrative voice for legends and ancient civilizations.',
    language: 'en',
    voice: 'en-GB-RyanNeural',
    rate: '-10%',
    pitch: '-5Hz',
    volume: '+0%',
    previewText: 'Long before our age, sailors spoke of a kingdom blessed by the gods.'
  }
];

const DEFAULT_PRESET_ID = 'dark-documentary';

function getVoicePreset(id) {
  return VOICE_PRESETS.find(preset => preset.id === id) || VOICE_PRESETS.find(preset => preset.id === DEFAULT_PRESET_ID);
}

module.exports = { VOICE_PRESETS, DEFAULT_PRESET_ID, getVoicePreset };
