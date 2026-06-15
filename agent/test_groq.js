const Groq = require('groq-sdk');
const g = new Groq({ apiKey: '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' });

async function test() {
  const a = await g.chat.completions.create({
    model: 'llama-3.1-8b-instant',
    messages: [
      { role: 'system', content: 'You are a security agent. Reply with ONLY a JSON object: {"verdict":"SAFE"}' },
      { role: 'user', content: 'Analyze token 0xabc. Is it safe? Reply with JSON.' },
    ],
    temperature: 0.3, max_tokens: 100
  });
  console.log('Agent-a (Llama 3.1):', a.choices[0].message.content?.slice(0, 100));

  const b = await g.chat.completions.create({
    model: 'mixtral-8x7b-32768',
    messages: [
      { role: 'system', content: 'You are a tokenomics agent. Reply with ONLY a JSON object: {"verdict":"SAFE"}' },
      { role: 'user', content: 'Analyze token 0xabc. Is it safe? Reply with JSON.' },
    ],
    temperature: 0.3, max_tokens: 100
  });
  console.log('Agent-b (Mixtral):', b.choices[0].message.content?.slice(0, 100));
}

test().catch(e => console.error('FAIL:', e.message?.slice(0, 200)));
