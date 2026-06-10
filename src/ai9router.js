require('dotenv').config();

const BASE_URL = process.env.AI_BASE_URL || 'http://localhost:20128/v1';
const API_KEY = process.env.AI_API_KEY || '';
const TEXT_MODEL = process.env.AI_TEXT_MODEL || 'meta-llama/llama-3-70b-instruct';
const IMAGE_MODEL = process.env.AI_IMAGE_MODEL || 'cx/gpt-5.5-image';

function headers(extra = {}) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${API_KEY}`,
    ...extra,
  };
}

function parseChatCompletionText(data) {
  return data?.choices?.[0]?.message?.content ||
    data?.choices?.[0]?.delta?.content ||
    data?.choices?.[0]?.text ||
    data?.message?.content ||
    data?.content ||
    '';
}

function parseSseText(text) {
  let output = '';
  const lines = text.split(/\r?\n/).filter(line => line.startsWith('data:'));
  for (const line of lines) {
    const raw = line.replace(/^data:\s*/, '').trim();
    if (!raw || raw === '[DONE]') continue;
    try {
      const data = JSON.parse(raw);
      output += parseChatCompletionText(data);
    } catch (_) {
      // Ignore malformed keepalive chunks.
    }
  }
  return output.trim();
}

async function generateText(prompt, systemInstruction = '') {
  const response = await fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: headers({ Accept: 'text/event-stream' }),
    body: JSON.stringify({
      model: TEXT_MODEL,
      stream: false,
      messages: [
        { role: 'system', content: systemInstruction },
        { role: 'user', content: prompt },
      ],
    }),
  });

  const body = await response.text();

  if (!response.ok) {
    throw new Error(`9Router text error ${response.status}: ${body}`);
  }

  if (body.trim().startsWith('data:')) {
    const parsed = parseSseText(body);
    if (parsed) return parsed;
  }

  const data = JSON.parse(body);
  return parseChatCompletionText(data);
}

function parseSseImage(text) {
  const lines = text.split(/\r?\n/).filter(line => line.startsWith('data:'));
  for (const line of lines.reverse()) {
    const raw = line.replace(/^data:\s*/, '').trim();
    if (!raw || raw === '[DONE]') continue;
    try {
      const data = JSON.parse(raw);
      const item = data?.data?.[0] || data;
      if (item?.url) return { url: item.url };
      if (item?.b64_json) return { b64: item.b64_json };
    } catch (_) {}
  }
  return null;
}

async function generateImage(prompt) {
  const response = await fetch(`${BASE_URL}/images/generations`, {
    method: 'POST',
    headers: headers({ Accept: 'text/event-stream' }),
    body: JSON.stringify({
      model: IMAGE_MODEL,
      prompt,
      n: 1,
      size: 'auto',
      quality: 'auto',
      background: 'auto',
      image_detail: 'high',
      output_format: 'png',
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`9Router image error ${response.status}: ${body}`);
  }

  const contentType = response.headers.get('content-type') || '';
  const text = await response.text();
  if (contentType.includes('text/event-stream')) {
    const parsed = parseSseImage(text);
    if (parsed) return parsed;
  }

  const data = JSON.parse(text);
  const item = data?.data?.[0] || data;
  if (item?.url) return { url: item.url };
  if (item?.b64_json) return { b64: item.b64_json };
  throw new Error('No image URL/base64 returned by 9Router');
}

module.exports = { generateText, generateImage };
