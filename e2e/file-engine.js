// TEST ONLY: a recognition engine that "hears" whatever is in /tmp/e2e-transcript.txt, so browser tests
// decide exactly what the learner "said". It does not analyse audio.
import http from 'node:http'
import fs from 'node:fs'
http.createServer((req, res) => {
  req.resume()
  req.on('end', () => {
    const text = fs.existsSync('/tmp/e2e-transcript.txt') ? fs.readFileSync('/tmp/e2e-transcript.txt', 'utf8') : ''
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ words: text.split(/\s+/).filter(Boolean).map((t) => ({ text: t, confidence: 0.9 })) }))
  })
}).listen(4200, () => console.log('TEST engine on 4200'))
