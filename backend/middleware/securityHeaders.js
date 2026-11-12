export function securityHeaders(_req, res, next) {
  res.set('X-Content-Type-Options', 'nosniff')
  res.set('Referrer-Policy', 'no-referrer')
  res.set('Cache-Control', 'no-store') // private data, and provider terms limit storing content
  next()
}
