#!/usr/bin/env node
// Imitates the xAI endpoints SmartMenu calls (POST /v1/responses, POST /v1/images/edits) so the
// assistant, menu import and photo edits can run locally without a key. Start it with
// `npm run mock:xai`, then run the Worker with `npm run dev:mock`.
import { createServer } from 'node:http';

const port = Number(process.env.PORT ?? process.argv[2] ?? 8789);
const words = (text) => Math.ceil(text.length / 4);
const lower = (text) => text.toLowerCase();

function usage(request, output) {
  const images = JSON.stringify(request.input ?? '').match(/data:image\/[a-z]+;base64,[A-Za-z0-9+/=]+/g) ?? [];
  const prompt = JSON.stringify(request.input ?? '').replace(/data:image\/[a-z]+;base64,[A-Za-z0-9+/=]+/g, '');
  const cached = words(request.instructions ?? '');
  const input = cached + words(prompt) + images.length * 1530;
  return {
    input_tokens: input, output_tokens: words(output), total_tokens: input + words(output),
    input_tokens_details: { cached_tokens: cached }, output_tokens_details: { reasoning_tokens: 0 }
  };
}

function respond(request, value) {
  const text = JSON.stringify(value);
  return {
    id: 'resp_mock_' + Date.now(), object: 'response', model: request.model, status: 'completed',
    output: [{ type: 'message', role: 'assistant', status: 'completed', id: 'msg_mock', content: [{ type: 'output_text', text, annotations: [] }] }],
    usage: usage(request, text)
  };
}

const dishNulls = { name: null, description: null, price: null, portion: null, allergens: null, calories: null, tags: null, featured: null, available: null };
const named = (list, text) => list.filter((entry) => entry.name && lower(text).includes(lower(entry.name)))
  .sort((a, b) => b.name.length - a.name.length);

function agent(request) {
  const last = request.input.at(-1).content;
  const menu = JSON.parse(last.match(/Menu:\n(.*)\n\nOwner's message:/s)[1]);
  const message = last.split("Owner's message:\n")[1].trim();
  const sections = menu.sections ?? [];
  const dishes = sections.flatMap((section) => section.dishes ?? []);
  const text = lower(message);

  const design = text.match(/\b(osteria|carta|mercato|notte)\b/);
  if (design || /\b(template|palette|design)\b/.test(text)) {
    return { reply: design ? `Switching the design to ${design[1]}.` : 'Which template would you like: Osteria, Carta, Mercato or Notte?',
      ops: design ? [{ op: 'set_design', template: design[1], palette: null, accent: null }] : [] };
  }

  const add = message.match(/add (?:a )?(?:dish )?["“]?([^"”]+?)["”]?(?: to ([^,]+?))?(?: (?:for|at) (\d+(?:[.,]\d+)?))?\s*(?:lei|ron|eur|€)?\.?$/i);
  if (add) {
    const section = named(sections, add[2] ?? '')[0] ?? sections[0];
    const ops = [];
    let target = section?.h;
    if (!target) {
      ops.push({ op: 'add_section', ref: 'n1', name: 'Menu', note: null, before: null });
      target = 'n1';
    }
    ops.push({ op: 'add_dish', ref: 'n2', section: target, before: null, ...dishNulls, name: add[1].trim(), price: add[3] ? Number(add[3].replace(',', '.')) : null });
    return { reply: `Adding ${add[1].trim()}${section ? ' to ' + section.name : ''}.`, ops };
  }

  const remove = text.match(/^(?:remove|delete|take off)\b/);
  if (remove) {
    const dish = named(dishes, message)[0];
    const section = !dish && named(sections, message)[0];
    if (dish) return { reply: `Removing ${dish.name}.`, ops: [{ op: 'remove_dish', id: dish.h }] };
    if (section) return { reply: `Removing the ${section.name} section.`, ops: [{ op: 'remove_section', id: section.h }] };
  }

  if (/translat|rewrite|descri/.test(text)) {
    const language = message.match(/(?:into|to) (\w+)/i)?.[1] ?? 'English';
    const translate = /translat/.test(text);
    const ops = dishes.filter((dish) => dish.description).map((dish) => ({
      op: 'update_dish', id: dish.h, ...dishNulls, clear: [],
      description: translate ? `[${language}] ${dish.description}` : `Made fresh in our kitchen: ${dish.description.charAt(0).toLowerCase()}${dish.description.slice(1)}`
    }));
    return { reply: ops.length ? (translate ? `Translating ${ops.length} descriptions into ${language}.` : `Rewriting ${ops.length} descriptions.`) : 'There are no descriptions to change yet.', ops };
  }

  if (/price|%|\bcost|raise|lower|increase|reduce/.test(text)) {
    const percent = message.match(/([+-]?\d+(?:[.,]\d+)?)\s*%/);
    const amount = message.match(/(?:to|=)\s*(\d+(?:[.,]\d+)?)/);
    const dish = named(dishes, message)[0];
    const section = named(sections, message)[0];
    const down = /lower|reduce|cut|-\s*\d/.test(text);
    if (percent && (section || dish)) {
      const value = Math.abs(Number(percent[1].replace(',', '.')));
      const target = section && /\ball\b|section|every/.test(text) || !dish ? section : dish;
      return { reply: `Changing the price of ${target.name} by ${down ? '-' : '+'}${value}%.`,
        ops: [{ op: 'change_prices', ids: [target.h], percent: down ? -value : value, amount: null, round_to: null }] };
    }
    if (amount && dish) {
      return { reply: `Setting ${dish.name} to ${amount[1]}.`,
        ops: [{ op: 'update_dish', id: dish.h, ...dishNulls, clear: [], price: Number(amount[1].replace(',', '.')) }] };
    }
  }

  return { reply: 'Could you say which dish or section you mean, and what should change?', ops: [] };
}

function menuPage() {
  return {
    sections: [
      { name: 'Antipasti', items: [
        { name: 'Bruschetta al pomodoro', description: 'Grilled bread, tomatoes, basil, olive oil', price: 24, review: false },
        { name: 'Vitello tonnato', description: 'Veal, tuna sauce, capers', price: null, review: true }
      ] },
      { name: 'Dolci', items: [{ name: 'Tiramisù', description: 'Mascarpone, espresso, cocoa', price: 28, review: false }] }
    ]
  };
}

const json = (response, status, value) => {
  response.writeHead(status, { 'Content-Type': 'application/json' });
  response.end(JSON.stringify(value));
};

createServer(async (request, response) => {
  let body = '';
  for await (const chunk of request) body += chunk;
  const started = Date.now();
  try {
    if (request.method === 'POST' && request.url === '/v1/responses') {
      const payload = JSON.parse(body);
      const format = payload.text?.format?.name;
      if (JSON.stringify(payload.input).includes('mock error')) return json(response, 500, { error: 'Mock failure' });
      const result = format === 'menu_page' ? menuPage() : agent(payload);
      json(response, 200, respond(payload, result));
    } else if (request.method === 'POST' && request.url === '/v1/images/edits') {
      const payload = JSON.parse(body);
      const source = payload.image?.url?.split(',')[1];
      if (!source) return json(response, 400, { error: 'image is required' });
      json(response, 200, { data: [{ b64_json: source, mime_type: 'image/jpeg' }], usage: { cost_in_usd_ticks: 200000000 } });
    } else {
      json(response, 404, { error: `No mock for ${request.method} ${request.url}` });
    }
  } catch (error) {
    json(response, 500, { error: error.message });
  }
  console.log(request.method, request.url, response.statusCode, Date.now() - started + 'ms');
}).listen(port, () => console.log(`Mock xAI API on http://localhost:${port}/v1`));
